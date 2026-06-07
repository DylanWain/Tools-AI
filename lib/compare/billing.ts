/**
 * Server-side billing gate for /api/compare.
 *
 * Owns the full server-side contract:
 *
 *   - `getBillingState(token)`   — validate JWT, look up the user's
 *     billing row, decide whether the request is allowed.
 *   - `recordUsageCents(...)`    — after the stream finishes, bump the
 *     user's period_consumed_cents so the meter-flush cron later turns
 *     it into Stripe meter events.
 *
 * Plan ladder (matches the rest of the codebase):
 *
 *      tier      | gate                                  | metering
 *      ----------+---------------------------------------+--------------
 *      anonymous | 401 — must sign in first              | n/a
 *      free      | over_quota = consumed >= 10¢          | n/a
 *      chad      | always allowed (subscription)         | 2× past $25
 *      payg      | always allowed (card on file)         | 3× metered
 *      admin     | always allowed                        | n/a
 *
 * The "free → chad/payg" upgrade is gated UI-side (paywall component on
 * /compare hands the user off to Stripe). This module's only job is to
 * say yes/no on the current request and accumulate the consumed counter.
 */

import { serverSupabaseAdmin } from "@/lib/supabase";

/** Cents of free usage before an unauthenticated/free user hits the
 *  hard paywall. Centralized here so /api/compare and any future gated
 *  route agree on the same number. */
export const FREE_TRIAL_CENTS = 10;

export type BillingDecision =
  | {
      ok: true;
      userId: string;
      userEmail: string | null;
      tier: string;
      consumedCents: number;
    }
  | { ok: false; reason: "unauthenticated"; httpStatus: 401 }
  | { ok: false; reason: "invalid_token"; httpStatus: 401 }
  | {
      ok: false;
      reason: "over_quota";
      httpStatus: 402;
      userId: string;
      userEmail: string | null;
      consumedCents: number;
    }
  | { ok: false; reason: "lookup_failed"; httpStatus: 500; detail?: string };

/** Extract the bearer token from an Authorization header. Returns null
 *  on the empty / wrong-scheme cases so callers can render a sign-in
 *  prompt instead of a 500. */
export function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/** Gate decision for a /api/compare request. Always returns; never
 *  throws. The route handler maps the decision to the HTTP response. */
export async function decideBilling(token: string | null): Promise<BillingDecision> {
  if (!token) return { ok: false, reason: "unauthenticated", httpStatus: 401 };

  // Construct the admin client inside a try — it throws when
  // SUPABASE_SERVICE_ROLE_KEY is missing. We surface that as a 500
  // with the typed `lookup_failed` reason so the route handler always
  // returns a JSON shape the client can parse.
  let admin: ReturnType<typeof serverSupabaseAdmin>;
  try {
    admin = serverSupabaseAdmin();
  } catch (e) {
    return {
      ok: false,
      reason: "lookup_failed",
      httpStatus: 500,
      detail: (e as Error).message,
    };
  }

  // Step 1 — validate the JWT against Supabase's GoTrue. This is the
  // ONLY way we know who the caller is; we don't trust any other field.
  // `getUser` returns an error object on bad tokens; we treat anything
  // unexpected (e.g. network) as `invalid_token` so the client renders
  // the sign-in flow instead of a generic error.
  let userId: string;
  let userEmail: string | null = null;
  try {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return { ok: false, reason: "invalid_token", httpStatus: 401 };
    }
    userId = userData.user.id;
    userEmail = userData.user.email ?? null;
  } catch {
    return { ok: false, reason: "invalid_token", httpStatus: 401 };
  }

  // Step 2 — fetch billing state. Service-role bypasses RLS so we
  // always see the row even if RLS would otherwise hide it from the
  // user's own anon client.
  const { data: row, error: rowErr } = await admin
    .from("users")
    .select("tier, subscription_status, period_consumed_cents")
    .eq("id", userId)
    .maybeSingle();

  if (rowErr) {
    return {
      ok: false,
      reason: "lookup_failed",
      httpStatus: 500,
      detail: rowErr.message,
    };
  }

  // No row yet → treat as fresh free user (consumed = 0). The row will
  // be created automatically by Supabase Auth's trigger; if not, the
  // first usage-record call will upsert it.
  const tier = (row?.tier as string | null) ?? "free";
  const consumed = (row?.period_consumed_cents as number | null) ?? 0;
  const subStatus = (row?.subscription_status as string | null) ?? null;

  // Subscribed users + PAYG + admins all bypass the free-quota check.
  // Their request gets metered via meter-flush instead.
  const hasActiveSub = subStatus === "active" || subStatus === "trialing";
  if (tier === "admin" || tier === "chad" || tier === "payg" || hasActiveSub) {
    return { ok: true, userId, userEmail, tier, consumedCents: consumed };
  }

  // Free tier with consumption past the cap → paywall.
  if (consumed >= FREE_TRIAL_CENTS) {
    return {
      ok: false,
      reason: "over_quota",
      httpStatus: 402,
      userId,
      userEmail,
      consumedCents: consumed,
    };
  }

  return { ok: true, userId, userEmail, tier, consumedCents: consumed };
}

/** Record raw API cost against the user. Bumps period_consumed_cents
 *  via an atomic Postgres function (`veronum_consume_cents`) if it
 *  exists, otherwise falls back to a read-modify-write UPDATE. The RPC
 *  path is preferred because it's race-free under concurrent fan-out
 *  (N models streaming in parallel all bump the same row). */
export async function recordUsageCents(userId: string, cents: number): Promise<void> {
  if (cents <= 0) return;
  const admin = serverSupabaseAdmin();

  // Preferred: SECURITY DEFINER RPC that does `UPDATE users SET
  // period_consumed_cents = period_consumed_cents + $1 WHERE id = $2`
  // atomically. Returns null if the RPC doesn't exist in this schema.
  const { error: rpcErr } = await admin.rpc("veronum_consume_cents", {
    p_user_id: userId,
    p_cents: cents,
  });
  if (!rpcErr) return;

  // Fallback: read + write. NOT atomic — two concurrent streams could
  // race and lose a few cents. Acceptable while the RPC is unavailable
  // (the cron's high-water-mark idempotency catches anything we
  // under-bill on the next pass). Log so we know the RPC is missing.
  console.warn(
    "[billing] veronum_consume_cents RPC unavailable, falling back to RMW:",
    rpcErr.message,
  );
  const { data: row } = await admin
    .from("users")
    .select("period_consumed_cents")
    .eq("id", userId)
    .maybeSingle();
  const current = (row?.period_consumed_cents as number | null) ?? 0;
  await admin
    .from("users")
    .update({ period_consumed_cents: current + cents })
    .eq("id", userId);
}
