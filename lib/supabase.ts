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
  // persistSession: true so the magic-link login on /pair-bridge and
  // /chat survives navigation + reload. Without it, every retry forced
  // a new magic-link email and quickly hit the Supabase free-tier
  // 3-emails-per-hour rate limit. The marketing surfaces (Hero,
  // Pricing, FAQ, etc.) never touch auth, so having a session in
  // localStorage there is harmless. detectSessionInUrl handles the
  // magic-link redirect's access_token fragment. Custom storageKey
  // namespaces our auth state away from any other Supabase clients
  // a future page might use (e.g. embedded /api/share callers).
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "veronum-auth",
    },
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

/**
 * Service-role server client — bypasses RLS. Use ONLY in route handlers
 * that have already authenticated the caller out-of-band (e.g. the
 * Stripe webhook, which is verified by signature, not by JWT).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var. Throws at runtime if
 * missing — fail loud so a misconfigured deploy doesn't silently fall
 * through to the anon client.
 */
export function serverSupabaseAdmin(): SupabaseClient {
  // Accept the standard name AND a couple of common aliases — different
  // deploys (and older Vercel projects) name this variously. Fail loud
  // with an actionable message if none of them are set.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY missing — set it in Vercel → Project → Settings → Environment Variables. Get the value from Supabase dashboard → Project → Settings → API → 'service_role' secret (the long JWT, not the anon key).",
    );
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}

// Suppress the unused-singleton warning above; kept the var so future
// callers see it's intentionally lazy.
void browserSingleton;
