import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Insert email only — no source column (table may not have it)
    const { error } = await supabaseAdmin
      .from('waitlist')
      .upsert(
        { email: cleanEmail },
        { onConflict: 'email' }
      );

    if (error) {
      // Duplicate is fine
      if (error.code === '23505') {
        return res.status(200).json({ success: true, message: "You're already on the list!" });
      }
      throw error;
    }

    res.status(200).json({ success: true, message: "You're on the list!" });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
}
