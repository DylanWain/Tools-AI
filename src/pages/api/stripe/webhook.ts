// Tools AI — POST /api/stripe/webhook
//
// Handles Stripe webhook events for BOTH the legacy tai_keys subscription
// flow AND the new users/subscriptions billing flow. The two flows are
// distinguished by the metadata.user_id we set on new-billing checkouts:
//
//   - If checkout.session.completed has metadata.user_id → new billing,
//     update users + subscriptions tables.
//   - If checkout.session.completed has metadata.email (old format) or
//     customer_email → legacy flow, insert a tai_keys row.
//
// This preserves existing paying customers while extending support for
// trial/Chad/PAYG. Six events are wired (set in Stripe dashboard):
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_succeeded
//   invoice.payment_failed

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

// NOTE: intentionally using createClient directly (not supabaseAdmin helper)
// because webhook.ts runs in a separate serverless lambda with a distinct
// cold-start path — keeping this self-contained matches the existing style.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return res.status(400).json({ error: `Webhook error: ${e.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('unhandled webhook event:', event.type);
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error('webhook handler error:', e?.message || e);
    return res.status(500).json({ error: 'handler failed', detail: e?.message });
  }
}

// ─── Handlers ───────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // NEW-BILLING flow: metadata.user_id + metadata.tier set by createCheckoutSession()
  const newUserId = (session.metadata as any)?.user_id;
  const newTier = (session.metadata as any)?.tier;

  if (newUserId && (newTier === 'chad' || newTier === 'payg')) {
    // Activate the new-billing user's subscription.
    if (session.customer) {
      await supabase
        .from('users')
        .update({ stripe_customer_id: session.customer as string })
        .eq('id', newUserId);
    }
    await supabase
      .from('users')
      .update({
        tier: newTier,
        stripe_subscription_id: (session.subscription as string) || null,
        subscription_status: 'active',
      })
      .eq('id', newUserId);

    // Mark any active trial as upgraded.
    await supabase
      .from('trials')
      .update({ ended_reason: 'upgraded' })
      .eq('user_id', newUserId)
      .is('ended_reason', null);

    return;
  }

  // LEGACY flow: email-based tai_keys generation (preserves existing behaviour).
  const email = session.customer_email || (session.metadata as any)?.email;
  if (!email) return;

  const { data: existing } = await supabase
    .from('tai_keys')
    .select('api_key')
    .eq('user_email', email)
    .eq('active', true)
    .maybeSingle();

  if (!existing) {
    const key = 'tai-' + crypto.randomBytes(16).toString('hex');
    await supabase.from('tai_keys').insert({
      api_key: key,
      user_email: email,
      plan: 'vscode',
      active: true,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
    });
  }
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const userId = (sub.metadata as any)?.user_id;
  const tier = (sub.metadata as any)?.tier;

  // Only mirror new-billing subscriptions — legacy tai_keys are email-scoped.
  if (!userId || (tier !== 'chad' && tier !== 'payg')) return;

  // Stripe SDK v17+ removed the top-level current_period_* types from
  // Subscription (they're on subscription items now). Cast to any — the
  // runtime payload still has them on both old and new API versions.
  const subAny = sub as any;
  const periodStartUnix =
    subAny.current_period_start ?? subAny.items?.data?.[0]?.current_period_start ?? null;
  const periodEndUnix =
    subAny.current_period_end ?? subAny.items?.data?.[0]?.current_period_end ?? null;

  const row = {
    stripe_subscription_id: sub.id,
    user_id: userId,
    tier,
    status: sub.status,
    current_period_start: periodStartUnix
      ? new Date(periodStartUnix * 1000).toISOString()
      : null,
    current_period_end: periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
  await supabase.from('subscriptions').upsert(row);

  // Mirror relevant fields onto users so the quota endpoint stays fast.
  const patch: Record<string, any> = {
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    current_period_start: row.current_period_start,
    current_period_end: row.current_period_end,
  };
  if (sub.status === 'active' || sub.status === 'trialing') {
    patch.tier = tier; // chad | payg
  } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
    patch.tier = 'suspended';
  }
  await supabase.from('users').update(patch).eq('id', userId);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  // New-billing path — mark the subscription row canceled and flip user to expired.
  const userId = (sub.metadata as any)?.user_id;
  if (userId) {
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id);
    await supabase
      .from('users')
      .update({ tier: 'expired', subscription_status: 'canceled' })
      .eq('id', userId);
  }

  // LEGACY path — mirrors the existing behaviour of marking tai_keys inactive.
  try {
    const customer = (await stripe.customers.retrieve(sub.customer as string)) as Stripe.Customer;
    if (customer?.email) {
      await supabase
        .from('tai_keys')
        .update({ active: false })
        .eq('user_email', customer.email)
        .eq('plan', 'vscode');
    }
  } catch {
    // customer retrieve can fail if deleted; ignore
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) return;

  // Only new-billing subscriptions exist in the subscriptions table.
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!data) return;

  // Reset the period counters so the new billing cycle starts fresh.
  const periodStartRaw = invoice.period_start || invoice.lines?.data?.[0]?.period?.start;
  const periodEndRaw = invoice.period_end || invoice.lines?.data?.[0]?.period?.end;
  const periodStart = periodStartRaw ? new Date(periodStartRaw * 1000).toISOString() : new Date().toISOString();
  const periodEnd = periodEndRaw ? new Date(periodEndRaw * 1000).toISOString() : new Date().toISOString();

  await supabase.rpc('reset_period', {
    p_user_id: data.user_id,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) return;

  // New-billing user: suspend them. Next /api/v1/chat call returns 402 →
  // the extension's paywall modal fires with "Update payment method" CTA.
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (data) {
    await supabase
      .from('users')
      .update({ tier: 'suspended', subscription_status: 'past_due' })
      .eq('id', data.user_id);
    return;
  }

  // LEGACY tai_keys users: also mark inactive on payment failure so the
  // silent cap + active check blocks further use until they update their card.
  // (Previously there was no handler for this; adding it as an improvement.)
  try {
    if (!invoice.customer) return;
    const customer = (await stripe.customers.retrieve(invoice.customer as string)) as Stripe.Customer;
    if (customer?.email) {
      await supabase
        .from('tai_keys')
        .update({ active: false })
        .eq('user_email', customer.email)
        .eq('plan', 'vscode');
    }
  } catch {
    // ignore
  }
}
