// ============================================================================
// ToolsPopup.tsx - Extension-style popup for the web interface
// Shows stats, recent conversations, code blocks, search - like the extension
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface PopupStats {
  totalConversations: number;
  totalMessages: number;
  totalCodeBlocks: number;
  totalFiles: number;
}

interface RecentConversation {
  id: string;
  title: string;
  platform: string;
  message_count: number;
  updated_at: string;
}

interface CodeBlock {
  id: string;
  language: string;
  code: string;
  conversation_title: string;
  created_at: string;
}

interface ToolsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDashboard: () => void;
  onSelectConversation?: (id: string) => void;
}

// Icons
const Icons = {
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  code: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
};

export default function ToolsPopup({ isOpen, onClose, onOpenDashboard, onSelectConversation }: ToolsPopupProps) {
  const { token, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'recent' | 'code'>('recent');
  const [stats, setStats] = useState<PopupStats>({ totalConversations: 0, totalMessages: 0, totalCodeBlocks: 0, totalFiles: 0 });
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      // Load conversations from the website's conversations table (not extension)
      const convData = await api.get<any>('/conversations?limit=10');
      const convList = convData.conversations || convData || [];
      setConversations(Array.isArray(convList) ? convList.map((c: any) => ({
        id: c.id,
        title: c.title || 'Untitled',
        platform: c.provider || 'groq',
        message_count: c.message_count || 0,
        updated_at: c.updated_at,
      })) : []);
      
      // Calculate stats from conversations
      if (Array.isArray(convList)) {
        const totalMessages = convList.reduce((sum: number, c: any) => sum + (c.message_count || 0), 0);
        setStats({
          totalConversations: convList.length,
          totalMessages: totalMessages,
          totalCodeBlocks: 0, // Will be updated when we load code blocks
          totalFiles: 0,
        });
      }

      // Load code blocks from files endpoint
      try {
        const filesData = await api.get<any>('/files?type=code&limit=20');
        if (filesData.files && Array.isArray(filesData.files)) {
          setCodeBlocks(filesData.files.map((f: any) => ({
            id: f.id,
            language: f.language || 'text',
            code: f.content || '',
            conversation_title: f.conversation_title || 'Unknown',
            created_at: f.created_at,
          })));
          setStats(prev => ({ ...prev, totalCodeBlocks: filesData.files.length }));
        }
      } catch (e) {
        // Files endpoint might not exist yet, that's ok
        console.log('Files endpoint not available');
      }
    } catch (err) {
      console.error('Failed to load popup data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && isLoggedIn) {
      loadData();
    }
  }, [isOpen, isLoggedIn, loadData]);

  // Filter by search
  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCodeBlocks = codeBlocks.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Copy code to clipboard
  const copyCode = async (id: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format relative time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Get platform color
  const getPlatformStyle = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'chatgpt': return { bg: '#d1fae5', color: '#047857' };
      case 'claude': return { bg: '#fed7aa', color: '#c2410c' };
      case 'gemini': return { bg: '#dbeafe', color: '#1d4ed8' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="tools-popup-backdrop" onClick={onClose} />
      
      {/* Popup */}
      <div className="tools-popup">
        {/* Header */}
        <div className="tools-popup-header">
          <div className="tools-popup-header-left">
            <div className="tools-popup-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <span className="tools-popup-title">Tools AI</span>
          </div>
          <div className="tools-popup-header-actions">
            <button className="tools-popup-header-btn" onClick={onOpenDashboard} title="Dashboard">
              {Icons.dashboard}
            </button>
            <button className="tools-popup-header-btn" onClick={onClose} title="Close">
              {Icons.x}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="tools-popup-stats">
          <div className="tools-popup-stat">
            <div className="tools-popup-stat-value">{stats.totalConversations}</div>
            <div className="tools-popup-stat-label">Chats</div>
          </div>
          <div className="tools-popup-stat">
            <div className="tools-popup-stat-value">{stats.totalMessages}</div>
            <div className="tools-popup-stat-label">Messages</div>
          </div>
          <div className="tools-popup-stat">
            <div className="tools-popup-stat-value">{stats.totalCodeBlocks}</div>
            <div className="tools-popup-stat-label">Code</div>
          </div>
          <div className="tools-popup-stat">
            <div className="tools-popup-stat-value">{stats.totalFiles}</div>
            <div className="tools-popup-stat-label">Files</div>
          </div>
        </div>

        {/* Sync status */}
        <div className="tools-popup-sync">
          <div className="tools-popup-sync-info">
            <div className={`tools-popup-sync-dot ${isLoggedIn ? 'online' : 'offline'}`} />
            <span>{isLoggedIn ? 'Cloud sync active' : 'Sign in to sync'}</span>
          </div>
          {isLoggedIn && (
            <button className="tools-popup-sync-btn" onClick={loadData}>
              Refresh
            </button>
          )}
        </div>

        {/* Search */}
        <div className="tools-popup-search">
          <div className="tools-popup-search-box">
            {Icons.search}
            <input
              type="text"
              placeholder="Search conversations, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="tools-popup-tabs">
          <button 
            className={`tools-popup-tab ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            Recent
          </button>
          <button 
            className={`tools-popup-tab ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            Code
          </button>
        </div>

        {/* Content */}
        <div className="tools-popup-content">
          {!isLoggedIn ? (
            <div className="tools-popup-empty">
              <div className="tools-popup-empty-icon">🔒</div>
              <div className="tools-popup-empty-title">Sign in required</div>
              <div className="tools-popup-empty-text">Sign in to access your saved conversations and code</div>
            </div>
          ) : loading ? (
            <div className="tools-popup-empty">
              <div className="tools-popup-empty-icon">⏳</div>
              <div className="tools-popup-empty-title">Loading...</div>
            </div>
          ) : activeTab === 'recent' ? (
            filteredConversations.length === 0 ? (
              <div className="tools-popup-empty">
                <div className="tools-popup-empty-icon">💬</div>
                <div className="tools-popup-empty-title">No conversations yet</div>
                <div className="tools-popup-empty-text">Your chat history will appear here</div>
              </div>
            ) : (
              <>
                <div className="tools-popup-section-title">Recent Conversations</div>
                {filteredConversations.map((conv) => {
                  const platformStyle = getPlatformStyle(conv.platform);
                  return (
                    <div 
                      key={conv.id} 
                      className="tools-popup-item"
                      onClick={() => onSelectConversation?.(conv.id)}
                    >
                      <div className="tools-popup-item-icon" style={{ background: platformStyle.bg }}>
                        {Icons.chat}
                      </div>
                      <div className="tools-popup-item-content">
                        <div className="tools-popup-item-title">{conv.title || 'Untitled'}</div>
                        <div className="tools-popup-item-meta">
                          <span 
                            className="tools-popup-platform-badge"
                            style={{ background: platformStyle.bg, color: platformStyle.color }}
                          >
                            {conv.platform || 'chat'}
                          </span>
                          <span>{conv.message_count} messages</span>
                          <span>·</span>
                          <span>{formatTime(conv.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )
          ) : (
            filteredCodeBlocks.length === 0 ? (
              <div className="tools-popup-empty">
                <div className="tools-popup-empty-icon">💻</div>
                <div className="tools-popup-empty-title">No code blocks yet</div>
                <div className="tools-popup-empty-text">Code from your conversations will appear here</div>
              </div>
            ) : (
              <>
                <div className="tools-popup-section-title">Code Library</div>
                {filteredCodeBlocks.map((block) => (
                  <div key={block.id} className="tools-popup-code-item">
                    <div className="tools-popup-code-header">
                      <span className="tools-popup-code-lang">{block.language}</span>
                      <button 
                        className="tools-popup-code-copy"
                        onClick={() => copyCode(block.id, block.code)}
                      >
                        {copiedId === block.id ? '✓ Copied' : Icons.copy}
                      </button>
                    </div>
                    <pre className="tools-popup-code-preview">
                      {block.code.slice(0, 150)}{block.code.length > 150 ? '...' : ''}
                    </pre>
                    <div className="tools-popup-code-meta">
                      From: {block.conversation_title} · {formatTime(block.created_at)}
                    </div>
                  </div>
                ))}
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="tools-popup-footer">
          <button className="tools-popup-footer-link" onClick={onOpenDashboard}>
            Open Full Dashboard
          </button>
          <span className="tools-popup-shortcut">
            <kbd>⌘</kbd><kbd>K</kbd> search
          </span>
        </div>
      </div>

      <style jsx>{`
        .tools-popup-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }

        .tools-popup {
          position: fixed;
          top: 60px;
          right: 16px;
          width: 380px;
          max-height: calc(100vh - 80px);
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          z-index: 1001;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .tools-popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #e5e5e5;
        }

        .tools-popup-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .tools-popup-logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #d4d4d4, #fafafa, #b0b0b0);
          border: 1.5px solid #1a1a1a;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tools-popup-logo svg {
          width: 18px;
          height: 18px;
          color: #1a1a1a;
        }

        .tools-popup-title {
          font-size: 16px;
          font-weight: 600;
          color: #212121;
        }

        .tools-popup-header-actions {
          display: flex;
          gap: 4px;
        }

        .tools-popup-header-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 8px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tools-popup-header-btn:hover {
          background: #f5f5f5;
          color: #212121;
        }

        .tools-popup-stats {
          display: flex;
          background: #fafafa;
          border-bottom: 1px solid #e5e5e5;
        }

        .tools-popup-stat {
          flex: 1;
          text-align: center;
          padding: 14px 8px;
          border-right: 1px solid #e5e5e5;
        }

        .tools-popup-stat:last-child {
          border-right: none;
        }

        .tools-popup-stat-value {
          font-size: 22px;
          font-weight: 600;
          color: #6b7280;
        }

        .tools-popup-stat-label {
          font-size: 10px;
          font-weight: 500;
          color: #8e8e8e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }

        .tools-popup-sync {
          padding: 10px 16px;
          background: #fafafa;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .tools-popup-sync-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #666;
        }

        .tools-popup-sync-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .tools-popup-sync-dot.online {
          background: #10a37f;
        }

        .tools-popup-sync-dot.offline {
          background: #b4b4b4;
        }

        .tools-popup-sync-btn {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid #d9d9d9;
          background: #fff;
          color: #444;
          cursor: pointer;
        }

        .tools-popup-sync-btn:hover {
          background: #f5f5f5;
        }

        .tools-popup-search {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e5e5;
        }

        .tools-popup-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          transition: all 0.15s;
        }

        .tools-popup-search-box:focus-within {
          border-color: #6b7280;
          box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
        }

        .tools-popup-search-box svg {
          color: #8e8e8e;
        }

        .tools-popup-search-box input {
          flex: 1;
          border: none;
          background: none;
          font-size: 14px;
          color: #212121;
          outline: none;
        }

        .tools-popup-search-box input::placeholder {
          color: #8e8e8e;
        }

        .tools-popup-tabs {
          display: flex;
          padding: 0 16px;
          border-bottom: 1px solid #e5e5e5;
        }

        .tools-popup-tab {
          padding: 12px 16px;
          background: none;
          border: none;
          color: #8e8e8e;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s;
        }

        .tools-popup-tab:hover {
          color: #444;
        }

        .tools-popup-tab.active {
          color: #6b7280;
          border-bottom-color: #6b7280;
        }

        .tools-popup-content {
          flex: 1;
          overflow-y: auto;
          max-height: 300px;
        }

        .tools-popup-section-title {
          padding: 12px 16px 8px;
          font-size: 11px;
          font-weight: 600;
          color: #8e8e8e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tools-popup-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .tools-popup-item:hover {
          background: #fafafa;
        }

        .tools-popup-item-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }

        .tools-popup-item-content {
          flex: 1;
          min-width: 0;
        }

        .tools-popup-item-title {
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #212121;
        }

        .tools-popup-item-meta {
          font-size: 12px;
          color: #8e8e8e;
          margin-top: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tools-popup-platform-badge {
          display: inline-flex;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .tools-popup-code-item {
          padding: 12px 16px;
          border-bottom: 1px solid #f5f5f5;
        }

        .tools-popup-code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .tools-popup-code-lang {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
        }

        .tools-popup-code-copy {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #e5e5e5;
          background: #fff;
          color: #666;
          cursor: pointer;
        }

        .tools-popup-code-copy:hover {
          background: #f5f5f5;
        }

        .tools-popup-code-preview {
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          font-size: 12px;
          background: #f5f5f5;
          padding: 8px 10px;
          border-radius: 6px;
          overflow: hidden;
          white-space: pre-wrap;
          word-break: break-all;
          color: #333;
          margin: 0;
        }

        .tools-popup-code-meta {
          font-size: 11px;
          color: #8e8e8e;
          margin-top: 8px;
        }

        .tools-popup-empty {
          padding: 48px 24px;
          text-align: center;
        }

        .tools-popup-empty-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .tools-popup-empty-title {
          font-size: 15px;
          font-weight: 600;
          color: #212121;
          margin-bottom: 4px;
        }

        .tools-popup-empty-text {
          font-size: 13px;
          color: #8e8e8e;
          line-height: 1.5;
        }

        .tools-popup-footer {
          padding: 12px 16px;
          border-top: 1px solid #e5e5e5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
        }

        .tools-popup-footer-link {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          background: none;
          border: none;
          cursor: pointer;
        }

        .tools-popup-footer-link:hover {
          text-decoration: underline;
        }

        .tools-popup-shortcut {
          font-size: 12px;
          color: #8e8e8e;
        }

        .tools-popup-shortcut kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          background: #f5f5f5;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          color: #666;
          margin: 0 1px;
        }

        @media (max-width: 480px) {
          .tools-popup {
            top: 0;
            right: 0;
            left: 0;
            width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }
        }
      `}</style>
    </>
  );
}
