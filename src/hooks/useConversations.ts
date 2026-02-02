// ============================================================================
// useConversations Hook - Conversation management
// ============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Conversation, ConversationGroup, CreateConversationRequest } from '../types';
import { api } from '../lib/api';

interface UseConversationsReturn {
  conversations: Conversation[];
  conversationGroups: ConversationGroup[];
  currentConversation: Conversation | null;
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  selectConversation: (id: string) => void;
  createConversation: (options?: CreateConversationRequest) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  pinConversation: (id: string, pinned: boolean) => Promise<void>;
  loadConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;
}

// Helper to group conversations by date
function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groups: Record<string, Conversation[]> = {
    'Pinned': [],
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Previous 30 Days': [],
    'Older': [],
  };

  // Sort by lastMessageAt or updatedAt descending
  const sorted = [...conversations]
    .filter(c => !c.isArchived)
    .sort((a, b) => {
      const dateA = new Date(a.lastMessageAt || a.updatedAt);
      const dateB = new Date(b.lastMessageAt || b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    });

  for (const conv of sorted) {
    if (conv.isPinned) {
      groups['Pinned'].push(conv);
      continue;
    }

    const date = new Date(conv.lastMessageAt || conv.updatedAt);
    
    if (date >= today) {
      groups['Today'].push(conv);
    } else if (date >= yesterday) {
      groups['Yesterday'].push(conv);
    } else if (date >= lastWeek) {
      groups['Previous 7 Days'].push(conv);
    } else if (date >= lastMonth) {
      groups['Previous 30 Days'].push(conv);
    } else {
      groups['Older'].push(conv);
    }
  }

  // Return only non-empty groups
  return Object.entries(groups)
    .filter(([_, convs]) => convs.length > 0)
    .map(([label, conversations]) => ({ label, conversations }));
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.get<{ conversations: Conversation[] }>('/conversations');
      setConversations(response.conversations);
      
      // Auto-select first conversation if none selected
      if (!currentConversationId && response.conversations.length > 0) {
        const nonArchived = response.conversations.filter(c => !c.isArchived);
        if (nonArchived.length > 0) {
          setCurrentConversationId(nonArchived[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId]);

  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const createConversation = useCallback(async (
    options?: CreateConversationRequest
  ): Promise<Conversation> => {
    try {
      const response = await api.post<{ conversation: Conversation }>(
        '/conversations',
        options || {}
      );
      
      setConversations(prev => [response.conversation, ...prev]);
      setCurrentConversationId(response.conversation.id);
      
      return response.conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      throw err;
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.delete(`/conversations/${id}`);
      
      setConversations(prev => prev.filter(c => c.id !== id));
      
      // Select another conversation if current was deleted
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id && !c.isArchived);
        setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [conversations, currentConversationId]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      await api.patch(`/conversations/${id}`, { title });
      
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title } : c)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename conversation');
    }
  }, []);

  const archiveConversation = useCallback(async (id: string) => {
    try {
      await api.patch(`/conversations/${id}`, { isArchived: true });
      
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, isArchived: true } : c)
      );
      
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id && !c.isArchived);
        setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive conversation');
    }
  }, [conversations, currentConversationId]);

  const pinConversation = useCallback(async (id: string, pinned: boolean) => {
    try {
      await api.patch(`/conversations/${id}`, { isPinned: pinned });
      
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, isPinned: pinned } : c)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pin conversation');
    }
  }, []);

  // Computed values
  const conversationGroups = useMemo(
    () => groupConversations(conversations),
    [conversations]
  );

  const currentConversation = useMemo(
    () => conversations.find(c => c.id === currentConversationId) || null,
    [conversations, currentConversationId]
  );

  return {
    conversations,
    conversationGroups,
    currentConversation,
    currentConversationId,
    isLoading,
    error,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    pinConversation,
    loadConversations,
    refreshConversations: loadConversations, // Alias for convenience
  };
}
