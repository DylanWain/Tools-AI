// Tools AI — POST /api/v1/portal
//
// Returns: { url: <Stripe Customer Portal URL> }
//
// Called by the extension's AccountPanel "Manage billing" button. Opens
// the hosted Stripe portal where the user can update their card, view
// invoices, or cancel.

import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveBearer } from '../../../lib/billing/billingAuth';
import { createPortalSession } from '../../../lib/billing/stripe';

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
  if (!user.stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer — subscribe first', code: 'NO_CUSTOMER' });
  }

  try {
    const returnUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thetoolswebsite.com') + '/account';
    const { url } = await createPortalSession(user.stripe_customer_id, returnUrl);
    return res.status(200).json({ url });
  } catch (e: any) {
    console.error('portal error:', e?.message || e);
    return res.status(500).json({ error: 'Could not open billing portal', detail: e?.message });
  }
}
