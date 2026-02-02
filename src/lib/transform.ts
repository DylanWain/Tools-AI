// Transform snake_case to camelCase for API responses

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

// Transform message from DB format to API format
export function transformMessage(msg: any) {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    userId: msg.user_id || '',
    sender: msg.sender,
    content: msg.content,
    hash: msg.hash || '',
    createdAt: msg.created_at,
    tokenCount: msg.token_count || null,
    model: msg.model || null,
    fileIds: msg.file_ids || [],
    metadata: msg.metadata || {},
  };
}

// Transform conversation from DB format to API format  
export function transformConversation(conv: any) {
  return {
    id: conv.id,
    userId: conv.user_id,
    folderId: conv.folder_id || null,
    title: conv.title,
    model: conv.model || 'gpt-4',
    provider: conv.provider || 'openai',
    systemInstruction: conv.system_instruction || null,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    lastMessageAt: conv.last_message_at || null,
    messageCount: conv.message_count || 0,
    totalTokens: conv.total_tokens || 0,
    isArchived: conv.is_archived || false,
    isPinned: conv.is_pinned || false,
    metadata: conv.metadata || {},
  };
}
