/**
 * POST /api/voice/transcribe
 *
 * Push-to-talk transcription: receive raw audio bytes (Content-Type =
 * the recorded blob's MIME), return { ok, text }. Ported from the shipped
 * Veronum Bridge (veronum-chat-localhost/server.js) — same
 * gpt-4o-transcribe path. Billing uses the website's compare gate so PTT
 * shares the $5 free quota.
 *
 * Body: the raw audio Blob (the browser POSTs it directly, not multipart).
 * Headers: Authorization: Bearer <supabase_access_token>
 */
import { decideBilling, extractBearer, FREE_TRIAL_CENTS } from "@/lib/compare/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  // Gate before the OpenAI call — transcription is our cost.
  const token = extractBearer(req);
  const decision = await decideBilling(token);
  if (!decision.ok) {
    if (decision.reason === "over_quota") {
      return json(
        {
          error: "over_quota",
          userId: decision.userId,
          consumedCents: decision.consumedCents,
          freeTrialCents: FREE_TRIAL_CENTS,
        },
        decision.httpStatus,
      );
    }
    return json({ error: decision.reason }, decision.httpStatus);
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) return json({ ok: false, error: "OPENAI_API_KEY not set" }, 500);

  const ct = req.headers.get("content-type") || "audio/webm";
  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length < 100) return json({ ok: false, error: "no audio body" }, 400);
  if (audio.length > MAX_AUDIO_BYTES) return json({ ok: false, error: "audio too large" }, 413);

  try {
    const ext = ct.includes("ogg") ? "ogg" : ct.includes("mp4") ? "mp4" : "webm";
    const form = new FormData();
    form.append("file", new Blob([audio], { type: ct }), `ptt.${ext}`);
    form.append("model", "gpt-4o-transcribe");
    form.append("response_format", "json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!r.ok) {
      const body = await r.text();
      console.warn(`[/api/voice/transcribe] OpenAI ${r.status} mime=${ct} bytes=${audio.length}: ${body.slice(0, 300)}`);
      return json(
        { ok: false, error: `transcribe failed (${r.status})`, mime: ct, bytes: audio.length, openaiBody: body.slice(0, 500) },
        502,
      );
    }

    const data = (await r.json()) as { text?: string };
    return json({ ok: true, text: data.text || "" });
  } catch (err) {
    console.warn(`[/api/voice/transcribe] crashed: ${err instanceof Error ? err.message : err}`);
    return json({ ok: false, error: err instanceof Error ? err.message : "transcribe_failed" }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
