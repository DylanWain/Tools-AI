/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout Session for either the $25/mo flat
 * subscription ('subscribe') or the metered PAYG plan ('payg').
 *
 * Replaces two earlier broken dependencies:
 *   1. The hardcoded Payment Link URL — fragile, broke when the
 *      Payment Link was deactivated/changed in Stripe
 *   2. The Supabase Edge Function `veronum-payg-checkout` — fragile,
 *      required a separate deploy + secret-set that was never done
 *
 * This route runs in Next.js, uses STRIPE_SECRET_KEY (already in
 * Vercel env), and creates the Checkout Session via the official
 * Stripe SDK. The webhook at /api/stripe/webhook handles the
 * subsequent checkout.session.completed event the same way it did
 * for Payment Link checkouts.
 *
 * Body:    { plan: 'subscribe' | 'payg' }
 * Headers: Authorization: Bearer <jwt>
 * Returns: { url: string }   ← client redirects to this
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY       — already set
 *   STRIPE_PRICE_CHAD       — Stripe Price ID for the $25/mo flat plan
 *   STRIPE_PRICE_PAYG       — Stripe Price ID for the metered PAYG plan
 *   NEXT_PUBLIC_SITE_URL    — for redirect URLs (defaults to
 *                              https://www.thetoolswebsite.com)
 */
import Stripe from "stripe";
import { extractBearer, decideBilling } from "@/lib/compare/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Auth — only signed-in users can start a checkout. The session
  // gets attached to their user_id via client_reference_id so the
  // webhook can link them when the payment completes.
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const decision = await decideBilling(token);
  let userId: string;
  let userEmail: string | null;
  if (decision.ok) {
    userId = decision.userId;
    userEmail = decision.userEmail;
  } else if (decision.reason === "over_quota") {
    userId = decision.userId;
    userEmail = decision.userEmail;
  } else if (decision.reason === "invalid_token" || decision.reason === "unauthenticated") {
    return Response.json({ error: decision.reason }, { status: 401 });
  } else {
    return Response.json({
      error: decision.reason,
      detail: "detail" in decision ? decision.detail : undefined,
    }, { status: 500 });
  }

  // Parse the requested plan.
  let body: { plan?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }

  const plan = body.plan;
  if (plan !== "subscribe" && plan !== "payg") {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  // Resolve the Stripe Price ID for the requested plan.
  const priceId = plan === "subscribe"
    ? process.env.STRIPE_PRICE_CHAD
    : process.env.STRIPE_PRICE_PAYG;
  if (!priceId) {
    return Response.json({
      error: "price_id_missing",
      detail: `${plan === "subscribe" ? "STRIPE_PRICE_CHAD" : "STRIPE_PRICE_PAYG"} not set in Vercel env vars. Get the Price ID from Stripe dashboard → Products → your $25/mo or PAYG product → Pricing → starts with "price_…".`,
    }, { status: 500 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({
      error: "stripe_not_configured",
      detail: "STRIPE_SECRET_KEY not set.",
    }, { status: 500 });
  }
  const stripe = new Stripe(stripeKey);

  // Resolve redirect URLs. We prefer the request's origin (so previews
  // work) but fall back to the public production URL.
  const origin = req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.thetoolswebsite.com";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // client_reference_id is what the webhook reads to link the
      // resulting subscription back to this user's auth.users row.
      client_reference_id: userId,
      // Pre-fill the email so the user doesn't retype it. Stripe will
      // also auto-create the customer with this email.
      ...(userEmail ? { customer_email: userEmail } : {}),
      line_items: [{ price: priceId, ...(plan === "subscribe" ? { quantity: 1 } : {}) }],
      // Where to send them after success / cancel. The success page is
      // just our home with a query param so the client can show a
      // confirmation toast; cancel returns to home unchanged.
      success_url: `${origin}/?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=canceled`,
      // Store plan + user_id in metadata so the webhook can verify
      // who paid for what even if client_reference_id is missing.
      metadata: {
        user_id: userId,
        plan,
      },
      // For PAYG (metered), automatic_tax + billing collection — we
      // need a card on file. For flat subscribe, same setup.
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return Response.json({
        error: "no_checkout_url",
        detail: "Stripe didn't return a hosted checkout URL.",
      }, { status: 502 });
    }

    console.log(
      `[/api/checkout] created ${plan} session ${session.id} for user ${userId} (${userEmail || "no email"})`,
    );
    return Response.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_error";
    console.error(`[/api/checkout] stripe error for ${plan}: ${msg}`);
    return Response.json({
      error: "stripe_error",
      detail: msg,
    }, { status: 502 });
  }
}
