/**
 * GET /api/cron/stripe-meter-flush — Vercel cron job.
 *
 * Drains accumulated raw API usage from public.users → Stripe meter
 * events so flat-plan overage (2x) and PAYG (3x) users actually get
 * billed by Stripe instead of just having a counter tick upward in our
 * DB.
 *
 * Per-user invariant:
 *   period_consumed_cents          ← raw API cost (cents) used this period
 *   period_billed_to_stripe_cents  ← amount already reported to Stripe
 *   delta = consumed - billed_to_stripe
 *
 * Each cron run, for each user with delta > 0 AND tier IN ('chad','payg')
 * AND stripe_customer_id set, we POST a single meter_events with the
 * delta as `value`. Stripe's metered prices ($0.02/unit for the chad
 * overage price, $0.03/unit for PAYG) apply the 2x/3x multiplier and
 * include the amount on the user's next invoice.
 *
 * For flat-plan ('chad') users, the first $25 of usage is included in
 * the $25/mo flat fee — we only report the OVERAGE portion past 2500
 * cents of consumed.
 *
 * Idempotency: each meter event is sent with a deterministic
 * identifier (user_id + period boundary) so a re-run within the same
 * period doesn't double-bill. Stripe meter events accept an
 * `identifier` field for exactly this.
 *
 * Auth: Vercel cron jobs send `Authorization: Bearer ${CRON_SECRET}` —
 * we verify against the CRON_SECRET env var. Without it, the endpoint
 * 401s. Random internet callers can't trigger billing.
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY            — Stripe API access
 *   STRIPE_PRICE_CHAD_OVERAGE    — only used for sanity logging
 *   STRIPE_PRICE_PAYG            — only used for sanity logging
 *   STRIPE_METER_EVENT_NAME      — defaults to 'api_cost_raw_cents'
 *   SUPABASE_SERVICE_KEY         — to read + update public.users
 *   CRON_SECRET                  — gates this endpoint
 *
 * Schedule: every 10 minutes (configured in vercel.json). Tighter
 * cadence means smaller delta per call, smoother billing UX. 10 min
 * is a balance between Stripe API call volume and timeliness.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Long enough to handle ~50 users one Stripe call at a time at ~500ms each.
export const maxDuration = 60;

// Constants — matches Vercel env CHAD_INCLUDED_CENTS but kept here as
// a fallback so the reconciler still has a sane default if the env var
// is missing (we never want to silently bill 100% of usage if config
// is wrong).
const FLAT_INCLUDED_CENTS = parseInt(
  process.env.CHAD_INCLUDED_CENTS || "2500",
  10,
);
const METER_EVENT_NAME =
  process.env.STRIPE_METER_EVENT_NAME || "api_cost_raw_cents";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

function getAdmin() {
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_KEY missing");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

type UserRow = {
  id: string;
  email: string | null;
  tier: string | null;
  period_consumed_cents: number;
  period_billed_to_stripe_cents: number;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  /** Per-user override of the chad-tier included cap. NULL = use
   *  FLAT_INCLUDED_CENTS (the env default). Set per-row for custom
   *  plans like a $15 sub with $15 included (1500). */
  included_cents: number | null;
};

// Compute the raw cents to report to Stripe for this period.
// - PAYG users: report everything (delta from consumed - already reported)
// - Flat ('chad') users: report only the portion past their included
//   cap. Per-user override `included_cents` wins; otherwise falls back
//   to the env default ($25 / 2500).
function billableCents(u: UserRow): number {
  const consumed = u.period_consumed_cents || 0;
  const alreadyReported = u.period_billed_to_stripe_cents || 0;
  if (u.tier === "payg") {
    return Math.max(consumed - alreadyReported, 0);
  }
  if (u.tier === "chad") {
    const cap = u.included_cents ?? FLAT_INCLUDED_CENTS;
    const overage = Math.max(consumed - cap, 0);
    return Math.max(overage - alreadyReported, 0);
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const runId = crypto.randomUUID().slice(0, 8);
  console.log(`[meter-flush ${runId}] start`);
  // Vercel cron auth — Vercel attaches Authorization: Bearer ${CRON_SECRET}
  // automatically when invoking scheduled functions defined in vercel.json.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization") || "";
    if (got !== `Bearer ${expected}`) {
      console.warn(`[meter-flush ${runId}] unauthorized — bad/missing bearer`);
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  let stripe: Stripe;
  let sb;
  try {
    stripe = getStripe();
    sb = getAdmin();
  } catch (e) {
    console.error(`[meter-flush ${runId}] config_missing: ${(e as Error).message}`);
    return NextResponse.json(
      { ok: false, error: "config_missing", detail: (e as Error).message },
      { status: 500 },
    );
  }

  // Pull candidates: anyone with consumed > already reported AND a customer ID.
  const { data: candidates, error } = await sb
    .from("users")
    .select(
      "id, email, tier, period_consumed_cents, period_billed_to_stripe_cents, stripe_customer_id, current_period_start, included_cents",
    )
    .in("tier", ["chad", "payg"])
    .not("stripe_customer_id", "is", null)
    .gt("period_consumed_cents", 0);

  if (error) {
    console.error(`[meter-flush ${runId}] query_failed: ${error.message}`);
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }
  console.log(`[meter-flush ${runId}] ${candidates?.length ?? 0} candidate users with consumed > 0`);

  const results: Array<{
    user_id: string;
    email: string | null;
    tier: string | null;
    delta_units: number;
    status: "ok" | "skipped" | "error";
    error?: string;
  }> = [];

  for (const u of (candidates ?? []) as UserRow[]) {
    const delta = billableCents(u);
    if (delta <= 0) {
      results.push({
        user_id: u.id,
        email: u.email,
        tier: u.tier,
        delta_units: 0,
        status: "skipped",
      });
      continue;
    }
    if (!u.stripe_customer_id) {
      results.push({
        user_id: u.id,
        email: u.email,
        tier: u.tier,
        delta_units: delta,
        status: "skipped",
        error: "no_stripe_customer",
      });
      continue;
    }
    // Deterministic identifier per (user, period_start). Stripe deduplicates
    // events with the same identifier so cron-run-twice can't double-bill.
    // If period_start is null, use the row id as a sentinel.
    const periodKey = u.current_period_start
      ? u.current_period_start.slice(0, 10)
      : u.id.slice(0, 8);
    // Plus the high-water mark so each delta sent gets a unique id.
    const identifier = `${u.id}-${periodKey}-${u.period_consumed_cents}`;

    try {
      await stripe.billing.meterEvents.create({
        event_name: METER_EVENT_NAME,
        identifier,
        payload: {
          stripe_customer_id: u.stripe_customer_id,
          value: String(delta),
        },
      });
      // Mark as reported. We update to the current consumed value (not
      // consumed + delta) so concurrent dispatches during this cron run
      // get picked up next time without double-counting.
      const { error: updateErr } = await sb
        .from("users")
        .update({ period_billed_to_stripe_cents: u.period_consumed_cents })
        .eq("id", u.id);
      if (updateErr) {
        console.error(
          `[meter-flush ${runId}] meter sent for ${u.email} but DB update failed: ${updateErr.message}`,
        );
        results.push({
          user_id: u.id,
          email: u.email,
          tier: u.tier,
          delta_units: delta,
          status: "error",
          error: `meter_sent_but_db_update_failed: ${updateErr.message}`,
        });
        continue;
      }
      console.log(
        `[meter-flush ${runId}] ${u.tier} ${u.email} +${delta} units (id=${identifier.slice(-12)})`,
      );
      results.push({
        user_id: u.id,
        email: u.email,
        tier: u.tier,
        delta_units: delta,
        status: "ok",
      });
    } catch (err) {
      console.error(
        `[meter-flush ${runId}] Stripe meter event failed for ${u.email}: ${(err as Error).message}`,
      );
      results.push({
        user_id: u.id,
        email: u.email,
        tier: u.tier,
        delta_units: delta,
        status: "error",
        error: (err as Error).message,
      });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const errors = results.filter((r) => r.status === "error").length;
  const totalUnits = results
    .filter((r) => r.status === "ok")
    .reduce((s, r) => s + r.delta_units, 0);
  console.log(
    `[meter-flush ${runId}] done — ${ok} ok, ${errors} err, ${totalUnits} total units across ${results.length} candidates`,
  );
  return NextResponse.json({
    ok: true,
    summary: { processed: results.length, ok, errors, total_units: totalUnits },
    results,
  });
}
