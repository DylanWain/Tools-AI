/**
 * POST /api/compare
 *
 * Body: { prompt, modelId, systemPrompt?, attachments?, prevTurns? }
 * Headers: Authorization: Bearer <supabase_access_token>
 * Response: text/event-stream
 *
 * One model per request. The client fires N parallel POSTs (one per
 * selected model) and demultiplexes by the modelId it sent.
 *
 * Auth + billing flow (see lib/compare/billing.ts):
 *   - 401 if no/invalid JWT — client renders the sign-in flow
 *   - 402 if free-tier user has used >= 10¢ — client renders the paywall
 *     with the user_id + consumed cents (so the Subscribe Payment Link
 *     can attach client_reference_id and the meter-flush cron knows
 *     whose row to credit on successful checkout)
 *   - otherwise stream the response. AFTER the stream closes we tally
 *     the request's raw cost (input + output tokens × per-model price)
 *     and bump the user's period_consumed_cents counter. The bump uses
 *     an atomic Postgres RPC so concurrent fan-out can't lose cents.
 *
 * SSE events emitted:
 *   data: {"text": "..."}        // streaming token chunk
 *   data: {"done": true}         // upstream finished cleanly
 *   data: {"error": "..."}       // upstream rejected / network failed
 */

import { findModel } from "@/lib/compare/models";
import { streamCompletion, type ChatMessage } from "@/lib/compare/stream";
import type { WireAttachment } from "@/lib/compare/attachments";
import {
  FREE_TRIAL_CENTS,
  decideBilling,
  extractBearer,
  recordUsageCents,
} from "@/lib/compare/billing";
import { costCents, estimateTokens } from "@/lib/compare/cost";

// Node runtime — streaming long-running fetch + 3rd-party SDKs work
// better here than on Edge, and we don't need geographic distribution.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROMPT_CHARS = 8000;
// Multi-turn history limits. Picked card replies can be long — cap each
// to keep upstream payloads bounded without dropping the conversation.
const MAX_HISTORY_TURNS = 40;          // 20 user + 20 assistant
const MAX_HISTORY_MSG_CHARS = 16000;   // per individual message

export async function POST(req: Request) {
  let body: {
    prompt?: string;
    modelId?: string;
    systemPrompt?: string;
    attachments?: WireAttachment[];
    prevTurns?: ChatMessage[];
  };
  try { body = await req.json(); }
  catch { return jsonError("invalid_json", 400); }

  const prompt = String(body.prompt ?? "").trim();
  const modelId = String(body.modelId ?? "").trim();
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : undefined;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const prevTurns = sanitizeHistory(body.prevTurns);

  if (!prompt) return jsonError("prompt_required", 400);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return jsonError(`prompt_too_long (max ${MAX_PROMPT_CHARS} chars)`, 413);
  }
  if (systemPrompt && systemPrompt.length > MAX_PROMPT_CHARS * 4) {
    // System prompts can carry lots of peer-output context — allow 4×
    // the user-prompt budget but still cap to keep the upstream payload
    // bounded.
    return jsonError(`system_prompt_too_long`, 413);
  }
  const model = findModel(modelId);
  if (!model) return jsonError(`unknown_model: ${modelId}`, 404);

  // ── AUTH + BILLING GATE ──────────────────────────────────────────
  // Anything past this point spends tokens that get charged back to
  // the caller. The gate sees the JWT, validates it, looks up the
  // user's tier + consumed cents, and decides yes/no.
  const token = extractBearer(req);
  const decision = await decideBilling(token);
  if (!decision.ok) {
    if (decision.reason === "over_quota") {
      // Surface the data the /compare paywall needs to wire the
      // Subscribe Payment Link (client_reference_id) and PAYG checkout.
      return new Response(
        JSON.stringify({
          error: "over_quota",
          userId: decision.userId,
          consumedCents: decision.consumedCents,
          freeTrialCents: FREE_TRIAL_CENTS,
        }),
        {
          status: decision.httpStatus,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({
        error: decision.reason,
        ...(("detail" in decision && decision.detail) ? { detail: decision.detail } : {}),
      }),
      {
        status: decision.httpStatus,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Bucket the input charge — system + history + current prompt all
  // count as input tokens for billing. We tally output tokens as the
  // stream runs, then bill the sum after the stream closes.
  const inputCharCount =
    (systemPrompt?.length ?? 0) +
    prompt.length +
    prevTurns.reduce((n, t) => n + t.content.length, 0) +
    attachments.reduce((n, a) => n + (a.text?.length ?? 0), 0);
  const inputTokens = estimateTokens("x".repeat(inputCharCount));
  // The captured user_id is what we bill against at end-of-stream.
  // Stable across the stream's lifetime — even if the user signs out
  // mid-stream, the cost still settles against this id.
  const billUserId = decision.userId;

  const enc = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      let outputChars = 0;
      let sawError = false;
      try {
        for await (const chunk of streamCompletion(model, prompt, systemPrompt, attachments, prevTurns)) {
          if (chunk.text) outputChars += chunk.text.length;
          send(chunk);
          if (chunk.error) {
            sawError = true;
            console.warn(
              `[/api/compare] ${model.id} upstream_error in ${Date.now() - startedAt}ms: ${chunk.error}`,
            );
          }
          if (chunk.error || chunk.done) break;
        }
        // Tally cost ONLY when we got a usable response. Errors are
        // free — the upstream didn't bill us, so we don't bill the
        // user. Partial streams (output > 0 then error) still charge
        // for what came through, since the upstream did bill us for
        // those tokens.
        const outputTokens = estimateTokens("x".repeat(outputChars));
        if (outputTokens > 0 || !sawError) {
          const cents = costCents(model.id, inputTokens, outputTokens);
          if (cents > 0) {
            // Fire-and-forget so we don't hold the response open
            // while writing to the DB. Failures are logged but don't
            // fail the request.
            recordUsageCents(billUserId, cents).catch((err) => {
              console.error(
                `[/api/compare] usage record failed for ${billUserId}: ${(err as Error).message}`,
              );
            });
          }
        }
        console.log(
          `[/api/compare] ${model.id} ok in=${inputTokens}tok out=${outputChars}ch in ${Date.now() - startedAt}ms`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream_failed";
        console.error(`[/api/compare] ${model.id} crashed: ${msg}`);
        send({ error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Disable Vercel/CF buffering so tokens arrive as they're produced.
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Validate the client-supplied history. We never trust the role field
 *  blindly — the client could try to inject system messages that way.
 *  Caps the total turn count and per-message length to keep the upstream
 *  payload bounded. Returns an empty array if anything is malformed. */
function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const role = (t as { role?: unknown }).role;
    const content = (t as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.length > MAX_HISTORY_MSG_CHARS
      ? content.slice(0, MAX_HISTORY_MSG_CHARS)
      : content;
    out.push({ role, content: trimmed });
    if (out.length >= MAX_HISTORY_TURNS) break;
  }
  return out;
}
