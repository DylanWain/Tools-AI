import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' as any });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: 'price_1TEbmkPMT1e1NaXsoND5Tlqb', quantity: 1 }],
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
