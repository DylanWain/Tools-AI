// ============================================================================
// Memory Search - Works with ANY AI provider (no OpenAI required)
// Uses PostgreSQL text search - NO foreign key joins (live DB has no FKs)
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
 * Helper to get conversation titles for a set of conversation IDs
 */
async function getConversationTitles(conversationIds: string[]): Promise<Record<string, string>> {
  if (conversationIds.length === 0) return {};
  
  const uniqueIds = [...new Set(conversationIds)];
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id, title')
    .in('id', uniqueIds);
  
  const titleMap: Record<string, string> = {};
  for (const conv of data || []) {
    titleMap[conv.id] = conv.title || 'Untitled';
  }
  return titleMap;
}

/**
 * Build user filter for queries (user_id or email)
 */
function getUserFilter(userId: string, userEmail?: string): string {
  if (userEmail) {
    return `user_id.eq.${userId},email.eq.${userEmail}`;
  }
  return `user_id.eq.${userId}`;
}

/**
 * Full-text search across all user's messages
 */
export async function searchAllMemory(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20,
  userEmail?: string
): Promise<MemoryResult[]> {
  try {
    // Method 1: keyword search (most reliable)
    const results = await keywordSearch(userId, query, excludeConversationId, limit, userEmail);
    if (results.length > 0) {
      console.log(`Keyword search found ${results.length} results`);
      return results;
    }

    // Method 2: fuzzy search (handles typos)
    const fuzzyResults = await fuzzySearch(userId, query, excludeConversationId, limit, userEmail);
    if (fuzzyResults.length > 0) {
      console.log(`Fuzzy search found ${fuzzyResults.length} results`);
      return fuzzyResults;
    }

    // Method 3: recent messages as fallback
    const recentResults = await getRecentFromAllConversations(userId, excludeConversationId, limit, userEmail);
    console.log(`Loaded ${recentResults.length} recent messages as fallback`);
    return recentResults;

  } catch (error) {
    console.error('searchAllMemory error:', error);
    return [];
  }
}

/**
 * Simple keyword search using ILIKE - most reliable method
 */
async function keywordSearch(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20,
  userEmail?: string
): Promise<MemoryResult[]> {
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    const orConditions = keywords.map(k => `content.ilike.%${k}%`).join(',');

    let queryBuilder = supabaseAdmin
      .from('messages')
      .select('id, conversation_id, content, sender, created_at')
      .or(getUserFilter(userId, userEmail))
      .or(orConditions)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;
    if (error || !data) return [];

    // Get titles for conversations
    const titleMap = await getConversationTitles(data.map(m => m.conversation_id));

    return data.map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: titleMap[m.conversation_id] || 'Unknown',
      content: m.content || '',
      sender: m.sender || 'unknown',
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error('keywordSearch error:', err);
    return [];
  }
}

/**
 * Fuzzy search - handles typos
 */
async function fuzzySearch(
  userId: string,
  query: string,
  excludeConversationId?: string,
  limit: number = 20,
  userEmail?: string
): Promise<MemoryResult[]> {
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (keywords.length === 0) return [];

    let queryBuilder = supabaseAdmin
      .from('messages')
      .select('id, conversation_id, content, sender, created_at')
      .or(getUserFilter(userId, userEmail))
      .order('created_at', { ascending: false })
      .limit(200);

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;
    if (error || !data) return [];

    const isSimilar = (word1: string, word2: string): boolean => {
      if (word1 === word2) return true;
      if (Math.abs(word1.length - word2.length) > 2) return false;
      if (word1.includes(word2) || word2.includes(word1)) return true;
      
      let differences = 0;
      const shorter = word1.length < word2.length ? word1 : word2;
      const longer = word1.length < word2.length ? word2 : word1;
      let j = 0;
      for (let i = 0; i < longer.length && j < shorter.length; i++) {
        if (longer[i] === shorter[j]) j++;
        else differences++;
      }
      differences += shorter.length - j;
      return differences <= 2;
    };

    const matches = data.filter(m => {
      const contentWords: string[] = (m.content || '').toLowerCase().split(/\s+/);
      return keywords.some((kw: string) => 
        contentWords.some((cw: string) => isSimilar(kw, cw))
      );
    });

    const titleMap = await getConversationTitles(matches.map(m => m.conversation_id));

    return matches.slice(0, limit).map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: titleMap[m.conversation_id] || 'Unknown',
      content: m.content || '',
      sender: m.sender || 'unknown',
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error('fuzzySearch error:', err);
    return [];
  }
}

/**
 * Get recent messages from ALL conversations as fallback context
 */
async function getRecentFromAllConversations(
  userId: string,
  excludeConversationId?: string,
  limit: number = 20,
  userEmail?: string
): Promise<MemoryResult[]> {
  try {
    let queryBuilder = supabaseAdmin
      .from('messages')
      .select('id, conversation_id, content, sender, created_at')
      .or(getUserFilter(userId, userEmail))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (excludeConversationId) {
      queryBuilder = queryBuilder.neq('conversation_id', excludeConversationId);
    }

    const { data, error } = await queryBuilder;
    if (error || !data) return [];

    const titleMap = await getConversationTitles(data.map(m => m.conversation_id));

    return data.map(m => ({
      messageId: m.id,
      conversationId: m.conversation_id,
      conversationTitle: titleMap[m.conversation_id] || 'Unknown',
      content: m.content || '',
      sender: m.sender || 'unknown',
      createdAt: m.created_at,
    }));
  } catch (err) {
    console.error('getRecentFromAllConversations error:', err);
    return [];
  }
}

/**
 * Get conversation summaries
 */
export async function getConversationSummaries(
  userId: string,
  limit: number = 10,
  userEmail?: string
): Promise<Array<{ id: string; title: string; lastMessage: string; updatedAt: string }>> {
  try {
    let queryBuilder = supabaseAdmin
      .from('conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (userEmail) {
      queryBuilder = queryBuilder.or(`user_id.eq.${userId},email.eq.${userEmail}`);
    } else {
      queryBuilder = queryBuilder.eq('user_id', userId);
    }

    const { data, error } = await queryBuilder;
    if (error || !data) return [];

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
          title: conv.title || 'Untitled',
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
 */
export async function buildMemoryContext(
  userId: string,
  currentConversationId: string,
  userQuery: string,
  userEmail?: string
): Promise<string> {
  const queryLower = userQuery.toLowerCase().trim();
  
  const skipMemoryPatterns = [
    /^(hi|hello|hey|sup|yo)[\s!.]*$/i,
    /^good (morning|afternoon|evening|night)[\s!.]*$/i,
    /^thanks?( you)?[\s!.]*$/i,
    /^(ok|okay|got it|understood|sure|yes|no|yep|nope)[\s!.]*$/i,
    /^(new topic|different question|unrelated|changing subject)/i,
  ];
  
  const shouldSkip = skipMemoryPatterns.some(pattern => pattern.test(queryLower));
  const wordCount = queryLower.split(/\s+/).length;
  const isTooShort = wordCount <= 2 && !queryLower.includes('my') && !queryLower.includes('the');
  
  if (shouldSkip || isTooShort) {
    return '';
  }
  
  const memories = await searchAllMemory(userId, userQuery, currentConversationId, 15, userEmail);

  if (memories.length === 0) return '';

  const byConversation = new Map<string, MemoryResult[]>();
  for (const m of memories) {
    const existing = byConversation.get(m.conversationId) || [];
    existing.push(m);
    byConversation.set(m.conversationId, existing);
  }

  let context = '';
  let convIndex = 1;
  
  for (const [, messages] of byConversation.entries()) {
    const title = messages[0]?.conversationTitle || 'Previous conversation';
    const date = messages[0]?.createdAt 
      ? new Date(messages[0].createdAt).toLocaleDateString()
      : '';
    
    context += `\n[Previous Conversation ${convIndex}: "${title}" - ${date}]\n`;
    
    for (const msg of messages.slice(0, 3)) {
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
