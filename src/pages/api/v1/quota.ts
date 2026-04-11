// Tools AI — GET /api/v1/quota
//
// Desktop client polls this every 5 minutes. Shape must match QuotaService
// in tools-ai/src/quotaService.ts. For legacy tai-xxx users (existing
// paying customers) we return a 'none' tier so the extension's status bar
// shows the signed-out state — those users don't see the new billing UI.

import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveBearer } from '../../../lib/billing/billingAuth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const result = await resolveBearer(req.headers.authorization);

  // Legacy tai-xxx, anonymous, or unauth → empty quota.
  if (result.kind !== 'new_user') {
    return res.status(200).json({
      tier: 'none',
      trialDaysRemaining: null,
      consumedCents: 0,
      includedCents: 0,
      hardLimitCents: null,
    });
  }

  const user = result.user;
  let trialDaysRemaining: number | null = null;
  if (user.tier === 'trial') {
    const { data } = await supabaseAdmin
      .from('trials')
      .select('expires_at')
      .eq('user_id', user.id)
      .is('ended_reason', null)
      .maybeSingle();
    if (data?.expires_at) {
      const ms = new Date(data.expires_at).getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }
  }

  // NOTE: includedCents is intentionally returned as 0 to the client.
  // The $15 Chad threshold is hidden from users (see paywallPanel copy).
  return res.status(200).json({
    tier: user.tier,
    trialDaysRemaining,
    consumedCents: user.period_billed_cents || 0,
    includedCents: 0,
    hardLimitCents: user.hard_limit_cents,
  });
}
