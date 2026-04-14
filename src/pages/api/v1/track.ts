// Tools AI — POST /api/v1/track
// Lightweight analytics endpoint. Logs events to Supabase.
// No auth required — events are anonymous unless user_id is provided.
//
// Body: { event: string, properties?: object }
// Events: "download_click", "signup_start", "signup_complete",
//         "trial_started", "paywall_shown", "checkout_started"

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { event, properties } = req.body || {};
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'event string required' });
    }

    await supabaseAdmin.from('analytics_events').insert({
      event,
      properties: properties || {},
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    // Non-fatal — analytics should never break the user experience
    console.error('track error:', e?.message);
    return res.status(200).json({ ok: true });
  }
}
