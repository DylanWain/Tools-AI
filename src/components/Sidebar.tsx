// ============================================================================
// Sidebar.tsx - Exact ChatGPT Sidebar Clone (Tools AI Branded)
// ============================================================================

import React, { useState } from 'react';

// Tools AI Logo (OpenAI-style spiral)
const ToolsAILogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="sidebar-logo">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

// Icons
const Icons = {
  pencil: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  sidebar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  image: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  moreHorizontal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
  sparkle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  ),
  folder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  userName?: string;
  isLoggedIn?: boolean;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onSignIn?: () => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  userName = 'Guest',
  isLoggedIn = false,
  onOpenSettings,
  onLogout,
  onSignIn,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gptsExpanded, setGptsExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Group conversations by date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const filteredConvos = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups = {
    today: filteredConvos.filter(c => new Date(c.updatedAt).toDateString() === today.toDateString()),
    yesterday: filteredConvos.filter(c => new Date(c.updatedAt).toDateString() === yesterday.toDateString()),
    lastWeek: filteredConvos.filter(c => {
      const d = new Date(c.updatedAt);
      return d < yesterday && d >= lastWeek;
    }),
    older: filteredConvos.filter(c => new Date(c.updatedAt) < lastWeek),
  };

  const userInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onToggle}
      />
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header with Logo and icons */}
        <div className="sidebar-header">
          <ToolsAILogo />
          <div className="sidebar-header-actions">
            <button className="sidebar-btn" onClick={onNewChat} title="New chat">
              {Icons.pencil}
            </button>
            <button className="sidebar-btn" onClick={onToggle} title="Close sidebar">
              {Icons.sidebar}
            </button>
          </div>
        </div>

        {/* Search input like ChatGPT */}
        <div className="sidebar-search">
          {Icons.search}
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Nav items - Images and Apps */}
        <nav className="sidebar-nav">
          <button className="sidebar-nav-item">
            {Icons.image}
            <span>Images</span>
          </button>
          <button className="sidebar-nav-item">
            {Icons.grid}
            <span>Apps</span>
          </button>
        </nav>

        {/* Scrollable content */}
        <div className="sidebar-content">
          {/* GPTs Section */}
          <div className="sidebar-section">
            <div 
              className="sidebar-section-header"
              onClick={() => setGptsExpanded(!gptsExpanded)}
            >
              <span className="sidebar-section-label">GPTs</span>
              <span className={`sidebar-section-chevron ${!gptsExpanded ? 'collapsed' : ''}`}>
                {Icons.chevronDown}
              </span>
            </div>
            {gptsExpanded && (
              <div className="conversation-list">
                <button className="sidebar-nav-item">
                  {Icons.sparkle}
                  <span>Explore GPTs</span>
                </button>
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div className="sidebar-section">
            <div 
              className="sidebar-section-header"
              onClick={() => setProjectsExpanded(!projectsExpanded)}
            >
              <span className="sidebar-section-label">Projects</span>
              <span className={`sidebar-section-chevron ${!projectsExpanded ? 'collapsed' : ''}`}>
                {Icons.chevronDown}
              </span>
            </div>
            {projectsExpanded && (
              <div className="conversation-list">
                <button className="sidebar-nav-item">
                  {Icons.folder}
                  <span>New project</span>
                </button>
              </div>
            )}
          </div>

          {/* FIX #6: Your chats with chevron */}
          <div className="sidebar-section">
            <div 
              className="sidebar-section-header"
              onClick={() => setChatsExpanded(!chatsExpanded)}
            >
              <span className="sidebar-section-label">Your chats</span>
              <span className={`sidebar-section-chevron ${!chatsExpanded ? 'collapsed' : ''}`}>
                {Icons.chevronDown}
              </span>
            </div>
            
            {chatsExpanded && (
              <div className="conversation-list">
                {/* Today */}
                {groups.today.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onClick={() => onSelectConversation(conv.id)}
                  />
                ))}

                {/* Yesterday */}
                {groups.yesterday.length > 0 && (
                  <>
                    <div className="conversation-date-label">Yesterday</div>
                    {groups.yesterday.map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === activeConversationId}
                        onClick={() => onSelectConversation(conv.id)}
                      />
                    ))}
                  </>
                )}

                {/* Previous 7 Days */}
                {groups.lastWeek.length > 0 && (
                  <>
                    <div className="conversation-date-label">Previous 7 Days</div>
                    {groups.lastWeek.map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === activeConversationId}
                        onClick={() => onSelectConversation(conv.id)}
                      />
                    ))}
                  </>
                )}

                {/* Older */}
                {groups.older.length > 0 && (
                  <>
                    <div className="conversation-date-label">Older</div>
                    {groups.older.map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === activeConversationId}
                        onClick={() => onSelectConversation(conv.id)}
                      />
                    ))}
                  </>
                )}

                {filteredConvos.length === 0 && (
                  <div style={{ 
                    padding: '12px', 
                    color: 'var(--sidebar-text-muted)', 
                    fontSize: 'var(--text-sm)',
                    textAlign: 'center'
                  }}>
                    {searchQuery ? 'No results' : 'No conversations yet'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FIX #8: User profile with Upgrade button */}
        <div className="sidebar-footer">
          <div className="user-profile-wrapper">
            <button 
              className="user-profile"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="user-avatar">{userInitials}</div>
              <div className="user-info">
                <div className="user-name">{userName}</div>
                <div className="user-plan">{isLoggedIn ? 'Personal account' : 'Guest user'}</div>
              </div>
              <span className={`user-menu-chevron ${userMenuOpen ? 'open' : ''}`}>
                {Icons.chevronDown}
              </span>
            </button>
            
            {/* Dropdown Menu */}
            {userMenuOpen && (
              <>
                <div className="user-menu-backdrop" onClick={() => setUserMenuOpen(false)} />
                <div className="user-menu">
                  <button className="user-menu-item" onClick={() => {
                    setUserMenuOpen(false);
                    onOpenSettings?.();
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    <span>Settings</span>
                  </button>
                  <div className="user-menu-divider" />
                  {isLoggedIn ? (
                    <button className="user-menu-item logout" onClick={() => {
                      setUserMenuOpen(false);
                      onLogout?.();
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16,17 21,12 16,7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Log out</span>
                    </button>
                  ) : (
                    <button className="user-menu-item signin" onClick={() => {
                      setUserMenuOpen(false);
                      onSignIn?.();
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10,17 15,12 10,7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      <span>Sign in / Sign up</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="upgrade-btn">
            {Icons.star}
            <span>Upgrade</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// FIX #7, #19: Conversation item - NO icon, only "..." on hover
function ConversationItem({ 
  conversation, 
  isActive, 
  onClick 
}: { 
  conversation: Conversation; 
  isActive: boolean; 
  onClick: () => void;
}) {
  return (
    <button 
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="conversation-item-text">{conversation.title}</span>
      <div className="conversation-item-menu">
        <button 
          className="conversation-menu-btn"
          onClick={(e) => { e.stopPropagation(); }}
          title="More"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="6" cy="12" r="1.5" />
            <circle cx="18" cy="12" r="1.5" />
          </svg>
        </button>
      </div>
    </button>
  );
}
