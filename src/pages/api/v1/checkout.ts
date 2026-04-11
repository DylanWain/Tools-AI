// Tools AI — POST /api/v1/checkout
//
// Body: { tier: 'chad' | 'payg' }
// Returns: { url: <Stripe Checkout Session URL> }
//
// Called by the extension's PaywallPanel when a user clicks
// "Subscribe to Chad" or "Set up Pay-as-you-go". We create (or reuse) the
// user's Stripe customer, open a subscription Checkout Session with the
// right line items, and hand the URL back. The extension opens it in the
// system browser and waits for the webhook to flip tier.

import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveBearer } from '../../../lib/billing/billingAuth';
import { supabaseAdmin } from '../../../lib/supabase';
import { createCheckoutSession, ensureCustomer } from '../../../lib/billing/stripe';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const authResult = await resolveBearer(req.headers.authorization);
  if (authResult.kind !== 'new_user') {
    return res.status(401).json({ error: 'Sign in required', code: 'UNAUTH' });
  }
  const user = authResult.user;

  const tier = (req.body?.tier || '').toString();
  if (tier !== 'chad' && tier !== 'payg') {
    return res.status(400).json({ error: "tier must be 'chad' or 'payg'" });
  }

  try {
    // Ensure we have a Stripe customer for this user.
    const customerId = await ensureCustomer({
      email: user.email,
      userId: user.id,
      existingCustomerId: user.stripe_customer_id,
    });
    if (customerId !== user.stripe_customer_id) {
      await supabaseAdmin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const { url } = await createCheckoutSession({
      tier: tier as 'chad' | 'payg',
      userId: user.id,
      customerId,
      email: user.email,
    });

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error('checkout error:', e?.message || e);
    return res.status(500).json({ error: 'Could not create checkout session', detail: e?.message });
  }
}
