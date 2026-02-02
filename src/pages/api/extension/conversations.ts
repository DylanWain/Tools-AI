import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { platform, search, page = '1', limit = '20' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Search mode
      if (search && typeof search === 'string' && search.trim()) {
        const { data: results, error } = await supabaseAdmin
          .rpc('search_extension_messages', {
            search_user_id: user.id,
            search_query: search.trim(),
            result_limit: parseInt(limit as string),
          });

        if (error) throw error;
        return res.json({ results: results || [], type: 'search' });
      }

      // List conversations
      let query = supabaseAdmin
        .from('extension_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (platform && typeof platform === 'string') {
        query = query.eq('platform', platform);
      }

      const { data: conversations, error } = await query;
      if (error) throw error;

      // Get total count
      const { count } = await supabaseAdmin
        .from('extension_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get stats
      const { data: stats } = await supabaseAdmin
        .from('extension_conversations')
        .select('platform')
        .eq('user_id', user.id);

      const platformCounts: Record<string, number> = {};
      (stats || []).forEach(s => {
        platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
      });

      const { count: messageCount } = await supabaseAdmin
        .from('extension_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: fileCount } = await supabaseAdmin
        .from('extension_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: codeCount } = await supabaseAdmin
        .from('extension_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('has_code', true);

      res.json({
        conversations: conversations || [],
        total: count || 0,
        stats: {
          totalConversations: count || 0,
          totalMessages: messageCount || 0,
          totalFiles: fileCount || 0,
          totalCodeBlocks: codeCount || 0,
          platforms: platformCounts,
        },
        type: 'list',
      });
    } catch (err) {
      console.error('Extension conversations error:', err);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
