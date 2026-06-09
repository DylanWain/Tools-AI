"use client";

/**
 * Browser-side helper for the live terminal pane. Wraps the
 * /api/bridge/tunnel-info lookup so TerminalPane.tsx doesn't have to
 * know about JWT plumbing, then surfaces a typed result the component
 * can branch on cleanly.
 *
 * The actual WebSocket lives in TerminalPane — this just answers the
 * question "where do I open the WS to?".
 */

import { getBrowserSupabase } from "@/lib/supabase";

export type TerminalPairing =
  | { status: "paired"; tunnelUrl: string; lastSeenAt: string | null }
  | { status: "not_paired" }
  | { status: "signed_out" }
  | { status: "error"; detail: string };

/** Fetch the user's Bridge pairing info. Returns a tagged union so
 *  the caller can switch on `status` and render the right UI. */
export async function fetchTerminalPairing(): Promise<TerminalPairing> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { status: "signed_out" };

  try {
    const r = await fetch("/api/bridge/tunnel-info", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await r.json().catch(() => ({}))) as {
      paired?: boolean;
      tunnel_url?: string;
      last_seen_at?: string | null;
      error?: string;
    };
    if (!r.ok) {
      return { status: "error", detail: body.error ?? `HTTP ${r.status}` };
    }
    if (!body.paired || !body.tunnel_url) {
      return { status: "not_paired" };
    }
    return {
      status: "paired",
      tunnelUrl: body.tunnel_url,
      lastSeenAt: body.last_seen_at ?? null,
    };
  } catch (e) {
    return { status: "error", detail: (e as Error).message };
  }
}

/** Translate the daemon's tunnel URL into the WebSocket URL for the
 *  terminal stream endpoint. The daemon's `mountTerminal` listens on
 *  /api/terminal/stream and accepts `cwd`, `cols`, `rows` as query
 *  params for the initial pty size; resize after that is a JSON
 *  frame over the open socket. */
export function buildTerminalWsUrl(
  tunnelUrl: string,
  opts: { cwd?: string; cols: number; rows: number },
): string {
  // Tunnel is usually https://. Map to wss://. http→ws fallback for
  // local dev against a non-HTTPS tunnel.
  const base = tunnelUrl.replace(/^https?:/, (m) => (m === "https:" ? "wss:" : "ws:"));
  const url = new URL("/api/terminal/stream", base);
  if (opts.cwd) url.searchParams.set("cwd", opts.cwd);
  url.searchParams.set("cols", String(opts.cols));
  url.searchParams.set("rows", String(opts.rows));
  return url.toString();
}
