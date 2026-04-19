import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../../../lib/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS for Chrome extension
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password required' } });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if a row already exists for this email — might be a pre-password
    // account (e.g. created via the extension's device-id flow) that's never
    // had a password set. In that case, let the user claim it by setting the
    // password now. If a password is already set, 409 like before.
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, hashed_password, display_name')
      .eq('email', email)
      .maybeSingle();

    let user: { id: string; email: string; display_name: string | null } | null = null;

    if (existing) {
      if (existing.hashed_password) {
        return res.status(409).json({ error: { message: 'Email already registered' } });
      }
      // Claim the existing pre-password account.
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('users')
        .update({
          hashed_password: hashedPassword,
          display_name: displayName || existing.display_name || email.split('@')[0],
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updErr) throw updErr;
      user = updated;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          hashed_password: hashedPassword,
          display_name: displayName || email.split('@')[0],
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: { message: 'Email already registered' } });
        }
        throw error;
      }
      user = created;
    }

    if (!user) {
      return res.status(500).json({ error: { message: 'Registration failed' } });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: { message: 'Registration failed' } });
  }
}
