/**
 * GET /api/bridge/tunnel-info
 *
 * Lightweight read-only sibling of /api/bridge/git. Returns the
 * caller's paired Bridge tunnel URL so the browser can open a
 * WebSocket directly to the daemon's /api/terminal/stream endpoint
 * (no Vercel function in the data path = no per-keystroke billing).
 *
 *   Authorization: Bearer <supabase-jwt>
 *
 * Response (200):
 *   { paired: true,  tunnel_url: "https://something.trycloudflare.com",
 *     last_seen_at: "2026-06-09T..." }
 * Response (200, not paired):
 *   { paired: false }
 * Response (401): { error: "missing_token" | "invalid_token" }
 *
 * Why a separate route instead of reusing /api/bridge/git: that one
 * is POST-only and forwards to a sub-op on the daemon. This endpoint
 * just returns metadata about the pairing — the browser uses it to
 * decide whether to render the live terminal or the "pair your Bridge"
 * stub, and to know which URL to open the WebSocket to.
 */

import { serverSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    console.warn(`[/api/bridge/tunnel-info] missing_token in ${Date.now() - startedAt}ms`);
    return json({ error: "missing_token" }, 401);
  }

  const admin = serverSupabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    console.warn(`[/api/bridge/tunnel-info] invalid_token in ${Date.now() - startedAt}ms`);
    return json({ error: "invalid_token" }, 401);
  }
  const userId = userData.user.id;

  const { data: bridges, error: bridgeErr } = await admin
    .from("veronum_bridges")
    .select("tunnel_url, install_id, last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (bridgeErr) {
    console.error(`[/api/bridge/tunnel-info] db_error user=${userId.slice(0, 8)} ${bridgeErr.message}`);
    return json({ error: bridgeErr.message }, 500);
  }
  const row = bridges?.[0];
  if (!row?.tunnel_url) {
    return json({ paired: false });
  }
  return json({
    paired: true,
    tunnel_url: row.tunnel_url,
    last_seen_at: row.last_seen_at,
  });
}
