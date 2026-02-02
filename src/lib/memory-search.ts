// ============================================================================
// Memory Search - Works with ANY AI provider (no OpenAI required)
// Uses PostgreSQL full-text search built into Supabase
// ============================================================================

import { supabaseAdmin } from './supabase';

interface MemoryResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  sender: string;
  createdAt: string;
  rank?: number;
}

/**
 * Full-text search across all user's messages
 * Uses PostgreSQL's built-in text search - no external API needed
 */
export async function searchAllMemory(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20
): Promise<MemoryResult[]> {
  try {
    // Method 1: Try full-text search first
    const results = await fullTextSearch(userId, query, excludeConversationId, limit);
    if (results.length > 0) {
      console.log(`Full-text search found ${results.length} results`);
      return results;
    }

    // Method 2: Try keyword search
    const keywordResults = await keywordSearch(userId, query, excludeConversationId, limit);
    if (keywordResults.length > 0) {
      console.log(`Keyword search found ${keywordResults.length} results`);
      return keywordResults;
    }

    // Method 3: Try fuzzy search (handles typos)
    const fuzzyResults = await fuzzySearch(userId, query, excludeConversationId, limit);
    if (fuzzyResults.length > 0) {
      console.log(`Fuzzy search found ${fuzzyResults.length} results (typo correction)`);
      return fuzzyResults;
    }

    // Method 4: Get recent messages from other conversations as context
    const recentResults = await getRecentFromAllConversations(userId, excludeConversationId, limit);
    console.log(`Loaded ${recentResults.length} recent messages as fallback`);
    return recentResults;

  } catch (error) {
    console.error('searchAllMemory error:', error);
    return [];
  }
}

/**
 * PostgreSQL full-text search
 */
async function fullTextSearch(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20
): Promise<MemoryResult[]> {
  try {
    // Convert query to tsquery format
    const searchTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' | '); // OR search

    if (!searchTerms) return [];

    let queryBuilder = supabaseAdmin
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        sender,
        created_at,
        conversations(title)
      `)
      .eq('user_id', userId)
      .textSearch('content', searchTerms, { type: 'websearch' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.log('Full-text search not available, falling back:', error.message);
      return [];
    }

    return (data || []).map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: (m.conversations as any)?.title || 'Unknown',
      content: m.content,
      sender: m.sender,
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.log('fullTextSearch error:', err);
    return [];
  }
}

/**
 * Simple keyword search using ILIKE
 */
async function keywordSearch(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20
): Promise<MemoryResult[]> {
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    // Build OR conditions for each keyword
    const orConditions = keywords.map(k => `content.ilike.%${k}%`).join(',');

    let queryBuilder = supabaseAdmin
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        sender,
        created_at,
        conversations(title)
      `)
      .eq('user_id', userId)
      .or(orConditions)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Keyword search error:', error);
      return [];
    }

    return (data || []).map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: (m.conversations as any)?.title || 'Unknown',
      content: m.content,
      sender: m.sender,
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error('keywordSearch error:', err);
    return [];
  }
}

/**
 * Fuzzy search - handles typos using word similarity
 * Matches "coe" to "code", "secrt" to "secret", etc.
 */
async function fuzzySearch(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20
): Promise<MemoryResult[]> {
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (keywords.length === 0) return [];

    // Get all recent messages and filter client-side with fuzzy matching
    let queryBuilder = supabaseAdmin
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        sender,
        created_at,
        conversations(title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200); // Get more to filter

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;

    if (error || !data) return [];

    // Fuzzy match helper - checks if words are similar
    const isSimilar = (word1: string, word2: string): boolean => {
      if (word1 === word2) return true;
      if (Math.abs(word1.length - word2.length) > 2) return false;
      
      // Check if one contains the other
      if (word1.includes(word2) || word2.includes(word1)) return true;
      
      // Simple Levenshtein-like check (1-2 char difference)
      let differences = 0;
      const shorter = word1.length < word2.length ? word1 : word2;
      const longer = word1.length < word2.length ? word2 : word1;
      
      let j = 0;
      for (let i = 0; i < longer.length && j < shorter.length; i++) {
        if (longer[i] === shorter[j]) {
          j++;
        } else {
          differences++;
        }
      }
      differences += shorter.length - j;
      
      return differences <= 2;
    };

    // Filter messages that contain similar words
    const matches = data.filter(m => {
      const contentWords: string[] = m.content.toLowerCase().split(/\s+/);
      return keywords.some((kw: string) => 
        contentWords.some((cw: string) => isSimilar(kw, cw))
      );
    });

    return matches.slice(0, limit).map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: (m.conversations as any)?.title || 'Unknown',
      content: m.content,
      sender: m.sender,
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error('fuzzySearch error:', err);
    return [];
  }
}

/**
 * Get recent messages from ALL conversations (not just current one)
 * Useful as fallback context
 */
async function getRecentFromAllConversations(
  userId: string,
  excludeConversationId?: string,
  limit: number = 20
): Promise<MemoryResult[]> {
  try {
    let queryBuilder = supabaseAdmin
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        sender,
        created_at,
        conversations(title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Recent messages error:', error);
      return [];
    }

    return (data || []).map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: (m.conversations as any)?.title || 'Unknown',
      content: m.content,
      sender: m.sender,
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error('getRecentFromAllConversations error:', err);
    return [];
  }
}

/**
 * Get conversation summaries for quick context
 */
export async function getConversationSummaries(
  userId: string,
  limit: number = 10
): Promise<Array<{ id: string; title: string; lastMessage: string; updatedAt: string }>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    // Get last message from each conversation
    const summaries = await Promise.all(
      data.map(async (conv) => {
        const { data: lastMsg } = await supabaseAdmin
          .from('messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: conv.id,
          title: conv.title,
          lastMessage: lastMsg?.content?.slice(0, 200) || '',
          updatedAt: conv.updated_at,
        };
      })
    );

    return summaries;
  } catch (err) {
    console.error('getConversationSummaries error:', err);
    return [];
  }
}

/**
 * Build memory context string for AI prompt
 * Only searches when query seems to reference past information
 */
export async function buildMemoryContext(
  userId: string,
  currentConversationId: string,
  userQuery: string
): Promise<string> {
  const queryLower = userQuery.toLowerCase().trim();
  
  // SKIP memory search ONLY for these obvious standalone queries
  // Everything else gets memory search
  const skipMemoryPatterns = [
    // Simple greetings (exact or near-exact)
    /^(hi|hello|hey|sup|yo)[\s!.]*$/i,
    /^good (morning|afternoon|evening|night)[\s!.]*$/i,
    /^thanks?( you)?[\s!.]*$/i,
    /^(ok|okay|got it|understood|sure|yes|no|yep|nope)[\s!.]*$/i,
    
    // Pure how-to questions with no personal reference
    /^how (do|does|to|can|would) (i|you|we|one) .{0,20}(in general|typically|usually)/i,
    
    // Explicit "new topic" indicators
    /^(new topic|different question|unrelated|changing subject)/i,
  ];
  
  // Check if this is a simple standalone query we should skip
  const shouldSkip = skipMemoryPatterns.some(pattern => pattern.test(queryLower));
  
  // Also skip very short queries (under 3 words) that are likely greetings
  const wordCount = queryLower.split(/\s+/).length;
  const isTooShort = wordCount <= 2 && !queryLower.includes('my') && !queryLower.includes('the');
  
  if (shouldSkip || isTooShort) {
    console.log('Skipping memory search - standalone query');
    return '';
  }
  
  // ALWAYS search memory for everything else
  console.log('Searching memory for context...');
  const memories = await searchAllMemory(userId, userQuery, currentConversationId, 15);

  if (memories.length === 0) {
    return '';
  }

  // Group by conversation for cleaner context
  const byConversation = new Map<string, MemoryResult[]>();
  for (const m of memories) {
    const existing = byConversation.get(m.conversationId) || [];
    existing.push(m);
    byConversation.set(m.conversationId, existing);
  }

  // Format for AI
  let context = '';
  let convIndex = 1;
  
  const conversations = Array.from(byConversation.entries());
  for (const [_convId, messages] of conversations) {
    const title = messages[0]?.conversationTitle || 'Previous conversation';
    const date = messages[0]?.createdAt 
      ? new Date(messages[0].createdAt).toLocaleDateString()
      : '';
    
    context += `\n[Previous Conversation ${convIndex}: "${title}" - ${date}]\n`;
    
    for (const msg of messages.slice(0, 3)) { // Max 3 messages per conversation
      const role = msg.sender === 'user' ? 'User' : 'Assistant';
      const preview = msg.content.length > 500 
        ? msg.content.slice(0, 500) + '...' 
        : msg.content;
      context += `${role}: ${preview}\n`;
    }
    
    context += '\n---\n';
    convIndex++;
  }

  return context;
}
