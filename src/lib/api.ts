// ============================================================================
// API Client - Calls Next.js API routes
// ============================================================================

import type { Message, SendMessageResponse } from '../types';

class ApiClient {
  private token: string | null = null;
  private apiKey: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setApiKey(key: string | null) {
    this.apiKey = key;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `/api${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = void>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Send message (non-streaming for simplicity)
  async sendMessage(
    conversationId: string,
    content: string
  ): Promise<SendMessageResponse> {
    return this.post('/messages/send', {
      conversationId,
      content,
      apiKey: this.apiKey,
    });
  }

  // Search messages
  async searchMessages(
    query: string,
    conversationId?: string,
    limit?: number
  ): Promise<{ results: any[]; totalFound: number }> {
    return this.post('/search', { query, conversationId, limit });
  }
}

export const api = new ApiClient();
