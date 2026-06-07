/**
 * Activity tracking — client-side helper that fires events into the
 * `veronum_log_activity` RPC.
 *
 * Three event kinds:
 *   - page_enter  fired on mount + on client-side route change
 *   - page_leave  fired on beforeunload + visibilitychange (hidden)
 *                 with duration_ms = time since matching page_enter
 *   - mode_change fired explicitly when the user clicks a mode toggle
 *
 * Anonymous users count — every browser gets a stable install_id in
 * localStorage on first visit (the same one PageViewTracker uses, so
 * the join key matches across both event streams).
 *
 * All calls are fire-and-forget; failures are logged but never block
 * the UI. The page_leave call uses `sendBeacon` when available so it
 * survives the browser shutting the tab.
 */

import { getBrowserSupabase } from "@/lib/supabase";

/** Same key PageViewTracker uses — single source of truth for the
 *  install_id so visit + activity events can be joined client-side. */
const INSTALL_ID_KEY = "veronum-web-install-id";

export function getInstallId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const id = (crypto.randomUUID && crypto.randomUUID()) ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(INSTALL_ID_KEY, id);
    return id;
  } catch {
    return `eph-${Date.now()}`;
  }
}

type ActivityArgs = {
  kind: "page_enter" | "page_leave" | "mode_change";
  path?: string;
  fromMode?: string;
  toMode?: string;
  durationMs?: number;
};

/** Fire one activity event. Fire-and-forget — failures don't surface.
 *  Use sendBeacon for page_leave specifically because the browser
 *  may already be tearing the page down when it fires. */
export function trackActivity(args: ActivityArgs): void {
  if (typeof window === "undefined") return;
  const installId = getInstallId();
  if (!installId) return;

  const payload = {
    p_install_id: installId,
    p_kind: args.kind,
    p_path: args.path ?? (typeof window !== "undefined" ? window.location.pathname : null),
    p_from_mode: args.fromMode ?? null,
    p_to_mode: args.toMode ?? null,
    p_duration_ms: args.durationMs ?? null,
  };

  // For page_leave, sendBeacon survives the unload — Supabase REST
  // endpoint accepts POST with the bearer token in the URL (it
  // doesn't read headers from sendBeacon). For other events, use the
  // standard supabase client which is more robust.
  if (args.kind === "page_leave" && navigator.sendBeacon) {
    try {
      // Get the anon key from the running supabase client so we don't
      // re-hardcode it here. The client has `.supabaseKey` exposed.
      const supabase = getBrowserSupabase();
      const url = `${supabaseUrlFor(supabase)}/rest/v1/rpc/veronum_log_activity`;
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(url + `?apikey=${encodeURIComponent(supabaseAnonFor(supabase))}`, blob);
      return;
    } catch {
      // Fall through to the standard client below if sendBeacon path
      // fails for any reason — at worst we miss the event.
    }
  }

  // Standard path — fire-and-forget via the supabase client.
  void getBrowserSupabase()
    .rpc("veronum_log_activity", payload)
    .then(({ error }) => {
      if (error) console.warn("[activity] log failed:", error.message);
    });
}

/** Pull the project URL off the supabase client object. The shape is
 *  internal but stable enough — `client.supabaseUrl`. Fallback to the
 *  hardcoded constant so this never throws. */
function supabaseUrlFor(client: ReturnType<typeof getBrowserSupabase>): string {
  const u = (client as unknown as { supabaseUrl?: string }).supabaseUrl;
  return u || "https://synpjcammfjebwsmtfpz.supabase.co";
}

/** Same for the anon key. */
function supabaseAnonFor(client: ReturnType<typeof getBrowserSupabase>): string {
  const k = (client as unknown as { supabaseKey?: string }).supabaseKey;
  return k || "sb_publishable_1h3d9dMB7f5JK_8aLHR5ig_GiurDzuS";
}
