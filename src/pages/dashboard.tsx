// ============================================================================
// pages/dashboard.tsx - Extension Dashboard (auth-protected)
// Shows all conversations captured by the Chrome extension
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface Conversation {
  id: string;
  platform: string;
  title: string;
  message_count: number;
  code_block_count: number;
  file_count: number;
  updated_at: string;
  created_at: string;
  url: string | null;
  email: string;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  created_at: string;
  conversation_id: string;
}

interface Stats {
  totalConversations: number;
  totalMessages: number;
  totalFiles: number;
  totalCodeBlocks: number;
  platforms: Record<string, number>;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, token, isLoading: authLoading, isLoggedIn } = useAuth();
  const isAuthenticated = !!token; // True for both anonymous and logged-in users
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // No redirect - show sign-in prompt inline instead

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== 'all') params.set('platform', filterPlatform);
      
      const data = await api.get<any>(`/extension/conversations?${params.toString()}`);
      setConversations(data.conversations || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filterPlatform]);

  useEffect(() => {
    if (isAuthenticated) loadConversations();
  }, [isAuthenticated, loadConversations]);

  // Load conversation messages
  const loadMessages = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessagesLoading(true);
    try {
      const data = await api.get<any>(`/extension/conversations/${conv.id}`);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await api.get<any>(`/extension/conversations?search=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) handleSearch();
      else { setSearchResults([]); setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const platformColor = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'chatgpt': return '#10a37f';
      case 'claude': return '#cc7832';
      case 'gemini': return '#4285f4';
      default: return '#6b7280';
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (authLoading) return null;

  return (
    <>
      <Head>
        <title>Dashboard - Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="dashboard">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-inner">
            <div className="dash-header-left">
              <a href="/" className="dash-logo">Tools AI</a>
              <span className="dash-badge">Dashboard</span>
            </div>
            <div className="dash-header-right">
              <a href="/app" className="dash-link">Chat App</a>
              <span className="dash-user">{user?.email || user?.displayName}</span>
            </div>
          </div>
        </header>

        <div className="dash-layout">
          {/* Sidebar */}
          <aside className="dash-sidebar">
            {/* Search */}
            <div className="dash-search">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Stats */}
            {stats && (
              <div className="dash-stats">
                <div className="stat">
                  <span className="stat-num">{stats.totalConversations}</span>
                  <span className="stat-label">Conversations</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{stats.totalMessages}</span>
                  <span className="stat-label">Messages</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{stats.totalCodeBlocks}</span>
                  <span className="stat-label">Code Blocks</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{stats.totalFiles}</span>
                  <span className="stat-label">Files</span>
                </div>
              </div>
            )}

            {/* Platform filter */}
            <div className="dash-filters">
              <button
                className={`filter-btn ${filterPlatform === 'all' ? 'active' : ''}`}
                onClick={() => setFilterPlatform('all')}
              >
                All
              </button>
              {['chatgpt', 'claude', 'gemini'].map(p => (
                <button
                  key={p}
                  className={`filter-btn ${filterPlatform === p ? 'active' : ''}`}
                  onClick={() => setFilterPlatform(p)}
                  style={{ '--platform-color': platformColor(p) } as any}
                >
                  <span className="filter-dot" style={{ background: platformColor(p) }} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                  {stats?.platforms[p] ? ` (${stats.platforms[p]})` : ''}
                </button>
              ))}
            </div>

            {/* Conversation list */}
            <div className="dash-conv-list">
              {loading ? (
                <div className="dash-empty">Loading...</div>
              ) : isSearching ? (
                searchResults.length > 0 ? (
                  searchResults.map((r, i) => (
                    <div key={i} className="conv-item search-result">
                      <div className="conv-platform" style={{ background: platformColor(r.platform) }}>
                        {r.platform?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="conv-info">
                        <div className="conv-title">{r.conversation_title}</div>
                        <div className="conv-preview">{r.content?.slice(0, 100)}...</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dash-empty">No results found</div>
                )
              ) : conversations.length > 0 ? (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`conv-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
                    onClick={() => loadMessages(conv)}
                  >
                    <div className="conv-platform" style={{ background: platformColor(conv.platform) }}>
                      {conv.platform?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="conv-info">
                      <div className="conv-title">{conv.title}</div>
                      <div className="conv-meta">
                        {conv.message_count} messages · {timeAgo(conv.updated_at)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dash-empty">
                  <p>No conversations synced yet</p>
                  <p style={{ fontSize: 13, marginTop: 8 }}>
                    Install the Chrome extension and browse ChatGPT, Claude, or Gemini to start capturing.
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="dash-main">
            {selectedConv ? (
              <div className="conv-detail">
                <div className="conv-detail-header">
                  <div>
                    <h2>{selectedConv.title}</h2>
                    <div className="conv-detail-meta">
                      <span className="platform-badge" style={{ background: platformColor(selectedConv.platform) }}>
                        {selectedConv.platform}
                      </span>
                      <span>{selectedConv.message_count} messages</span>
                      <span>Last updated {timeAgo(selectedConv.updated_at)}</span>
                    </div>
                  </div>
                  {selectedConv.url && (
                    <a href={selectedConv.url} target="_blank" rel="noopener noreferrer" className="conv-link">
                      Open original →
                    </a>
                  )}
                </div>

                <div className="conv-messages">
                  {messagesLoading ? (
                    <div className="dash-empty">Loading messages...</div>
                  ) : messages.length > 0 ? (
                    messages.map(msg => (
                      <div key={msg.id} className={`msg ${msg.sender}`}>
                        <div className="msg-sender">{msg.sender === 'user' ? 'You' : 'AI'}</div>
                        <div className="msg-content">
                          {msg.content}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="dash-empty">No messages in this conversation</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="dash-welcome">
                <div className="dash-welcome-icon">Ti</div>
                <h2>Tools AI Dashboard</h2>
                <p>Select a conversation from the sidebar to view its full history.</p>
                <p>All conversations are synced from your Chrome extension and stored permanently.</p>
              </div>
            )}
          </main>
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: #fff;
          color: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .dash-header {
          border-bottom: 1px solid #e5e5e5;
          background: #fafafa;
        }

        .dash-header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dash-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dash-logo {
          font-weight: 700;
          font-size: 18px;
          color: #1a1a1a;
          text-decoration: none;
        }

        .dash-badge {
          font-size: 12px;
          padding: 3px 10px;
          background: #e5e5e5;
          border-radius: 12px;
          color: #666;
        }

        .dash-header-right {
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 14px;
        }

        .dash-link {
          color: #666;
          text-decoration: none;
        }

        .dash-link:hover { color: #1a1a1a; }

        .dash-user { color: #888; }

        .dash-layout {
          display: flex;
          height: calc(100vh - 53px);
        }

        .dash-sidebar {
          width: 360px;
          border-right: 1px solid #e5e5e5;
          display: flex;
          flex-direction: column;
          background: #fafafa;
        }

        .dash-search {
          padding: 16px;
          border-bottom: 1px solid #e5e5e5;
        }

        .dash-search input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #fff;
        }

        .dash-search input:focus {
          border-color: #1a1a1a;
        }

        .dash-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e5e5;
        }

        .stat {
          display: flex;
          flex-direction: column;
          padding: 8px 12px;
          background: #fff;
          border-radius: 8px;
          border: 1px solid #f0f0f0;
        }

        .stat-num {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .stat-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dash-filters {
          display: flex;
          gap: 6px;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e5e5;
          flex-wrap: wrap;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 20px;
          background: #fff;
          font-size: 13px;
          cursor: pointer;
          color: #666;
        }

        .filter-btn.active {
          background: #1a1a1a;
          color: #fff;
          border-color: #1a1a1a;
        }

        .filter-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .filter-btn.active .filter-dot {
          border: 1px solid rgba(255,255,255,0.5);
        }

        .dash-conv-list {
          flex: 1;
          overflow-y: auto;
        }

        .conv-item {
          display: flex;
          gap: 12px;
          padding: 14px 16px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.15s;
        }

        .conv-item:hover { background: #f5f5f5; }
        .conv-item.active { background: #eee; }

        .conv-platform {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .conv-info { flex: 1; min-width: 0; }

        .conv-title {
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conv-meta {
          font-size: 12px;
          color: #888;
          margin-top: 2px;
        }

        .conv-preview {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dash-empty {
          padding: 40px 20px;
          text-align: center;
          color: #888;
          font-size: 14px;
        }

        .dash-main {
          flex: 1;
          overflow-y: auto;
        }

        .dash-welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #888;
          text-align: center;
          padding: 40px;
        }

        .dash-welcome-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4d4d4, #fafafa, #b0b0b0);
          border: 2px solid #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 20px;
        }

        .dash-welcome h2 {
          color: #1a1a1a;
          font-size: 24px;
          margin-bottom: 8px;
        }

        .conv-detail { display: flex; flex-direction: column; height: 100%; }

        .conv-detail-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .conv-detail-header h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .conv-detail-meta {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 13px;
          color: #888;
        }

        .platform-badge {
          padding: 3px 10px;
          border-radius: 12px;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
        }

        .conv-link {
          color: #1a1a1a;
          font-size: 13px;
          text-decoration: none;
          padding: 6px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
        }

        .conv-link:hover { background: #f5f5f5; }

        .conv-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .msg {
          margin-bottom: 24px;
          max-width: 800px;
        }

        .msg-sender {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
          color: #1a1a1a;
        }

        .msg.assistant .msg-sender { color: #666; }

        .msg-content {
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .msg.user .msg-content {
          background: #f5f5f5;
          padding: 12px 16px;
          border-radius: 12px;
        }

        @media (max-width: 768px) {
          .dash-layout { flex-direction: column; }
          .dash-sidebar { width: 100%; height: 50vh; }
          .dash-main { height: 50vh; }
        }
      `}</style>
    </>
  );
}
