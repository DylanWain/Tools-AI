/**
 * POST /api/share — accept a shared conversation from the Veronum
 * Chrome extension and persist it to Supabase so the recipient page
 * at /s/[id] can render it.
 *
 * Request shape (all fields validated):
 *   {
 *     id:          string  — 12-char base62, generated extension-side
 *     source:      string  — 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity'
 *     title?:      string  — derived from first user turn or page title
 *     turns:       Array<{ role: 'user' | 'assistant', text: string }>
 *     source_url?: string  — the AI site URL the share came from
 *     captured_at?: number — epoch ms from extension
 *     private?:    boolean — "Save" action sets this; recipient page 404s
 *   }
 *
 * Response: { ok: true, id, url } on success, { ok: false, error } otherwise.
 *
 * Hard limits applied here (defensive — the table has RLS but a
 * malformed payload still wastes a round-trip):
 *   - body ≤ 1 MB
 *   - id matches /^[A-Za-z0-9]{6,32}$/
 *   - turns is a non-empty array, max 200 entries
 *   - each turn text ≤ 30k chars (matches extension-side cap)
 */

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";

export const runtime = "nodejs"; // Fluid Compute Node runtime
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_TURNS = 200;
const MAX_TURN_CHARS = 30_000;
const ID_RE = /^[A-Za-z0-9]{6,32}$/;
const SOURCE_VALUES = new Set([
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "perplexity",
]);

const ORIGIN_BASE = "https://www.thetoolswebsite.com";

export async function POST(req: Request) {
  // Reject oversized bodies before parsing — keeps us from materializing
  // megabytes of JSON for an obviously-bad request.
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return jsonError(413, "body too large");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "invalid JSON body");
  }
  if (!raw || typeof raw !== "object") {
    return jsonError(400, "body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;

  const id = typeof body.id === "string" ? body.id : "";
  if (!ID_RE.test(id)) return jsonError(400, "invalid id");

  const source = typeof body.source === "string" ? body.source : "";
  if (!SOURCE_VALUES.has(source)) return jsonError(400, "invalid source");

  const title = typeof body.title === "string" ? body.title.slice(0, 200) : null;

  const turnsRaw = body.turns;
  if (!Array.isArray(turnsRaw) || turnsRaw.length === 0) {
    return jsonError(400, "turns must be a non-empty array");
  }
  if (turnsRaw.length > MAX_TURNS) {
    return jsonError(400, `turns may not exceed ${MAX_TURNS} entries`);
  }
  const turns: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const t of turnsRaw) {
    if (!t || typeof t !== "object") continue;
    const r = (t as { role?: unknown }).role;
    const x = (t as { text?: unknown }).text;
    if (r !== "user" && r !== "assistant") continue;
    if (typeof x !== "string" || x.length === 0) continue;
    turns.push({ role: r, text: x.slice(0, MAX_TURN_CHARS) });
  }
  if (turns.length === 0) return jsonError(400, "no valid turns");

  const sourceUrl =
    typeof body.source_url === "string"
      ? body.source_url.slice(0, 2000)
      : typeof body.url === "string"
        ? (body.url as string).slice(0, 2000)
        : null;
  const capturedAt =
    typeof body.captured_at === "number"
      ? body.captured_at
      : typeof body.capturedAt === "number"
        ? body.capturedAt
        : null;
  const isPrivate = body.private === true;

  // Insert. Conflict on id = no-op (idempotent retries don't double-write).
  const supabase = serverSupabase();
  const { error } = await supabase
    .from("extension_shared_conversations")
    .upsert(
      {
        id,
        source,
        title,
        turns,
        source_url: sourceUrl,
        captured_at: capturedAt,
        is_private: isPrivate,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) {
    console.error("[api/share] insert failed:", error);
    return jsonError(500, error.message || "insert failed");
  }

  const url = `${ORIGIN_BASE}/s/${id}`;
  return NextResponse.json({ ok: true, id, url }, { status: 200 });
}

// Health probe for quick "is the endpoint live" checks from the
// extension's diagnostics page. Returns the env it would write to.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "veronum-extension-share-api",
  });
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
