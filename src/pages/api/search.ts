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

  try {
    const { query, conversationId, limit = 20 } = req.body;

    if (!query) {
      return res.status(400).json({ error: { message: 'Search query required' } });
    }

    // Text search in messages
    let queryBuilder = supabaseAdmin
      .from('messages')
      .select(`
        id,
        role,
        content,
        created_at,
        conversation_id,
        conversations!inner(id, title, user_id)
      `)
      .eq('conversations.user_id', user.id)
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
