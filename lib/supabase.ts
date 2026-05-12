/**
 * Shared Supabase client.
 *
 * The website talks to the SAME Supabase project the desktop app and
 * Chrome extension use — single source of truth for shared
 * conversations, file mirroring, room messages, identities. URL + anon
 * key are duplicated from veronum-overlay/lib/api.js by design; the
 * anon key is publishable (Supabase row-level security gates every
 * table) so embedding it in browser bundles is safe.
 *
 * Re-export of the underlying client + a small `serverSupabase()`
 * factory for route handlers that want a fresh client per request
 * (avoids cross-request state pollution under Fluid Compute warm
 * function reuse).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://synpjcammfjebwsmtfpz.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_1h3d9dMB7f5JK_8aLHR5ig_GiurDzuS";

const browserSingleton: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  // Lazy-init so this module is safe to import in server contexts.
  // (We re-bind the const via a closure module-scope ref.)
  if (typeof window === "undefined") {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  type WinWithCache = Window & {
    __veronumSupabaseClient?: SupabaseClient;
  };
  const w = window as WinWithCache;
  if (w.__veronumSupabaseClient) return w.__veronumSupabaseClient;
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  w.__veronumSupabaseClient = c;
  return c;
}

/** Per-request server client. Use this in route handlers / server
 *  components — don't reuse a module-scoped singleton on the server
 *  because Fluid Compute reuses function instances across concurrent
 *  requests and a singleton would leak request-scoped state. */
export function serverSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

// Suppress the unused-singleton warning above; kept the var so future
// callers see it's intentionally lazy.
void browserSingleton;
