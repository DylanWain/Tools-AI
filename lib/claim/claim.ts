/**
 * Client-side subscription claim trigger.
 *
 * Fires POST /api/claim-subscription once per signed-in user, cached
 * in localStorage so we don't re-hit Stripe on every page nav. The
 * server-side route is idempotent — if the user is already chad/payg/
 * admin OR has no Stripe customer, it no-ops fast.
 *
 * When to call: in any auth-state-change handler when signedIn flips
 * to true. The cache key is the user_id, so signing in as a different
 * account triggers a fresh claim attempt.
 */

import { getBrowserSupabase } from "@/lib/supabase";

/** localStorage key per user — we don't re-claim once we've already
 *  successfully attempted for this user_id. If the user later cancels
 *  their subscription (webhook flips status to canceled), the gate
 *  uses subscription_status, not this cache, so the cache going stale
 *  is harmless. */
function cacheKey(userId: string): string {
  return `veronum-claimed-${userId}`;
}

export async function claimSubscriptionIfNeeded(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  // Cheap exit if we've already attempted for this user in this browser.
  try {
    if (window.localStorage.getItem(cacheKey(userId))) return;
  } catch { /* localStorage disabled — proceed anyway */ }

  const supabase = getBrowserSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return;

  try {
    const r = await fetch("/api/claim-subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    // Only mark as attempted on a clean response — if the server
    // 500s (e.g. STRIPE_SECRET_KEY missing) we want to retry on the
    // next sign-in once that's fixed.
    if (r.ok) {
      try {
        window.localStorage.setItem(cacheKey(userId), String(Date.now()));
      } catch { /* localStorage disabled */ }
      const body = await r.json().catch(() => ({}));
      if (body.claimed) {
        // Hard reload so the rest of the app (paywall state, sidebar
        // chad badge, mode toggle lock) sees the new tier immediately
        // without race conditions against the billing-state hook.
        console.log("[claim] subscription auto-linked from Stripe — reloading");
        window.location.reload();
      }
    }
  } catch (e) {
    console.warn("[claim] network error:", (e as Error).message);
  }
}
