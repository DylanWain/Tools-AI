// ============================================================================
// useServerChat - Server-backed chat with Supabase persistence
// Saves all messages to database, builds context from history
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  files?: Array<{
    id: string;
    filename: string;
    fileType: string;
    downloadUrl: string;
  }>;
  zipUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'google';
  createdAt: string;
  updatedAt: string;
}

export function useServerChat() {
  const { token, apiKeys, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [freeTierExhausted, setFreeTierExhausted] = useState(false);

  // Set token on api client when auth changes
  useEffect(() => {
    api.setToken(token);
  }, [token]);

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      setConversations([]);
      setMessages([]);
      setCurrentConversationId(null);
    }
  }, [isAuthenticated]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId && isAuthenticated) {
      loadMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId, isAuthenticated]);

  const loadConversations = async () => {
    try {
      const response = await api.get<{ conversations: any[] }>('/conversations');
      const convs = response.conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        model: c.model || 'gpt-4o',
        provider: c.provider || 'openai',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      setConversations(convs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await api.get<{ messages: any[] }>(`/conversations/${conversationId}`);
      const msgs: Message[] = (response.messages || []).map((m: any) => ({
        id: m.id,
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
        // Include files from metadata if present
        files: m.metadata?.files?.map((f: any) => ({
          id: f.id,
          filename: f.filename,
          fileType: f.fileType,
          downloadUrl: `/api/files/${f.id}`,
        })),
        zipUrl: m.metadata?.zipUrl,
      }));
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

  // Create new chat
  const createNewChat = useCallback(async (model = 'gpt-4o', provider: 'openai' | 'anthropic' | 'google' = 'openai') => {
    try {
      const response = await api.post<{ conversation: any }>('/conversations', {
        title: 'New chat',
        model,
        provider,
      });
      
      const newConv: Conversation = {
        id: response.conversation.id,
        title: response.conversation.title,
        model: response.conversation.model || model,
        provider: response.conversation.provider || provider,
        createdAt: response.conversation.createdAt,
        updatedAt: response.conversation.updatedAt,
      };
      
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversationId(newConv.id);
      setMessages([]);
      
      return newConv;
    } catch (err) {
      console.error('Failed to create chat:', err);
      throw err;
    }
  }, []);

  // Select conversation
  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setError(null);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.delete(`/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        setCurrentConversationId(remaining[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [conversations, currentConversationId]);

  // Send message - calls our API which saves to Supabase and calls AI
  const sendMessage = useCallback(async (content: string, model?: string, provider?: 'openai' | 'anthropic' | 'google') => {
    let conv = currentConversation;
    
    // Create new conversation if none exists
    if (!conv) {
      conv = await createNewChat(model || 'gpt-4o', provider || 'openai');
    }

    const useProvider = provider || conv.provider;
    const apiKey = apiKeys[useProvider] || null; // Allow null for free tier

    setError(null);
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Call our API which saves to Supabase and calls AI
      const response = await api.post<{
        userMessage: any;
        assistantMessage: any & { files?: any[]; zipUrl?: string };
      }>('/messages/send', {
        conversationId: conv.id,
        content,
        apiKey, // Send user's API key (or null for free tier)
      });

      // Replace temp message with real ones
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [
          ...filtered,
          {
            id: response.userMessage.id,
            role: 'user' as const,
            content: response.userMessage.content,
            createdAt: response.userMessage.createdAt,
          },
          {
            id: response.assistantMessage.id,
            role: 'assistant' as const,
            content: response.assistantMessage.content,
            createdAt: response.assistantMessage.createdAt,
            files: response.assistantMessage.files,
            zipUrl: response.assistantMessage.zipUrl,
          },
        ];
      });

      // Update conversation title if it was "New chat"
      if (conv.title === 'New chat') {
        const newTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        setConversations(prev =>
          prev.map(c => c.id === conv!.id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c)
        );
      }

    } catch (err: any) {
      console.error('Send message failed:', err);
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      
      // Check if free tier exhausted
      if (err?.code === 'FREE_TIER_EXHAUSTED' || err?.message?.includes('Free messages used up')) {
        setFreeTierExhausted(true);
        setError('Free messages used up. Add your API key to continue.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiKeys, currentConversation, createNewChat]);

  const stopGeneration = useCallback(() => {
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  return {
    conversations,
    currentConversation,
    currentConversationId,
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    freeTierExhausted,
    createNewChat,
    selectConversation,
    deleteConversation,
    sendMessage,
    stopGeneration,
    setError,
    loadConversations,
  };
}
