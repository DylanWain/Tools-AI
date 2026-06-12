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

import { after } from "next/server";
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
import { logCompareEvent } from "@/lib/compare/analytics";

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
    /** User-defined project rules (THETOOLSWEBSITE.md equivalent).
     *  Appended to the system prompt so house voice + user conventions
     *  both apply. Optional; client reads from localStorage. */
    projectContext?: string;
    /** Workspace snapshot — every text file the user has loaded into the
     *  workspace, serialised as {path, content} pairs. We bundle them
     *  into fenced blocks and prepend to projectContext so the model
     *  actually sees the code, not just the chat history. Capped server-
     *  side (PROJECT_FILES_CAP_BYTES) and client-side. */
    projectFiles?: Array<{ path: string; content: string }>;
    attachments?: WireAttachment[];
    prevTurns?: ChatMessage[];
    // Analytics-only fields. The client passes its current compare-
    // session id + turn index so the admin dashboard can group the N
    // parallel-fanout rows back into one logical Send. Both are
    // OPTIONAL — older clients won't send them and the log row just
    // carries nulls.
    sessionId?: string;
    turnIndex?: number;
    mode?: string;
  };
  try { body = await req.json(); }
  catch { return jsonError("invalid_json", 400); }

  const prompt = String(body.prompt ?? "").trim();
  const modelId = String(body.modelId ?? "").trim();
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : undefined;
  // Project context cap: 8× the prompt cap. Long enough for a real
  // CLAUDE.md-style doc, short enough to not blow up the upstream
  // payload across every model on every send.
  const rawProjectContext = typeof body.projectContext === "string" ? body.projectContext : undefined;
  // Workspace snapshot. Format as one labeled section per file so the
  // model can tell where the bundle starts/ends and which path each
  // block belongs to. Skip empty entries. The total payload is capped
  // before being merged with the project-rules string.
  const PROJECT_FILES_CAP_BYTES = MAX_PROMPT_CHARS * 6;
  const fileBundle = (() => {
    const files = Array.isArray(body.projectFiles) ? body.projectFiles : [];
    if (files.length === 0) return "";
    const parts: string[] = [];
    let used = 0;
    parts.push("## Current workspace files\n\nThese files are loaded into the user's workspace. Treat them as the source of truth for existing code; reference paths exactly when you propose edits.\n\nIMPORTANT — when you change a file, output the COMPLETE updated file (every line, top to bottom) inside a fenced block whose info string is the language AND the exact path, like ```ts:lib/foo.ts. Veronum writes that block VERBATIM to the real file on the user's disk, so a partial snippet would overwrite and destroy the rest of the file. Only emit a file block for files you actually changed; leave untouched files out.\n\n");
    used += parts[0].length;
    for (const f of files) {
      if (!f || typeof f.path !== "string" || typeof f.content !== "string") continue;
      const lang = (f.path.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9+\-]/g, "");
      const block = "```" + lang + ":" + f.path + "\n" + f.content + "\n```\n\n";
      if (used + block.length > PROJECT_FILES_CAP_BYTES) break;
      parts.push(block);
      used += block.length;
    }
    return parts.join("");
  })();
  const mergedContext = (() => {
    const rules = rawProjectContext && rawProjectContext.trim() ? rawProjectContext.trim() : "";
    if (!fileBundle && !rules) return undefined;
    const combined = fileBundle ? `${fileBundle}${rules ? "\n\n" + rules : ""}` : rules;
    return combined.slice(0, MAX_PROMPT_CHARS * 8);
  })();
  const projectContext = mergedContext;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const prevTurns = sanitizeHistory(body.prevTurns);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null;
  const turnIndex = typeof body.turnIndex === "number" && Number.isFinite(body.turnIndex)
    ? Math.max(0, Math.min(10_000, Math.floor(body.turnIndex))) : null;
  // Mode is just for the dashboard label. Whitelist so a malicious
  // client can't write arbitrary strings into the analytics table.
  const mode: "compare" | "agents" =
    body.mode === "agents" ? "agents" : "compare";

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
      // Log the paywall hit so the admin "activation funnel" knows
      // they were turned away. Wrapped in after() so Vercel keeps the
      // function alive until the write lands — fire-and-forget after
      // a `return new Response(...)` is unreliable on Fluid Compute.
      after(() =>
        logCompareEvent({
          userId: decision.userId,
          userEmail: decision.userEmail,
          mode,
          modelId,
          prompt,
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          status: "error",
          errorKind: "over_quota",
          sessionId,
          turnIndex,
          durationMs: 0,
        }).catch((e) => {
          console.warn(`[/api/compare] paywall-log failed: ${(e as Error).message}`);
        }),
      );
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
    (projectContext?.length ?? 0) +
    prompt.length +
    prevTurns.reduce((n, t) => n + t.content.length, 0) +
    attachments.reduce((n, a) => n + (a.text?.length ?? 0), 0);
  const inputTokens = estimateTokens("x".repeat(inputCharCount));
  // The captured user_id/email is what we bill + log against at
  // end-of-stream. Stable across the stream's lifetime — even if the
  // user signs out mid-stream, the cost still settles against this id.
  const billUserId = decision.userId;
  const billUserEmail = decision.userEmail;

  const enc = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      // Variables that the FINALLY block needs — must be declared
      // outside the try so the analytics + cost write can see them
      // regardless of whether the stream finished normally or threw.
      let outputChars = 0;
      let sawError = false;
      let crashMsg: string | null = null;
      try {
        for await (const chunk of streamCompletion(model, prompt, systemPrompt, attachments, prevTurns, projectContext)) {
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
      } catch (err) {
        crashMsg = err instanceof Error ? err.message : "stream_failed";
        sawError = true;
        console.error(`[/api/compare] ${model.id} crashed: ${crashMsg}`);
        send({ error: crashMsg });
      } finally {
        // Compute final tallies. This block runs whether the stream
        // succeeded, yielded an error frame, or threw — every path
        // gets logged, every successful path gets billed.
        const outputTokens = estimateTokens("x".repeat(outputChars));
        // Tally cost only when there's usable output. Pure errors are
        // free; partial streams (some tokens then error) still charge
        // for what came through since the upstream billed us for them.
        const tallyCents = (outputTokens > 0 || !sawError)
          ? costCents(model.id, inputTokens, outputTokens)
          : 0;
        const durationMs = Date.now() - startedAt;
        // Schedule the DB writes via after(). On Vercel Fluid Compute,
        // a streaming response's function instance gets suspended
        // shortly after controller.close() — fire-and-forget Promises
        // queued at that moment frequently never flush. after() tells
        // the platform "keep this function alive until these resolve."
        after(async () => {
          if (tallyCents > 0) {
            try {
              await recordUsageCents(billUserId, tallyCents);
            } catch (err) {
              console.error(
                `[/api/compare] usage record failed for ${billUserId}: ${(err as Error).message}`,
              );
            }
          }
          try {
            await logCompareEvent({
              userId: billUserId,
              userEmail: billUserEmail,
              mode,
              modelId: model.id,
              prompt,
              inputTokens,
              outputTokens,
              costCents: tallyCents,
              status: sawError ? "error" : "ok",
              // Distinguish thrown crashes from upstream-yielded errors
              // so the dashboard can separate "OpenAI rejected us" from
              // "our function threw before getting a response."
              errorKind: sawError ? (crashMsg ? "crash" : "upstream") : null,
              sessionId,
              turnIndex,
              durationMs,
            });
          } catch (e) {
            console.warn(`[/api/compare] event log failed: ${(e as Error).message}`);
          }
        });
        console.log(
          `[/api/compare] ${model.id} ${sawError ? "err" : "ok"} in=${inputTokens}tok out=${outputChars}ch tally=${tallyCents}c in ${durationMs}ms`,
        );
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
