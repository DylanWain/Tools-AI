/**
 * POST /api/claim-subscription
 *
 * Auto-link existing Stripe subscriptions to a freshly-signed-in user.
 *
 * Context: people can pay via the Stripe Payment Link without ever
 * having signed in to the website (cold flow). Their Stripe customer
 * + subscription exist, but there's no auth.users row at payment time,
 * so the webhook's `email → user_id` lookup fails and they end up
 * stranded — paid but unable to use the product.
 *
 * This route fires from the client every time signedIn flips true.
 * The server:
 *   1. Validates the JWT (knows who's calling)
 *   2. Looks up Stripe customers matching their email
 *   3. For each match, checks for any active/trialing subscription
 *   4. If found, upserts public.users with tier='chad' +
 *      stripe_customer_id + stripe_subscription_id
 *
 * Idempotent — if already chad/payg/admin, returns {claimed:false}.
 * Admin tier is preserved (never downgraded by this route).
 *
 * Headers: Authorization: Bearer <jwt>
 * Returns: { claimed: boolean, reason?: string, customerId?: string }
 */
import Stripe from "stripe";
import { extractBearer, decideBilling } from "@/lib/compare/billing";
import { serverSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const decision = await decideBilling(token);
  // We care about identity, NOT about quota — over_quota is fine for
  // a claim attempt (the whole point is to flip them OFF over_quota).
  let userId: string;
  let userEmail: string | null;
  let currentTier: string;
  if (decision.ok) {
    userId = decision.userId;
    userEmail = decision.userEmail;
    currentTier = decision.tier;
  } else if (decision.reason === "over_quota") {
    userId = decision.userId;
    userEmail = decision.userEmail;
    currentTier = "free";
  } else if (decision.reason === "invalid_token" || decision.reason === "unauthenticated") {
    return Response.json({ error: decision.reason }, { status: 401 });
  } else {
    return Response.json({ error: decision.reason, detail: "detail" in decision ? decision.detail : undefined }, { status: 500 });
  }

  if (!userEmail) {
    return Response.json({ claimed: false, reason: "no_email_on_account" });
  }

  // Already paid-tier or admin? No-op. (Admin is preserved; chad/payg
  // means a previous claim or webhook already linked them.)
  if (currentTier === "admin" || currentTier === "chad" || currentTier === "payg") {
    return Response.json({ claimed: false, reason: "already_paid_tier", tier: currentTier });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({
      error: "stripe_not_configured",
      detail: "STRIPE_SECRET_KEY missing — set it in Vercel env vars.",
    }, { status: 500 });
  }
  const stripe = new Stripe(stripeKey);

  // Step 1 — find ALL Stripe customers with this email. Stripe allows
  // multiple customers per email (someone could have checked out as
  // guest multiple times), so we check every match.
  let customers: Stripe.Customer[] = [];
  try {
    const list = await stripe.customers.list({ email: userEmail.toLowerCase(), limit: 10 });
    customers = list.data;
  } catch (e) {
    console.warn(`[claim] stripe customer lookup failed for ${userEmail}: ${(e as Error).message}`);
    return Response.json({ claimed: false, reason: "stripe_lookup_failed" }, { status: 502 });
  }

  if (customers.length === 0) {
    return Response.json({ claimed: false, reason: "no_stripe_customer" });
  }

  // Step 2 — for each customer, check for any active/trialing
  // subscription. First match wins.
  for (const customer of customers) {
    let subs: Stripe.Subscription[] = [];
    try {
      const list = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });
      subs = list.data;
    } catch (e) {
      console.warn(`[claim] subscriptions.list failed for ${customer.id}: ${(e as Error).message}`);
      continue;
    }
    const active = subs.find((s) => s.status === "active" || s.status === "trialing");
    if (!active) continue;

    // Step 3 — upsert public.users with the link. Service role
    // bypasses RLS. Reset the period counter since this is the start
    // of their "paid period" from our POV.
    let admin;
    try {
      admin = serverSupabaseAdmin();
    } catch (e) {
      return Response.json({
        error: "lookup_failed",
        detail: (e as Error).message,
      }, { status: 500 });
    }

    const { error: upsertErr } = await admin
      .from("users")
      .upsert({
        id: userId,
        email: userEmail.toLowerCase(),
        tier: "chad",
        subscription_status: active.status,
        stripe_customer_id: customer.id,
        stripe_subscription_id: active.id,
        period_consumed_cents: 0,
        period_billed_cents: 0,
        ...(active.current_period_end
          ? { current_period_end: new Date(active.current_period_end * 1000).toISOString() }
          : {}),
        ...(active.current_period_start
          ? { current_period_start: new Date(active.current_period_start * 1000).toISOString() }
          : {}),
      }, { onConflict: "id" });

    if (upsertErr) {
      console.error(`[claim] upsert failed for ${userEmail}: ${upsertErr.message}`);
      return Response.json({
        claimed: false,
        reason: "upsert_failed",
        detail: upsertErr.message,
      }, { status: 500 });
    }

    console.log(
      `[claim] promoted ${userEmail} → chad via stripe customer ${customer.id} / sub ${active.id} (${active.status})`,
    );
    return Response.json({
      claimed: true,
      tier: "chad",
      customerId: customer.id,
      subscriptionId: active.id,
      status: active.status,
    });
  }

  // No active subscription found among matching customers.
  return Response.json({
    claimed: false,
    reason: "no_active_subscription",
    matched_customers: customers.length,
  });
}
