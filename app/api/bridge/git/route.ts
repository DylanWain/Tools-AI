/**
 * Bridge passthrough for git ops. The browser hits this route with a
 * Supabase JWT in `Authorization`. We:
 *
 *   1. validate the token → get the user
 *   2. look up the user's paired Veronum Bridge tunnel URL from the
 *      veronum_bridges table (same lookup /chat uses)
 *   3. forward the request body to ${tunnel_url}/api/git/${op}
 *
 * The daemon at the other end runs real `git` commands in a real cwd
 * with `gh` CLI logged in, so commits push to GitHub the same way
 * `npm run ship:local` does inside the desktop Bridge.
 *
 * Operations supported:
 *   op="log"           — GET  /api/git/log
 *   op="save"          — POST /api/git/save           (files already on disk)
 *   op="save-virtual"  — POST /api/git/save-virtual   (write virtual files first)
 *   op="revert"        — POST /api/git/revert
 *
 * Per-tab cap of 30s per call so a slow daemon doesn't tie up a
 * Vercel function indefinitely.
 */

import { serverSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 30_000;

type RelayBody = {
  op: "log" | "save" | "save-virtual" | "revert";
  cwd?: string;
  message?: string;
  hash?: string;
  name?: string;
  files?: Record<string, string>;
};

export async function POST(req: Request) {
  const startedAt = Date.now();
  console.log(`[/api/bridge/git] POST received from ${req.headers.get("x-forwarded-for") ?? "unknown"}`);
  // ── 1. auth ────────────────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    console.warn(`[/api/bridge/git] missing_token in ${Date.now() - startedAt}ms`);
    return json({ ok: false, error: "missing_token" }, 401);
  }

  const admin = serverSupabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ ok: false, error: "invalid_token" }, 401);
  const userId = userData.user.id;

  // ── 2. body validation ─────────────────────────────────────
  let body: RelayBody;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (!body.op) return json({ ok: false, error: "op_required" }, 400);
  if (!["log", "save", "save-virtual", "revert"].includes(body.op)) {
    return json({ ok: false, error: "unsupported_op" }, 400);
  }

  // ── 3. tunnel lookup ───────────────────────────────────────
  const { data: bridges, error: bridgeErr } = await admin
    .from("veronum_bridges")
    .select("tunnel_url, install_id, last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (bridgeErr) return json({ ok: false, error: bridgeErr.message }, 500);
  const tunnel = bridges?.[0]?.tunnel_url;
  if (!tunnel) {
    console.warn(`[/api/bridge/git] no_bridge_paired user=${userId.slice(0, 8)} op=${body.op}`);
    return json({
      ok: false,
      error: "no_bridge_paired",
      detail: "No Veronum Bridge daemon found for this account. Pair one at /pair-bridge.",
    }, 502);
  }

  // ── 4. forward to daemon ───────────────────────────────────
  const cleanTunnel = tunnel.replace(/\/+$/, "");
  const url = `${cleanTunnel}/api/git/${body.op}`;
  const isGet = body.op === "log";
  const targetInit: RequestInit = {
    method: isGet ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  };
  if (!isGet) {
    // Strip the `op` field — daemon just wants the operation payload.
    const { op: _op, ...payload } = body;
    void _op;
    targetInit.body = JSON.stringify(payload);
  }

  // For GET log, append cwd as query string.
  const finalUrl = isGet && body.cwd
    ? `${url}?cwd=${encodeURIComponent(body.cwd)}`
    : url;

  let response: Response;
  try {
    response = await fetch(finalUrl, targetInit);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return json({
      ok: false,
      error: "daemon_unreachable",
      detail: msg,
    }, 502);
  }

  const text = await response.text();
  const elapsed = Date.now() - startedAt;
  if (response.ok) {
    console.log(`[/api/bridge/git] ${body.op} ok ${response.status} in ${elapsed}ms`);
  } else {
    console.warn(`[/api/bridge/git] ${body.op} daemon ${response.status} in ${elapsed}ms`);
  }
  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
