import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' as any });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_email || session.metadata?.email;
    if (!email) return res.status(200).json({ received: true });

    const { data: existing } = await supabase
      .from('tai_keys')
      .select('api_key')
      .eq('user_email', email)
      .eq('active', true)
      .single();

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

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
    if (customer.email) {
      await supabase
        .from('tai_keys')
        .update({ active: false })
        .eq('user_email', customer.email)
        .eq('plan', 'vscode');
    }
  }

  return res.status(200).json({ received: true });
}
