/**
 * POST /api/stripe/webhook
 *
 * Stripe → Veronum sync. Stripe POSTs subscription lifecycle events
 * here. We verify the signature with STRIPE_WEBHOOK_SECRET, then
 * mirror the relevant state into public.users so the daemon's billing
 * gate (lib/billingGate.js in veronum-bridge) sees a current
 * subscription_status when it does its atomic gate check.
 *
 * Events handled (the minimum for one-time-Payment-Link flow + monthly
 * renewals + cancellations):
 *
 *   checkout.session.completed
 *     Fires once at the end of every Payment Link checkout. Contains
 *     `client_reference_id` (we set this to the Veronum user_id via
 *     the Subscribe button's URL param), `customer` (Stripe customer
 *     id), and `subscription` (Stripe subscription id). We bind these
 *     to public.users + set subscription_status='active'.
 *
 *   customer.subscription.updated
 *     Renewals, cancellations-at-period-end, status changes (past_due,
 *     paused, etc). We update subscription_status + current_period_end.
 *
 *   customer.subscription.deleted
 *     Subscription fully ended. Flip status to 'canceled' so the gate
 *     starts treating the user as a free-quota user again. The
 *     period_consumed_cents counter is intentionally NOT reset — that
 *     happens on the next *paid* renewal so a user can't "subscribe →
 *     use 25 cents free → cancel → re-subscribe" to dodge the cap.
 *
 * Env vars required (set in Vercel):
 *   STRIPE_SECRET_KEY            — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET        — whsec_... from Stripe dashboard
 *                                  (Developers → Webhooks → endpoint
 *                                   → "Signing secret")
 *   SUPABASE_SERVICE_ROLE_KEY    — for the public.users UPDATE
 *
 * Stripe dashboard config:
 *   1. Developers → Webhooks → Add endpoint
 *   2. URL: https://www.thetoolswebsite.com/api/stripe/webhook
 *   3. Events: checkout.session.completed, customer.subscription.updated,
 *      customer.subscription.deleted (start with these three)
 *   4. Copy the signing secret into Vercel env as STRIPE_WEBHOOK_SECRET
 *
 * Payment Link config:
 *   The current link is buy.stripe.com/fZu28tb3x9aufwJeLt1sQ00 — set
 *   "Client Reference ID" → "Collect via URL parameter" in the link
 *   settings. The subscribe button on /chat / Pricing appends
 *   ?client_reference_id={user_id} so it lands in this webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { serverSupabaseAdmin } from "@/lib/supabase";

// Node runtime (not edge) — Stripe's Node SDK uses Node crypto for the
// signature check; the edge runtime doesn't ship a compatible API.
export const runtime = "nodejs";
// Webhook payloads must NOT be cached or pre-parsed — we need the raw
// body bytes exactly as Stripe sent them for the HMAC signature check.
export const dynamic = "force-dynamic";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  // No apiVersion pin — the Stripe SDK defaults to its latest known
  // version which matches the webhook payload schema we wrote against.
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: "missing stripe-signature header" },
      { status: 400 },
    );
  }
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  // Read raw body for signature verification.
  const rawBody = await req.text();

  let stripe: Stripe;
  let event: Stripe.Event;
  try {
    stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stripe/webhook] signature verify failed:", msg);
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  // Once we have a verified event, this WILL run with elevated DB
  // privilege. The 'sb' client uses the service role key.
  const sb = serverSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Resolve the user. Two paths:
        //   1. client_reference_id is set (warm flow — user was signed
        //      in on /chat when they hit the paywall and clicked Subscribe).
        //   2. Fall back to the Stripe checkout email (cold flow — user
        //      clicked Subscribe from the marketing site before signing
        //      up here). Auth + checkout share the same email.
        let userId: string | null = session.client_reference_id ?? null;
        const checkoutEmail = session.customer_details?.email
          || (session.customer_email as string | undefined)
          || null;
        if (!userId && checkoutEmail) {
          const { data: userRow } = await sb
            .from("users")
            .select("id")
            .eq("email", checkoutEmail.toLowerCase())
            .maybeSingle();
          userId = (userRow as { id?: string } | null)?.id ?? null;
        }
        if (!userId) {
          console.warn(
            "[stripe/webhook] checkout.session.completed unresolved — neither client_reference_id nor matching email",
            { email: checkoutEmail, session_id: session.id },
          );
          // Return 200 so Stripe doesn't retry forever — the user can
          // re-link by signing up and contacting support, or by hitting
          // /chat which will sync state via the next webhook event.
          break;
        }
        // Fetch the full subscription so we have current_period_end + status.
        let sub: Stripe.Subscription | null = null;
        if (session.subscription) {
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
          sub = await stripe.subscriptions.retrieve(subId);
        }
        const updates: Record<string, unknown> = {
          stripe_customer_id: typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null,
          stripe_subscription_id: sub?.id ?? null,
          subscription_status: sub?.status ?? "active",
          // Reset the free-quota counter on a successful paid checkout
          // — they paid, give them a clean period.
          period_consumed_cents: 0,
          period_billed_cents: 0,
        };
        if (sub) {
          if (sub.current_period_end) {
            updates.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
          }
          if (sub.current_period_start) {
            updates.current_period_start = new Date(sub.current_period_start * 1000).toISOString();
          }
        }
        // Don't overwrite admin tier — admins are exempt from Stripe state.
        // .neq("tier", "admin") gates the UPDATE at the row level so a
        // future Stripe event can't accidentally revoke admin access.
        const { error } = await sb
          .from("users")
          .update(updates)
          .eq("id", userId)
          .neq("tier", "admin");
        if (error) {
          console.error("[stripe/webhook] users update failed:", error);
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
        console.log(`[stripe/webhook] checkout completed for user ${userId}`);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === "string"
          ? sub.customer
          : sub.customer.id;
        const updates: Record<string, unknown> = {
          subscription_status: event.type === "customer.subscription.deleted"
            ? "canceled"
            : sub.status,
          stripe_subscription_id: sub.id,
        };
        if (sub.current_period_end) {
          updates.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        }
        // Same admin guard — never let a Stripe event revoke admin access.
        const { error } = await sb
          .from("users")
          .update(updates)
          .eq("stripe_customer_id", stripeCustomerId)
          .neq("tier", "admin");
        if (error) {
          console.error("[stripe/webhook] sub update failed:", error);
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
        console.log(`[stripe/webhook] sub ${event.type} for customer ${stripeCustomerId} → ${updates.subscription_status}`);
        break;
      }

      default:
        // Other events (invoice.*, customer.created, etc) we just ack.
        // Stripe will keep firing them; ignoring is cheap and lets us
        // expand handling later without re-subscribing.
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] handler threw:", msg);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, received: event.type });
}
