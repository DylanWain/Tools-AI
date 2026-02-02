// ============================================================================
// ChatPage.tsx - Main Chat Interface 
// Uses Supabase for persistence, requires authentication
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import MessageList, { Message } from './MessageList';
import Composer from './Composer';
import SettingsModal from './SettingsModal';
import { useAuth } from '../contexts/AuthContext';
import { useServerChat } from '../hooks/useServerChat';

// Icons
const Icons = {
  sidebar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  ),
  pencil: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  star: (
    <svg className="star-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  x: (
    <svg className="close-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  share: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  ),
  moreHorizontal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
  check: (
    <svg className="dropdown-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

// Models configuration - ORIGINAL WORKING model names
const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Most capable', provider: 'openai' as const },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: 'Fast & capable', provider: 'openai' as const },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5', desc: 'Fast & efficient', provider: 'openai' as const },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: 'Latest Claude', provider: 'anthropic' as const },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', desc: 'Best Claude 3.5', provider: 'anthropic' as const },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Google AI', provider: 'google' as const },
];

export default function ChatPage() {
  const router = useRouter();
  const { user, apiKeys, saveApiKey, removeApiKey, isAuthenticated, isLoggedIn, isLoading: authLoading, logout, login, register, error: authError, clearError } = useAuth();
  const {
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
  } = useServerChat();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showGetPlus, setShowGetPlus] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Auto-show settings modal when free tier exhausted
  useEffect(() => {
    if (freeTierExhausted) {
      setSettingsOpen(true);
    }
  }, [freeTierExhausted]);

  // Auto-select a model that has an API key configured
  useEffect(() => {
    // Check if current model's provider has a key
    if (apiKeys[selectedModel.provider]) return;
    
    // Find a model with an available API key
    if (apiKeys.anthropic) {
      const claudeModel = MODELS.find(m => m.provider === 'anthropic');
      if (claudeModel) setSelectedModel(claudeModel);
    } else if (apiKeys.openai) {
      const openaiModel = MODELS.find(m => m.provider === 'openai');
      if (openaiModel) setSelectedModel(openaiModel);
    } else if (apiKeys.google) {
      const googleModel = MODELS.find(m => m.provider === 'google');
      if (googleModel) setSelectedModel(googleModel);
    }
  }, [apiKeys, selectedModel.provider]);

  // When user authenticates, send the pending message
  useEffect(() => {
    if (isAuthenticated && pendingMessage) {
      sendMessage(pendingMessage, selectedModel.id, selectedModel.provider);
      setPendingMessage(null);
      setShowAuthModal(false);
    }
  }, [isAuthenticated, pendingMessage, sendMessage, selectedModel]);

  // Transform messages for MessageList component
  const transformedMessages: Message[] = messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
    files: m.files,
    zipUrl: m.zipUrl,
  }));

  // Transform conversations for Sidebar
  const transformedConversations = conversations.map(c => ({
    id: c.id,
    title: c.title,
    updatedAt: new Date(c.updatedAt),
  }));

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    // If files are included, process them and include in message
    let messageWithFiles = content;
    if (files && files.length > 0) {
      // For now, read text files and include their content
      // Images will be described as [attached image]
      const fileContents: string[] = [];
      
      for (const file of files) {
        if (file.type.startsWith('text/') || 
            file.name.endsWith('.txt') || 
            file.name.endsWith('.md') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.tsx') ||
            file.name.endsWith('.jsx') ||
            file.name.endsWith('.html') ||
            file.name.endsWith('.css')) {
          try {
            const text = await file.text();
            fileContents.push(`\n\n--- File: ${file.name} ---\n${text}\n--- End of ${file.name} ---`);
          } catch (e) {
            fileContents.push(`\n[Attached file: ${file.name}]`);
          }
        } else if (file.type.startsWith('image/')) {
          fileContents.push(`\n[Attached image: ${file.name}]`);
        } else {
          fileContents.push(`\n[Attached file: ${file.name} (${file.type || 'unknown type'})]`);
        }
      }
      
      messageWithFiles = content + fileContents.join('');
    }
    
    await sendMessage(messageWithFiles, selectedModel.id, selectedModel.provider);
  }, [selectedModel, sendMessage]);

  const handleStop = useCallback(() => {
    stopGeneration();
  }, [stopGeneration]);

  const handleNewChat = useCallback(() => {
    createNewChat(selectedModel.id, selectedModel.provider);
  }, [isAuthenticated, createNewChat, selectedModel]);

  const handleSelectConversation = useCallback((id: string) => {
    selectConversation(id);
  }, [selectConversation]);

  // Check if we have API key for selected provider
  const hasApiKey = isAuthenticated ? apiKeys[selectedModel.provider] : true;

  // Show loading while checking auth - AFTER all hooks
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#212121',
        color: '#ececec',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={transformedConversations}
        activeConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        userName={user?.displayName || 'Guest'}
        isLoggedIn={isLoggedIn}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={logout}
        onSignIn={() => setShowAuthModal(true)}
      />

      <main className="main-content">
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            {/* Show sidebar toggle when sidebar is closed */}
            {!sidebarOpen && (
              <>
                <button 
                  className="header-icon-btn"
                  onClick={() => setSidebarOpen(true)}
                  title="Open sidebar"
                >
                  {Icons.sidebar}
                </button>
                <button 
                  className="header-icon-btn"
                  onClick={handleNewChat}
                  title="New chat"
                >
                  {Icons.pencil}
                </button>
              </>
            )}

            {/* Model Selector */}
            <div className="dropdown-wrapper">
              <button 
                className="model-selector"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              >
                {selectedModel.name}
                {Icons.chevronDown}
              </button>

              {modelDropdownOpen && (
                <div className="dropdown-overlay" onClick={() => setModelDropdownOpen(false)} />
              )}

              <div className={`dropdown-menu ${modelDropdownOpen ? 'open' : ''}`}>
                {MODELS.map((model) => (
                  <button
                    key={model.id}
                    className={`dropdown-item ${selectedModel.id === model.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedModel(model);
                      setModelDropdownOpen(false);
                    }}
                  >
                    <div className="dropdown-item-content">
                      <div className="dropdown-item-title">{model.name}</div>
                      <div className="dropdown-item-desc">{model.desc}</div>
                    </div>
                    {selectedModel.id === model.id && Icons.check}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="header-right">
            {/* API Key warning */}
            {!hasApiKey && (
              <button 
                className="api-key-warning-btn"
                onClick={() => setSettingsOpen(true)}
              >
                ⚠️ Add {selectedModel.provider} API key
              </button>
            )}

            {/* Get Plus button */}
            {showGetPlus && (
              <button className="get-plus-btn" onClick={() => setShowGetPlus(false)}>
                {Icons.star}
                <span>Get Plus</span>
                <span onClick={(e) => { e.stopPropagation(); setShowGetPlus(false); }}>
                  {Icons.x}
                </span>
              </button>
            )}

            {/* Share button - only when messages exist */}
            {transformedMessages.length > 0 && (
              <button className="header-icon-btn" title="Share">
                {Icons.share}
              </button>
            )}

            {/* Settings button */}
            <button className="header-icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
              {Icons.settings}
            </button>

            {/* More menu */}
            <button className="header-icon-btn" title="More">
              {Icons.moreHorizontal}
            </button>
          </div>
        </header>

        {/* Error display */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* EMPTY STATE: Centered greeting + input */}
        {transformedMessages.length === 0 && !isLoading && !isStreaming ? (
          <div className="chat-empty-centered">
            <h1 className="chat-greeting">What can I help with?</h1>
            <Composer 
              onSend={handleSend}
              onStop={handleStop}
              isGenerating={isLoading || isStreaming}
            />
          </div>
        ) : (
          /* HAS MESSAGES: Messages list + bottom input */
          <>
            <MessageList 
              messages={transformedMessages} 
              isLoading={isLoading || isStreaming}
              streamingContent={streamingContent}
            />

            <Composer 
              onSend={handleSend}
              onStop={handleStop}
              isGenerating={isLoading || isStreaming}
            />
          </>
        )}
      </main>

      {/* Settings Modal - API Keys */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveApiKey={(provider, key) => saveApiKey(provider as 'openai' | 'anthropic' | 'google', key)}
        onDeleteApiKey={(provider) => removeApiKey(provider as 'openai' | 'anthropic' | 'google')}
      />

      {/* Auth Modal - Sign In / Sign Up */}
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Auth Modal Component - Sign In / Sign Up
// ============================================================================
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { login, register, error, clearError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        await register(email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch (err) {
      // Error is handled by useAuth
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setLocalError(null);
    clearError();
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        
        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p>{isRegister ? 'Sign up to start chatting' : 'Sign in to continue'}</p>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="auth-input-group">
              <label>Name (optional)</label>
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="auth-input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {(localError || error) && (
            <div className="auth-error">
              {localError || error}
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={submitting}>
            {submitting ? 'Please wait...' : (isRegister ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="auth-modal-footer">
          {isRegister ? (
            <p>Already have an account? <button onClick={switchMode}>Sign in</button></p>
          ) : (
            <p>Don't have an account? <button onClick={switchMode}>Sign up</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
