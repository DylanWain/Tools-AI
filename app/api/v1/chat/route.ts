/**
 * POST /api/v1/chat
 *
 * Claude proxy via Anthropic Messages API. The shipped Veronum DMG calls
 * this from dwc-meetings-bridge.js → analyzeTranscript() and from
 * dwc-shared-chat.js (new) for AI replies in the shared chat thread.
 *
 * Request body (JSON, backwards-compatible with v1.0.x DMG):
 *   {
 *     prompt: string,                 // user message (or transcript)
 *     system_prompt?: string,         // system message
 *     models?: ["claude"],            // ignored, always Claude
 *     stream?: boolean,               // true = SSE; false = single JSON
 *     shared_context?: boolean        // ignored (legacy flag)
 *   }
 *
 * Streaming response (SSE):
 *   data: {"chunk": "text fragment"}\n\n
 *   ...
 *   data: [DONE]\n\n
 *
 * Non-streaming response (JSON):
 *   { text: "full response" }
 *
 * Uses ANTHROPIC_API_KEY env var. Default model: claude-sonnet-4-5
 * (latest production Sonnet — adjustable via ANTHROPIC_MODEL env).
 */

import { isAuthorized, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";

type ChatRequest = {
  prompt?: string;
  system_prompt?: string;
  models?: string[];
  stream?: boolean;
  shared_context?: boolean;
  max_tokens?: number;
};

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();

  const rl = checkRateLimit(req, 60);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "server_misconfigured", message: "ANTHROPIC_API_KEY not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "bad_request", message: "Expected JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const prompt = body.prompt;
  if (!prompt || typeof prompt !== "string") {
    return new Response(
      JSON.stringify({ error: "bad_request", message: "Missing 'prompt' field" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const wantStream = body.stream !== false; // default true
  const upstreamBody = {
    model: DEFAULT_MODEL,
    max_tokens: body.max_tokens || 2048,
    stream: wantStream,
    ...(body.system_prompt ? { system: body.system_prompt } : {}),
    messages: [{ role: "user", content: prompt }],
  };

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "fetch_failed", message: msg }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({
        error: "upstream_error",
        status: upstream.status,
        message: errText.slice(0, 500),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!wantStream) {
    // Non-streaming: return { text: "..." }
    const json = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      json.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("") || "";
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Streaming: convert Anthropic's SSE format to the {chunk: "..."} format
  // the shipped DMG expects (see dwc-meetings-bridge.js → analyzeTranscript).
  if (!upstream.body) {
    return new Response(
      JSON.stringify({ error: "no_stream", message: "Upstream returned no body" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Closure-scoped buffer (cleaner than `this.buffer` on transformer)
  let buffer = "";
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let doneSent = false;

  const transformer = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        // Anthropic SSE frame: "event: <type>\ndata: <json>"
        let eventType = "";
        let dataLine = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
        }
        if (!dataLine) continue;

        try {
          const parsed = JSON.parse(dataLine) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (
            (eventType === "content_block_delta" || parsed.type === "content_block_delta") &&
            parsed.delta?.type === "text_delta" &&
            typeof parsed.delta.text === "string"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk: parsed.delta.text })}\n\n`)
            );
          } else if (eventType === "message_stop" || parsed.type === "message_stop") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            doneSent = true;
          }
          // Ignore message_start, ping, content_block_start, content_block_stop, etc.
        } catch {
          // Skip malformed frames
        }
      }
    },
    flush(controller) {
      if (!doneSent) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }
    },
  });

  return new Response(upstream.body.pipeThrough(transformer), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
