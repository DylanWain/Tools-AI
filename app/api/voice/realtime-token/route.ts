/**
 * GET /api/voice/realtime-token
 *
 * Mints a short-lived OpenAI Realtime client_secret so the browser can
 * open the WebRTC voice session directly to OpenAI. The real
 * OPENAI_API_KEY never leaves the server — the browser only ever gets
 * the ephemeral secret.
 *
 * Ported from the shipped Veronum Bridge (veronum-chat-localhost/
 * server.js) — same model/voice/session shape that the deployed voice
 * used. Billing is swapped to the website's compare gate so voice and
 * compare share one $5 free-trial quota: over-quota returns the same 402
 * shape /api/compare uses, so the existing ComparePaywall handles it.
 *
 * Headers: Authorization: Bearer <supabase_access_token>
 */
import { decideBilling, extractBearer, FREE_TRIAL_CENTS } from "@/lib/compare/billing";
import { REALTIME_MODEL, REALTIME_VOICE, companionInstructions, COMPANION_TOOLS } from "../companion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // ── AUTH + BILLING GATE (same gate as /api/compare) ──────────────
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
    return json(
      {
        error: decision.reason,
        ...(("detail" in decision && decision.detail) ? { detail: decision.detail } : {}),
      },
      decision.httpStatus,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    return json({ ok: false, error: "OPENAI_API_KEY not set" }, 500);
  }

  try {
    // GA endpoint accepts a `session` wrapper with type: "realtime".
    // Audio config nests under audio.input / audio.output. Response is
    // { value, expires_at } at the top level.
    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          instructions: companionInstructions(),
          tools: COMPANION_TOOLS,
          tool_choice: "auto",
          audio: {
            input: {
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 600,
              },
              // Pin Whisper to English — auto-detect mis-routes short
              // utterances and the model then forwards a translated prompt.
              transcription: { model: "whisper-1", language: "en" },
            },
            output: { voice: REALTIME_VOICE },
          },
        },
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      console.warn(`[/api/voice/realtime-token] OpenAI mint ${r.status}: ${body.slice(0, 300)}`);
      return json(
        { ok: false, error: "realtime session mint failed", status: r.status, body: body.slice(0, 800) },
        502,
      );
    }

    const data = (await r.json()) as { value?: string; expires_at?: number };
    return json({
      ok: true,
      clientSecret: data.value,
      expiresAt: data.expires_at,
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
    });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : "mint_failed" }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
