// Tools AI — POST /api/v1/signup
//
// Creates a new user row, starts a 14-day Chad trial, issues a JWT.
// Called by the /loginDeepControl page when someone starts their free trial.
//
// Body: { email: string, password?: string, source?: 'desktop' | 'web' }
// Returns: { token: string, user: { id, email } }
//
// Password is optional — the desktop deep-link flow can onboard users with
// just an email (they set a password later via the account page). The web
// signup page always sends a password.

import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabase';
import { signJwt } from '../../../lib/billing/billingAuth';
import { env } from '../../../lib/billing/env';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, password, source = 'desktop' } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required', code: 'BAD_EMAIL' });
    }

    // If the user already exists, just issue a fresh JWT — no duplicate trial.
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, email, tier')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      const token = signJwt({ id: existing.id, email: existing.email });
      return res.status(200).json({
        token,
        user: { id: existing.id, email: existing.email, tier: existing.tier },
        alreadyExisted: true,
      });
    }

    // Create new user. hashed_password is nullable — desktop flow can skip it.
    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        hashed_password: hashedPassword,
        display_name: email.split('@')[0],
        tier: 'trial',
        hard_limit_cents: env.NEW_USER_HARD_CAP_CENTS(),
        onboarding_date: new Date().toISOString(),
      })
      .select('id, email')
      .single();

    if (userErr || !user) {
      console.error('signup: user insert failed:', userErr);
      return res.status(500).json({ error: 'Could not create user', code: 'INSERT_FAILED' });
    }

    // Start the 14-day trial row.
    const trialDays = env.TRIAL_DAYS();
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const { error: trialErr } = await supabaseAdmin.from('trials').insert({
      user_id: user.id,
      expires_at: expiresAt,
    });
    if (trialErr) {
      console.error('signup: trial insert failed:', trialErr);
      // Non-fatal — user is created, we can always seed the trial manually.
    }

    const token = signJwt({ id: user.id, email: user.email });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, tier: 'trial' },
      trialDays,
      source,
    });
  } catch (e: any) {
    console.error('signup error:', e?.message || e);
    return res.status(500).json({ error: 'Signup failed', detail: e?.message });
  }
}
