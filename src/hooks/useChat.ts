// ============================================================================
// useChat Hook - Message handling (non-streaming)
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import type { Message } from '../types';
import { api } from '../lib/api';

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  clearError: () => void;
  loadMessages: () => Promise<void>;
}

export function useChat(conversationId: string | null): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.get<{ conversation: any; messages: Message[] }>(
        `/conversations/${conversationId}`
      );
      setMessages(response.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string, files?: File[]) => {
    if (!conversationId || !content.trim()) {
      return;
    }

    setError(null);
    setIsLoading(true);
    
    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      userId: '',
      sender: 'user',
      content: content.trim(),
      hash: '',
      createdAt: new Date().toISOString(),
      tokenCount: null,
      model: null,
      fileIds: [],
      metadata: {},
    };
    
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await api.sendMessage(conversationId, content.trim());

      // Replace temp message with real one and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id);
        return [...filtered, response.userMessage, response.assistantMessage];
      });
      
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming: false,
    streamingContent: '',
    error,
    sendMessage,
    clearError,
    loadMessages,
  };
}
