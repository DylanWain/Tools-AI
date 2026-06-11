/**
 * POST /api/checkout/wallet
 *
 * Mints a Stripe Checkout Session (mode='payment') for a wallet
 * top-up. Sibling to /api/checkout, which handles the subscription
 * ($25/mo) and metered (PAYG) plans. Wallet is a one-shot payment —
 * the user picks an amount, pays once, and our webhook credits the
 * balance in veronum_wallet_transactions.
 *
 *   Body:    { amount_cents: int }   500..100_000 (i.e. $5..$1000)
 *   Headers: Authorization: Bearer <jwt>
 *   Returns: { url: string }         client window.location.href = url
 *
 * setup_future_usage='off_session' saves the card on the resulting
 * PaymentIntent so the desktop app's auto-recharge can later charge
 * off-session without a user prompt. Top-ups are credited by the
 * Supabase webhook (handleWalletTopUpCompleted in
 * supabase/functions/veronum-stripe/index.ts) — NOT by this site's
 * /api/stripe/webhook, which only handles subscription lifecycle.
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY     — already set
 *   NEXT_PUBLIC_SITE_URL  — for redirect URLs (defaults to prod)
 */
import Stripe from "stripe";
import { extractBearer, decideBilling } from "@/lib/compare/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bounds mirror the desktop app + edge function so an out-of-band
// caller can't request a sub-fee or runaway top-up.
const TOPUP_MIN_CENTS = 500;
const TOPUP_MAX_CENTS = 100_000;

export async function POST(req: Request) {
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const decision = await decideBilling(token);
  // Both 'ok' and 'over_quota' carry userId + userEmail; either is fine
  // — a wallet top-up should work whether the user has free budget left
  // or has already hit the paywall. Anything else (invalid token /
  // upstream error) bails the same way /api/checkout does.
  let userId: string;
  let userEmail: string | null;
  if (decision.ok) {
    userId = decision.userId;
    userEmail = decision.userEmail;
  } else if (decision.reason === "over_quota") {
    userId = decision.userId;
    userEmail = decision.userEmail;
  } else if (
    decision.reason === "invalid_token" ||
    decision.reason === "unauthenticated"
  ) {
    return Response.json({ error: decision.reason }, { status: 401 });
  } else {
    return Response.json({
      error: decision.reason,
      detail: "detail" in decision ? decision.detail : undefined,
    }, { status: 500 });
  }

  let body: { amount_cents?: unknown };
  try { body = await req.json(); }
  catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }

  const amount = Math.floor(Number(body.amount_cents));
  if (
    !Number.isFinite(amount) ||
    amount < TOPUP_MIN_CENTS ||
    amount > TOPUP_MAX_CENTS
  ) {
    return Response.json({
      error: "invalid_amount",
      detail:
        `amount_cents must be an integer between ${TOPUP_MIN_CENTS} ` +
        `($5) and ${TOPUP_MAX_CENTS} ($1000).`,
    }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({
      error: "stripe_not_configured",
      detail: "STRIPE_SECRET_KEY not set.",
    }, { status: 500 });
  }
  const stripe = new Stripe(stripeKey);

  const origin = req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.thetoolswebsite.com";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: userId,
      ...(userEmail ? { customer_email: userEmail } : {}),
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "Veronum Wallet Top-Up" },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      // Saves the card on the resulting PaymentIntent for off-session
      // auto-recharge — see handleWalletTopUpCompleted in the Supabase
      // edge function for how we read it back.
      payment_intent_data: { setup_future_usage: "off_session" },
      success_url: `${origin}/?wallet_topup=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?wallet_topup=canceled`,
      // CRITICAL: veronum_topup='true' is what makes the Supabase
      // webhook route this to handleWalletTopUpCompleted instead of
      // promoteToPro. The email is the bridge from Tools-AI auth.users
      // to veronum_users — the webhook finds-or-creates by email.
      metadata: {
        veronum_topup: "true",
        tools_user_id: userId,
        topup_cents: String(amount),
        ...(userEmail ? { email: userEmail } : {}),
      },
    });

    if (!session.url) {
      return Response.json({
        error: "no_checkout_url",
        detail: "Stripe didn't return a hosted checkout URL.",
      }, { status: 502 });
    }

    console.log(
      `[/api/checkout/wallet] minted ${amount}c top-up session ${session.id} for ${userId} (${userEmail || "no email"})`,
    );
    return Response.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_error";
    console.error(`[/api/checkout/wallet] stripe error: ${msg}`);
    return Response.json({
      error: "stripe_error",
      detail: msg,
    }, { status: 502 });
  }
}
