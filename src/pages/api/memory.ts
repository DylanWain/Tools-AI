// ============================================================================
// Memory Search API - Search across ALL conversations
// Uses PostgreSQL text search (no OpenAI required)
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../lib/auth';
import { searchAllMemory } from '../../lib/memory-search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  try {
    const { query, limit = 20, conversationId } = req.body;

    if (!query) {
      return res.status(400).json({ error: { message: 'Search query required' } });
    }

    // Search using PostgreSQL (no OpenAI needed)
    const results = await searchAllMemory(user.id, query, conversationId, limit);

    res.json({
      results: results.map(r => ({
        messageId: r.messageId,
        conversationId: r.conversationId,
        conversationTitle: r.conversationTitle,
        content: r.content,
        sender: r.sender,
        createdAt: r.createdAt,
      })),
      totalFound: results.length,
      searchType: 'postgresql',
    });
  } catch (err) {
    console.error('Memory search error:', err);
    res.status(500).json({ error: { message: 'Search failed' } });
  }
}
