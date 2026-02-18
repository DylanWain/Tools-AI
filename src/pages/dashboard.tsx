// ============================================================================
// Dashboard — matches Chrome extension design exactly
// NO auth wall — works for all users (anonymous + logged in)
// Reads from: conversations, messages, code_blocks, files (same as extension)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
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
}

interface CodeBlock {
  id: string;
  conversation_id: string;
  language: string;
  code: string;
  title: string;
  filename: string;
  created_at: string;
}

interface Stats {
  totalConversations: number;
  totalMessages: number;
  totalFiles: number;
  totalCodeBlocks: number;
  platforms: Record<string, number>;
}

type View = 'conversations' | 'code' | 'files' | 'settings';

export default function Dashboard() {
  const { token, isLoading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentView, setCurrentView] = useState<View>('conversations');
  const [filterPlatform, setFilterPlatform] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Detail panel
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailConv, setDetailConv] = useState<Conversation | null>(null);
  const [detailMessages, setDetailMessages] = useState<Message[]>([]);
  const [detailCode, setDetailCode] = useState<CodeBlock[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const isReady = !!token;

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set('platform', filterPlatform);
      const data = await api.get<any>(`/extension/conversations?${params.toString()}`);
      setConversations(data.conversations || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filterPlatform]);

  useEffect(() => {
    if (isReady) loadConversations();
  }, [isReady, loadConversations]);

  // Open conversation detail
  const openDetail = async (conv: Conversation) => {
    setDetailConv(conv);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await api.get<any>(`/extension/conversations/${conv.id}`);
      setDetailMessages(data.messages || []);
      setDetailCode(data.codeBlocks || []);
    } catch (err) {
      console.error('Failed to load detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Search
  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const data = await api.get<any>(`/extension/conversations?search=${encodeURIComponent(q)}`);
      setSearchResults(data.results || []);
    } catch (err) { console.error('Search failed:', err); }
  };

  // Format
  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const platformIcon = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'chatgpt': return '🟢';
      case 'claude': return '🟠';
      case 'gemini': return '🔵';
      case 'toolsai': return '⚡';
      default: return '💬';
    }
  };

  if (authLoading) return null;

  const filtered = filterPlatform
    ? conversations.filter(c => c.platform === filterPlatform)
    : conversations;

  // All code blocks from conversations (we get them via stats, show count)
  const allCodeFromConvs = conversations.reduce((sum, c) => sum + (c.code_block_count || 0), 0);
  const allFilesFromConvs = conversations.reduce((sum, c) => sum + (c.file_count || 0), 0);

  return (
    <>
      <Head>
        <title>Dashboard - Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="dash-app">
        {/* ═══ SIDEBAR ═══ */}
        <aside className="dash-sidebar">
          <div className="dash-sidebar-header">
            <div className="dash-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <span className="dash-logo-text">Tools AI</span>
          </div>

          <div className="dash-sidebar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search everything..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          <nav className="dash-nav">
            <div className="dash-nav-section">
              <button className={`dash-nav-item ${currentView === 'conversations' && !filterPlatform ? 'active' : ''}`}
                onClick={() => { setCurrentView('conversations'); setFilterPlatform(''); }}>
                <span>💬</span><span>Conversations</span>
                <span className="dash-badge">{stats?.totalConversations || 0}</span>
              </button>
              <button className={`dash-nav-item ${currentView === 'code' ? 'active' : ''}`}
                onClick={() => setCurrentView('code')}>
                <span>💻</span><span>Code Library</span>
                <span className="dash-badge">{stats?.totalCodeBlocks || allCodeFromConvs}</span>
              </button>
              <button className={`dash-nav-item ${currentView === 'files' ? 'active' : ''}`}
                onClick={() => setCurrentView('files')}>
                <span>📄</span><span>Files & Downloads</span>
                <span className="dash-badge">{stats?.totalFiles || allFilesFromConvs}</span>
              </button>
            </div>

            <div className="dash-nav-section">
              <div className="dash-nav-section-title">Platforms</div>
              {['chatgpt', 'claude', 'gemini', 'toolsai'].map(p => (
                <button key={p} className={`dash-nav-item ${filterPlatform === p ? 'active' : ''}`}
                  onClick={() => { setCurrentView('conversations'); setFilterPlatform(filterPlatform === p ? '' : p); }}>
                  <span>{platformIcon(p)}</span>
                  <span>{p === 'toolsai' ? 'Tools AI Chat' : p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  <span className="dash-badge">{stats?.platforms?.[p] || 0}</span>
                </button>
              ))}
            </div>

            <div className="dash-nav-section">
              <a href="/app" className="dash-nav-item" style={{ textDecoration: 'none' }}>
                <span>💬</span><span>Open Chat</span>
              </a>
              <a href="/download" className="dash-nav-item" style={{ textDecoration: 'none' }}>
                <span>⬇️</span><span>Get Extension</span>
              </a>
            </div>
          </nav>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="dash-main">
          <header className="dash-main-header">
            <h1 className="dash-main-title">
              {currentView === 'conversations' ? (filterPlatform ? `${filterPlatform.charAt(0).toUpperCase() + filterPlatform.slice(1)} Conversations` : 'All Conversations') :
               currentView === 'code' ? 'Code Library' :
               currentView === 'files' ? 'Files & Downloads' : 'Settings'}
            </h1>
          </header>

          <div className="dash-content">
            {/* Search Results */}
            {searchQuery.trim() && searchResults.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: '#8e8e8e', marginBottom: 12 }}>
                  {searchResults.length} results for "{searchQuery}"
                </div>
                <div className="dash-table-container">
                  <table className="dash-table">
                    <thead><tr><th>Content</th><th>Sender</th><th>Date</th></tr></thead>
                    <tbody>
                      {searchResults.map((r: any) => (
                        <tr key={r.id}>
                          <td><div className="dash-table-title">{r.content?.slice(0, 120)}...</div></td>
                          <td className="dash-table-meta">{r.sender}</td>
                          <td className="dash-table-meta">{formatDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CONVERSATIONS VIEW */}
            {currentView === 'conversations' && !searchQuery.trim() && (
              <>
                {/* Stats */}
                <div className="dash-stats-grid">
                  <div className="dash-stat-card">
                    <div className="dash-stat-value">{stats?.totalConversations || 0}</div>
                    <div className="dash-stat-label">Conversations</div>
                  </div>
                  <div className="dash-stat-card">
                    <div className="dash-stat-value">{stats?.totalMessages || 0}</div>
                    <div className="dash-stat-label">Messages</div>
                  </div>
                  <div className="dash-stat-card">
                    <div className="dash-stat-value">{stats?.totalCodeBlocks || 0}</div>
                    <div className="dash-stat-label">Code Blocks</div>
                  </div>
                  <div className="dash-stat-card">
                    <div className="dash-stat-value">{stats?.totalFiles || 0}</div>
                    <div className="dash-stat-label">Files</div>
                  </div>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 64, color: '#8e8e8e' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">💬</div>
                    <div className="dash-empty-title">No conversations yet</div>
                    <div className="dash-empty-text">
                      Start chatting in the <a href="/app">AI Chat</a> or install the{' '}
                      <a href="/download">Chrome extension</a> to capture ChatGPT, Claude, and Gemini conversations.
                    </div>
                  </div>
                ) : (
                  <div className="dash-table-container">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Platform</th>
                          <th>Messages</th>
                          <th>Code</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(conv => (
                          <tr key={conv.id} onClick={() => openDetail(conv)} style={{ cursor: 'pointer' }}>
                            <td>
                              <div className="dash-table-title">{conv.title || 'Untitled'}</div>
                            </td>
                            <td>
                              <span className={`dash-platform-badge ${conv.platform || 'unknown'}`}>
                                {conv.platform || 'chat'}
                              </span>
                            </td>
                            <td className="dash-table-meta">{conv.message_count || 0}</td>
                            <td className="dash-table-meta">{conv.code_block_count || 0}</td>
                            <td className="dash-table-meta">{formatDate(conv.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* CODE VIEW */}
            {currentView === 'code' && (
              <div className="dash-empty">
                <div className="dash-empty-icon">💻</div>
                <div className="dash-empty-title">Code Library</div>
                <div className="dash-empty-text">
                  Click on any conversation to see its code blocks in the detail panel.
                  Code is automatically extracted from your AI conversations.
                </div>
              </div>
            )}

            {/* FILES VIEW */}
            {currentView === 'files' && (
              <div className="dash-empty">
                <div className="dash-empty-icon">📄</div>
                <div className="dash-empty-title">Files & Downloads</div>
                <div className="dash-empty-text">
                  Files generated in your AI conversations and downloads from ChatGPT, Claude, and Gemini appear here.
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ═══ DETAIL PANEL ═══ */}
        <div className={`dash-detail ${detailOpen ? 'open' : ''}`}>
          <div className="dash-detail-header">
            <span className="dash-detail-title">{detailConv?.title || 'Conversation'}</span>
            <button className="dash-detail-close" onClick={() => setDetailOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="dash-detail-content">
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#8e8e8e' }}>Loading...</div>
            ) : (
              <>
                {/* Meta */}
                {detailConv && (
                  <div className="dash-detail-section">
                    <div className="dash-detail-section-title">Info</div>
                    <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
                      <div>Platform: <span className={`dash-platform-badge ${detailConv.platform}`}>{detailConv.platform}</span></div>
                      <div>Messages: {detailMessages.length}</div>
                      <div>Created: {new Date(detailConv.created_at).toLocaleString()}</div>
                      {detailConv.url && (
                        <div><a href={detailConv.url} target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280' }}>Open original →</a></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Code Blocks */}
                {detailCode.length > 0 && (
                  <div className="dash-detail-section">
                    <div className="dash-detail-section-title">Code Blocks ({detailCode.length})</div>
                    {detailCode.map(cb => (
                      <div key={cb.id} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#8e8e8e', marginBottom: 4 }}>
                          {cb.language || 'code'} {cb.filename && `— ${cb.filename}`}
                        </div>
                        <pre className="dash-code-preview">{cb.code?.slice(0, 500)}{cb.code?.length > 500 ? '...' : ''}</pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Messages */}
                <div className="dash-detail-section">
                  <div className="dash-detail-section-title">Messages ({detailMessages.length})</div>
                  {detailMessages.map(msg => (
                    <div key={msg.id} className={`dash-message ${msg.sender}`}>
                      <div className="dash-message-role">{msg.sender === 'user' ? 'You' : 'AI'}</div>
                      <div className="dash-message-content">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Backdrop */}
        {detailOpen && <div className="dash-backdrop" onClick={() => setDetailOpen(false)} />}
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════
           Dashboard — matches extension design system
           ═══════════════════════════════════════════════════════════ */
        
        .dash-app {
          display: flex;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          color: #212121;
          background: #fff;
          -webkit-font-smoothing: antialiased;
        }

        /* Sidebar */
        .dash-sidebar {
          width: 260px;
          height: 100%;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          border-right: 1px solid #e8e8e8;
        }

        .dash-sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          height: 56px;
        }

        .dash-logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #d4d4d4, #fafafa, #b0b0b0, #e0e0e0);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dash-logo-text {
          font-size: 16px;
          font-weight: 700;
          color: #212121;
        }

        .dash-sidebar-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 12px 12px;
          padding: 8px 12px;
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
        }

        .dash-sidebar-search svg { color: #b4b4b4; flex-shrink: 0; }

        .dash-sidebar-search input {
          border: none;
          outline: none;
          font-size: 13px;
          width: 100%;
          background: transparent;
          color: #212121;
        }

        .dash-nav { flex: 1; overflow-y: auto; padding: 0 8px; }

        .dash-nav-section { margin-bottom: 16px; }

        .dash-nav-section-title {
          font-size: 11px;
          font-weight: 600;
          color: #8e8e8e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 12px 4px;
        }

        .dash-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: #444;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }

        .dash-nav-item:hover { background: #e8e8e8; }
        .dash-nav-item.active { background: #e8e8e8; font-weight: 600; color: #212121; }

        .dash-badge {
          margin-left: auto;
          font-size: 11px;
          color: #8e8e8e;
          background: #e8e8e8;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 20px;
          text-align: center;
        }

        .dash-nav-item.active .dash-badge { background: #d9d9d9; }

        /* Main */
        .dash-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .dash-main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          height: 56px;
          border-bottom: 1px solid #e8e8e8;
        }

        .dash-main-title { font-size: 18px; font-weight: 600; }

        .dash-content { flex: 1; overflow-y: auto; padding: 24px; }

        /* Stats */
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .dash-stat-card {
          background: #fafafa;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 20px;
        }

        .dash-stat-value { font-size: 28px; font-weight: 600; color: #6b7280; }
        .dash-stat-label { font-size: 13px; color: #8e8e8e; margin-top: 4px; }

        /* Table */
        .dash-table-container {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          overflow: hidden;
        }

        .dash-table { width: 100%; border-collapse: collapse; }

        .dash-table th {
          text-align: left;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #8e8e8e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #fafafa;
          border-bottom: 1px solid #e8e8e8;
        }

        .dash-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f5f5f5;
        }

        .dash-table tr:last-child td { border-bottom: none; }
        .dash-table tr:hover { background: #fafafa; }

        .dash-table-title { font-weight: 500; color: #212121; }
        .dash-table-title:hover { color: #6b7280; }
        .dash-table-meta { font-size: 13px; color: #8e8e8e; }

        .dash-platform-badge {
          display: inline-flex;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .dash-platform-badge.chatgpt { background: #d1fae5; color: #047857; }
        .dash-platform-badge.claude { background: #fed7aa; color: #c2410c; }
        .dash-platform-badge.gemini { background: #dbeafe; color: #1d4ed8; }
        .dash-platform-badge.toolsai { background: #f3e8ff; color: #7c3aed; }
        .dash-platform-badge.unknown { background: #f5f5f5; color: #666; }

        /* Empty State */
        .dash-empty { text-align: center; padding: 64px 24px; }
        .dash-empty-icon {
          width: 80px; height: 80px; margin: 0 auto 20px;
          background: #f5f5f5; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 36px;
        }
        .dash-empty-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .dash-empty-text { color: #8e8e8e; margin-bottom: 20px; line-height: 1.6; }
        .dash-empty-text a { color: #6b7280; }

        /* Detail Panel */
        .dash-detail {
          position: fixed;
          top: 0;
          right: -520px;
          width: 520px;
          height: 100%;
          background: #fff;
          box-shadow: -4px 0 20px rgba(0,0,0,0.1);
          transition: right 0.3s ease;
          z-index: 100;
          display: flex;
          flex-direction: column;
        }

        .dash-detail.open { right: 0; }

        .dash-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e8e8e8;
          gap: 12px;
        }

        .dash-detail-title {
          font-size: 16px;
          font-weight: 600;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dash-detail-close {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border: none; background: none; color: #8e8e8e;
          cursor: pointer; border-radius: 8px; flex-shrink: 0;
        }

        .dash-detail-close:hover { background: #f5f5f5; color: #212121; }

        .dash-detail-content { flex: 1; overflow-y: auto; padding: 20px; }

        .dash-detail-section { margin-bottom: 24px; }

        .dash-detail-section-title {
          font-size: 12px; font-weight: 600; color: #8e8e8e;
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;
        }

        .dash-message {
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .dash-message.user { background: #f5f5f5; margin-left: 40px; }
        .dash-message.assistant { background: #fff; border: 1px solid #e8e8e8; }

        .dash-message-role {
          font-size: 11px; font-weight: 600; color: #8e8e8e;
          text-transform: uppercase; margin-bottom: 6px;
        }

        .dash-message-content { font-size: 14px; line-height: 1.6; }

        .dash-code-preview {
          background: #212121;
          color: #e5e5e5;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 13px;
          overflow-x: auto;
          white-space: pre-wrap;
          max-height: 200px;
          overflow-y: auto;
        }

        .dash-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.3);
          z-index: 99;
        }

        /* Scrollbar */
        .dash-detail-content::-webkit-scrollbar,
        .dash-content::-webkit-scrollbar,
        .dash-nav::-webkit-scrollbar { width: 6px; }
        .dash-detail-content::-webkit-scrollbar-track,
        .dash-content::-webkit-scrollbar-track,
        .dash-nav::-webkit-scrollbar-track { background: transparent; }
        .dash-detail-content::-webkit-scrollbar-thumb,
        .dash-content::-webkit-scrollbar-thumb,
        .dash-nav::-webkit-scrollbar-thumb { background: #d9d9d9; border-radius: 3px; }

        /* Mobile */
        @media (max-width: 768px) {
          .dash-sidebar { display: none; }
          .dash-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dash-detail { width: 100%; right: -100%; }
        }
      `}</style>
    </>
  );
}
