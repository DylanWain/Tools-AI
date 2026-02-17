// ============================================================================
// useLocalChat - Local-first chat with direct API calls
// No backend required - stores in localStorage, calls AI APIs directly
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  createdAt: string;
  updatedAt: string;
}

const CONVERSATIONS_KEY = 'toolsai_conversations';
const CURRENT_CHAT_KEY = 'toolsai_current_chat';

export function useLocalChat() {
  const { apiKeys } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    const currentId = localStorage.getItem(CURRENT_CHAT_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConversations(parsed);
      } catch (e) {
        console.error('Failed to parse conversations:', e);
      }
    }
    
    if (currentId) {
      setCurrentConversationId(currentId);
    }
  }, []);

  // Save to localStorage
  const saveConversations = useCallback((convs: Conversation[]) => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
  }, []);

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;
  const messages = currentConversation?.messages || [];

  // Create new chat
  const createNewChat = useCallback((model = 'gpt-4o', provider: 'openai' | 'anthropic' | 'google' | 'groq' = 'openai') => {
    const newConv: Conversation = {
      id: `chat-${Date.now()}`,
      title: 'New chat',
      messages: [],
      model,
      provider,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const updated = [newConv, ...conversations];
    setConversations(updated);
    setCurrentConversationId(newConv.id);
    localStorage.setItem(CURRENT_CHAT_KEY, newConv.id);
    saveConversations(updated);
    
    return newConv;
  }, [conversations, saveConversations]);

  // Select conversation
  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    localStorage.setItem(CURRENT_CHAT_KEY, id);
    setError(null);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    saveConversations(updated);
    
    if (currentConversationId === id) {
      const next = updated[0]?.id || null;
      setCurrentConversationId(next);
      if (next) {
        localStorage.setItem(CURRENT_CHAT_KEY, next);
      } else {
        localStorage.removeItem(CURRENT_CHAT_KEY);
      }
    }
  }, [conversations, currentConversationId, saveConversations]);

  // Call OpenAI API (non-streaming for reliability)
  const callOpenAI = async (messages: { role: string; content: string }[], model: string, apiKey: string): Promise<string> => {
    console.log('Calling OpenAI API with model:', model);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', data);
    return data.choices[0]?.message?.content || '';
  };

  // Call Anthropic API (non-streaming for reliability)
  const callAnthropic = async (messages: { role: string; content: string }[], model: string, apiKey: string): Promise<string> => {
    console.log('Calling Anthropic API with model:', model);
    
    // Filter out any system messages and convert format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: anthropicMessages,
      }),
    });

    const data = await response.json();
    console.log('Anthropic response:', data);

    if (!response.ok || data.type === 'error') {
      console.error('Anthropic API error:', data);
      const errorMsg = data.error?.message || data.message || `Anthropic API error: ${response.status}`;
      throw new Error(errorMsg);
    }
    
    // Extract text from content blocks
    const textContent = data.content?.find((block: any) => block.type === 'text');
    return textContent?.text || '';
  };

  // Call Google API (non-streaming for reliability)
  const callGoogle = async (messages: { role: string; content: string }[], model: string, apiKey: string): Promise<string> => {
    console.log('Calling Google API with model:', model);
    
    // Convert to Google format
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contents }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google API error:', errorData);
      throw new Error(errorData.error?.message || `Google API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Google response:', data);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  // Send message
  const sendMessage = useCallback(async (content: string, model?: string, provider?: 'openai' | 'anthropic' | 'google' | 'groq') => {
    console.log('sendMessage called with:', { content, model, provider });
    console.log('Current apiKeys:', apiKeys);
    
    let conv = currentConversation;
    
    // Create new conversation if none exists
    if (!conv) {
      console.log('No current conversation, creating new one');
      conv = createNewChat(model || 'gpt-4o', provider || 'openai');
    }

    const useModel = model || conv.model;
    const useProvider = provider || conv.provider;

    console.log('Using model:', useModel, 'provider:', useProvider);

    // Check for API key
    const apiKey = apiKeys[useProvider];
    console.log('API key exists:', !!apiKey, 'Key prefix:', apiKey?.slice(0, 10));
    
    if (!apiKey) {
      const errorMsg = `No ${useProvider} API key configured. Please add your API key in Settings.`;
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...conv.messages, userMessage];
    
    // Update title from first message
    let newTitle = conv.title;
    if (conv.messages.length === 0) {
      newTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    // Update conversation with user message immediately
    let updated = conversations.map(c =>
      c.id === conv!.id
        ? { ...c, messages: updatedMessages, title: newTitle, updatedAt: new Date().toISOString() }
        : c
    );
    
    // If conversation wasn't in list yet, add it
    if (!updated.find(c => c.id === conv!.id)) {
      updated = [{ ...conv!, messages: updatedMessages, title: newTitle, updatedAt: new Date().toISOString() }, ...updated];
    }
    
    setConversations(updated);
    saveConversations(updated);

    try {
      // Prepare messages for API
      const apiMessages = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      console.log('Sending to API, messages count:', apiMessages.length);

      // Call appropriate API
      let responseContent: string;
      
      if (useProvider === 'openai') {
        responseContent = await callOpenAI(apiMessages, useModel, apiKey);
      } else if (useProvider === 'anthropic') {
        responseContent = await callAnthropic(apiMessages, useModel, apiKey);
      } else {
        responseContent = await callGoogle(apiMessages, useModel, apiKey);
      }

      console.log('Got response, length:', responseContent.length);

      // Add assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: responseContent,
        createdAt: new Date().toISOString(),
      };

      // Update with assistant response
      const finalMessages = [...updatedMessages, assistantMessage];
      const finalUpdated = conversations.map(c =>
        c.id === conv!.id
          ? { ...c, messages: finalMessages, title: newTitle, updatedAt: new Date().toISOString() }
          : c
      );
      
      // If conversation wasn't in list, add it
      let finalConvs = finalUpdated;
      if (!finalUpdated.find(c => c.id === conv!.id)) {
        finalConvs = [{ ...conv!, messages: finalMessages, title: newTitle, updatedAt: new Date().toISOString() }, ...finalUpdated];
      }
      
      setConversations(finalConvs);
      saveConversations(finalConvs);
      
      console.log('Message exchange complete');

    } catch (err) {
      console.error('API call failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [apiKeys, conversations, currentConversation, createNewChat, saveConversations]);

  // Stop generation (placeholder for streaming)
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
    createNewChat,
    selectConversation,
    deleteConversation,
    sendMessage,
    stopGeneration,
    setError,
  };
}
