// Transform DB records to API response format
// Aligned with LIVE Supabase schema

// Transform message from DB format to API format
// LIVE: id(TEXT), conversation_id(TEXT), email(TEXT), sender, content,
//       content_hash, created_at, user_id(UUID), metadata(JSONB)
export function transformMessage(msg: any) {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    userId: msg.user_id || '',
    email: msg.email || '',
    sender: msg.sender,
    content: msg.content || '',
    contentHash: msg.content_hash || '',
    createdAt: msg.created_at,
    metadata: msg.metadata || {},
  };
}

// Transform conversation from DB format to API format
// LIVE: id(TEXT), email(TEXT), platform, title, url, message_count,
//       code_block_count, file_count, updated_at, created_at, user_id(UUID),
//       model, provider
export function transformConversation(conv: any) {
  return {
    id: conv.id,
    userId: conv.user_id || '',
    email: conv.email || '',
    title: conv.title || 'Untitled',
    model: conv.model || 'gpt-4o',
    provider: conv.provider || 'openai',
    platform: conv.platform || '',
    url: conv.url || '',
    messageCount: conv.message_count || 0,
    codeBlockCount: conv.code_block_count || 0,
    fileCount: conv.file_count || 0,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  };
}

// Generic snake_case to camelCase helpers
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function transformKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = transformKeys(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}
