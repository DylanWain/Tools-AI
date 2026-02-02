// ============================================================================
// Debug API - Check memory system status
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { verifyToken } from '../../lib/auth';
import { searchAllMemory } from '../../lib/memory-search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  if (req.method === 'GET') {
    try {
      // Count messages
      const { count: messageCount } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count conversations
      const { count: conversationCount } = await supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count files
      const { count: fileCount } = await supabaseAdmin
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get recent messages
      const { data: recentMessages } = await supabaseAdmin
        .from('messages')
        .select('id, content, sender, created_at, conversation_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      res.json({
        userId: user.id,
        stats: {
          messages: messageCount || 0,
          conversations: conversationCount || 0,
          files: fileCount || 0,
        },
        recentMessages: (recentMessages || []).map(m => ({
          id: m.id,
          preview: m.content?.slice(0, 100),
          sender: m.sender,
          createdAt: m.created_at,
        })),
        memorySystem: 'PostgreSQL text search (no OpenAI required)',
        status: messageCount && messageCount > 0 ? 'Memory system active' : 'No messages yet',
      });
    } catch (err: any) {
      console.error('Debug error:', err);
      res.status(500).json({ error: { message: err.message } });
    }
  } else if (req.method === 'POST') {
    // Test memory search
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ error: { message: 'query required' } });
      }

      console.log(`Testing memory search for: "${query}"`);

      // Test the search
      const results = await searchAllMemory(user.id, query, undefined, 10);

      res.json({
        success: true,
        query,
        resultsFound: results.length,
        results: results.map(r => ({
          contentPreview: r.content?.slice(0, 200) + '...',
          conversationId: r.conversationId,
          conversationTitle: r.conversationTitle,
          sender: r.sender,
          createdAt: r.createdAt,
        })),
      });
    } catch (err: any) {
      console.error('Memory test error:', err);
      res.status(500).json({ 
        success: false,
        error: err.message,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
