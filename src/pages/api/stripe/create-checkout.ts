import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' as any });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const DEFAULT_PRICE_ID = 'price_1TEbmkPMT1e1NaXsoND5Tlqb'; // $25/month
const PRODUCT_ID = 'prod_U2F52rttfOQ1wG'; // Tools AI VS Code Extension

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Check for per-user pricing override in vscode_subscriptions
    const { data: sub } = await supabase
      .from('vscode_subscriptions')
      .select('price_cents, free_override')
      .eq('email', email)
      .maybeSingle();

    // Free override — no Stripe needed, just generate the key directly
    if (sub?.free_override) {
      const crypto = require('crypto');
      const key = 'tai-' + crypto.randomBytes(16).toString('hex');
      const { data: existing } = await supabase
        .from('tai_keys')
        .select('api_key')
        .eq('user_email', email)
        .eq('active', true)
        .maybeSingle();

      if (!existing) {
        await supabase.from('tai_keys').insert({
          api_key: key,
          user_email: email,
          plan: 'vscode',
          active: true,
        });
      }

      const finalKey = existing?.api_key || key;
      const successUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe?success=true&email=${encodeURIComponent(email)}&free=true`;
      return res.status(200).json({ url: successUrl, free: true, key: finalKey });
    }

    // Determine price
    let priceId = DEFAULT_PRICE_ID;
    const priceCents = sub?.price_cents;

    if (priceCents && priceCents !== 2500) {
      // Create a dynamic one-time Stripe price for custom amounts
      const customPrice = await stripe.prices.create({
        unit_amount: priceCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        product: PRODUCT_ID,
      });
      priceId = customPrice.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe?success=true&email=${encodeURIComponent(email)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe?cancelled=true`,
      metadata: { email },
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
