/**
 * POST /api/v1/transcribe
 *
 * Whisper proxy. The shipped Veronum DMG calls this from
 * dwc-meetings-bridge.js → transcribeBytes(). It expects multipart
 * form-data with `file`, `model` ("whisper-1"), `response_format`
 * ("json"). Returns `{ text: "..." }` JSON on success.
 *
 * Backwards-compatible with v1.0.x DMG. Uses OPENAI_API_KEY env var.
 */

import { isAuthorized, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(req: Request): Promise<Response> {
  // Auth
  if (!isAuthorized(req)) return unauthorizedResponse();

  // Rate limit (60/min/IP — Whisper is expensive, lower than chat)
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  // Support both naming conventions — Tools-AI Vercel project uses OPENAI_KEY,
  // standard Anthropic / OpenAI docs use OPENAI_API_KEY
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "server_misconfigured", message: "OPENAI_API_KEY (or OPENAI_KEY) not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Re-stream the multipart form to OpenAI directly. Avoids buffering audio
  // in our process (Whisper accepts files up to 25MB).
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "bad_request", message: "Expected multipart/form-data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return new Response(
      JSON.stringify({ error: "bad_request", message: "Missing 'file' field" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build OpenAI request — keep model/format the client sent, default to whisper-1/json
  const upstream = new FormData();
  upstream.append("file", file, (file as File).name || "audio.webm");
  upstream.append("model", String(formData.get("model") || "whisper-1"));
  upstream.append("response_format", String(formData.get("response_format") || "json"));
  const language = formData.get("language");
  if (language) upstream.append("language", String(language));
  const prompt = formData.get("prompt");
  if (prompt) upstream.append("prompt", String(prompt));

  try {
    const res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "upstream_error",
          status: res.status,
          message: text.slice(0, 500),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pass through the JSON shape Whisper returned
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "fetch_failed", message: msg }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
