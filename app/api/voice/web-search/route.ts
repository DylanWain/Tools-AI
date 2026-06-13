/**
 * POST /api/voice/web-search  →  { ok, answer }
 *
 * Implements the Companion's `web_search` tool. Ported from the shipped
 * Veronum Bridge (veronum-chat-localhost/server.js) — proxies OpenAI's
 * Responses API with the web_search_preview tool. Billing uses the
 * website's compare gate.
 *
 * Body: { query: string }
 * Headers: Authorization: Bearer <supabase_access_token>
 */
import { decideBilling, extractBearer } from "@/lib/compare/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = extractBearer(req);
  const decision = await decideBilling(token);
  if (!decision.ok) {
    return json({ ok: false, error: decision.reason }, decision.httpStatus);
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) return json({ ok: false, error: "OPENAI_API_KEY not set" }, 500);

  let query = "";
  try {
    const body = (await req.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query : "";
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!query) return json({ ok: false, error: "query required" }, 400);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `Search the web and answer concisely (2-3 sentences max, cite sources by URL): ${query}`,
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.warn(`[/api/voice/web-search] OpenAI ${r.status}: ${body.slice(0, 300)}`);
      return json({ ok: false, error: "web search failed", status: r.status }, 502);
    }
    const data = (await r.json()) as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    let text = "";
    for (const item of data.output || []) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === "output_text" && c.text) text += c.text;
        }
      }
    }
    return json({ ok: true, answer: text || "(no answer)" });
  } catch (err) {
    console.warn(`[/api/voice/web-search] crashed: ${err instanceof Error ? err.message : err}`);
    return json({ ok: false, error: err instanceof Error ? err.message : "web_search_failed" }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
