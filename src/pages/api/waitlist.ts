import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, source } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .upsert(
        { email: email.toLowerCase().trim(), source: source || 'landing' },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, message: "You're on the list!" });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
}
