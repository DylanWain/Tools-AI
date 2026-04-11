// Tools AI — Stripe client + billing helpers.

import Stripe from 'stripe';
import { env } from './env';

let _client: Stripe | null = null;

export function stripe(): Stripe {
  if (_client) return _client;
  _client = new Stripe(env.STRIPE_SECRET_KEY(), {
    apiVersion: '2026-02-25.clover' as any,
  });
  return _client;
}

/**
 * Report a Stripe Billing Meter event. Fires when a Chad user goes over
 * their included allowance, or on every PAYG call. The value is the raw
 * upstream cost in cents; Stripe multiplies by the metered price rate
 * ($0.02 for Chad overage, $0.03 for PAYG).
 */
export async function reportMeterEvent(
  stripeCustomerId: string,
  value: number,
  idempotencyKey: string,
): Promise<string | null> {
  if (env.DEV_MODE()) {
    console.log(`[stripe dev] meter event skipped: customer=${stripeCustomerId} value=${value}`);
    return null;
  }
  if (!stripeCustomerId || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  try {
    const evt = await (stripe() as any).v1.billing.meterEvents.create(
      {
        event_name: env.STRIPE_METER_EVENT_NAME(),
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(value),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
      { idempotencyKey },
    );
    return evt?.identifier || null;
  } catch (e: any) {
    console.error('stripe meter event failed:', e?.message || e);
    return null;
  }
}

/**
 * Create a Checkout Session for the given tier.
 *
 * - chad: flat $25/mo + metered overage price, one subscription with both items
 * - payg: metered-only subscription, $0 base
 */
export async function createCheckoutSession(opts: {
  tier: 'chad' | 'payg';
  userId: string;
  customerId?: string | null;
  email: string;
}): Promise<{ url: string }> {
  if (env.DEV_MODE()) {
    return { url: `https://www.thetoolswebsite.com/_dev_checkout?tier=${opts.tier}` };
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    opts.tier === 'chad'
      ? [
          { price: env.STRIPE_PRICE_CHAD_FLAT(), quantity: 1 },
          { price: env.STRIPE_PRICE_CHAD_OVERAGE() },
        ]
      : [{ price: env.STRIPE_PRICE_PAYG() }];

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: opts.customerId || undefined,
    customer_email: opts.customerId ? undefined : opts.email,
    client_reference_id: opts.userId,
    line_items: lineItems,
    success_url: `${env.SUCCESS_URL()}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.CANCEL_URL(),
    subscription_data: {
      metadata: { user_id: opts.userId, tier: opts.tier },
    },
    metadata: { user_id: opts.userId, tier: opts.tier },
  });

  return { url: session.url || '' };
}

/**
 * Create a Customer Portal session. User lands on Stripe's hosted page
 * to update their payment method, view invoices, or cancel.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  if (env.DEV_MODE()) {
    return { url: 'https://www.thetoolswebsite.com/_dev_portal' };
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

/**
 * Ensure a Stripe customer exists for the given user. Idempotent.
 */
export async function ensureCustomer(opts: {
  email: string;
  userId: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (opts.existingCustomerId) return opts.existingCustomerId;
  if (env.DEV_MODE()) return `cus_dev_${opts.userId.slice(0, 8)}`;
  const customer = await stripe().customers.create({
    email: opts.email,
    metadata: { user_id: opts.userId },
  });
  return customer.id;
}

/**
 * Verify a webhook signature and parse the event. Throws if invalid.
 */
export function parseWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET(),
  );
}
