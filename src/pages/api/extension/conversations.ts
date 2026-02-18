// ============================================================================
// Dashboard API — reads from the SAME tables the Chrome extension writes to:
//   conversations, messages, code_blocks, files
// Queries by email OR user_id to show both extension + web app data
// ============================================================================

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

  // Build email for anonymous users (matches send.ts)
  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  if (req.method === 'GET') {
    try {
      const { platform, search, page = '1', limit = '20' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const lim = parseInt(limit as string);

      // Search mode — search messages content
      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        
        const { data: results, error } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, sender, content, created_at')
          .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
          .ilike('content', searchTerm)
          .order('created_at', { ascending: false })
          .limit(lim);

        if (error) throw error;
        return res.json({ results: results || [], type: 'search' });
      }

      // ═══════════════════════════════════════════════════════════
      // List conversations from the REAL conversations table
      // Extension saves with email, web app saves with user_id + email
      // ═══════════════════════════════════════════════════════════
      let query = supabaseAdmin
        .from('conversations')
        .select('*')
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
        .order('updated_at', { ascending: false })
        .range(offset, offset + lim - 1);

      if (platform && typeof platform === 'string' && platform !== 'all') {
        query = query.eq('platform', platform);
      }

      const { data: conversations, error } = await query;
      if (error) throw error;

      // Total count
      const { count } = await supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`);

      // Platform stats
      const { data: platformData } = await supabaseAdmin
        .from('conversations')
        .select('platform')
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`);

      const platformCounts: Record<string, number> = {};
      (platformData || []).forEach((s: any) => {
        const p = s.platform || 'unknown';
        platformCounts[p] = (platformCounts[p] || 0) + 1;
      });

      // Message count
      const { count: messageCount } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`);

      // File count
      const { count: fileCount } = await supabaseAdmin
        .from('files')
        .select('*', { count: 'exact', head: true })
        .or(`email.eq.${userEmail}`);

      // Code block count
      const { count: codeCount } = await supabaseAdmin
        .from('code_blocks')
        .select('*', { count: 'exact', head: true })
        .or(`email.eq.${userEmail}`);

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
    } catch (err: any) {
      console.error('Dashboard conversations error:', err);
      res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
