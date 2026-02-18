import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { verifyToken } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  try {
    const { query, conversationId, limit = 20 } = req.body;

    if (!query) {
      return res.status(400).json({ error: { message: 'Search query required' } });
    }

    // Search messages - no FK join, query by user_id or email
    let queryBuilder = supabaseAdmin
      .from('messages')
      .select('id, sender, content, created_at, conversation_id')
      .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (conversationId) {
      queryBuilder = queryBuilder.eq('conversation_id', conversationId);
    }

    const { data: results, error } = await queryBuilder;

    if (error) throw error;

    res.json({
      results: results || [],
      totalFound: results?.length || 0,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: { message: 'Search failed' } });
  }
}
