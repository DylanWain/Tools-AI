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
// Models configuration - Groq FREE models first, then BYOK premium
type Provider = 'groq' | 'openai' | 'anthropic' | 'google';

const MODELS: Array<{ id: string; name: string; desc: string; provider: Provider }> = [
  // FREE - Groq (unlimited)
  { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', desc: '🆓 Free', provider: 'groq' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: '🆓 Free (fast)', provider: 'groq' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: '🆓 Free', provider: 'groq' },
  // BYOK - OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Bring your key', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: 'Bring your key', provider: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5', desc: 'Bring your key', provider: 'openai' },
  // BYOK - Anthropic
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: 'Bring your key', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', desc: 'Bring your key', provider: 'anthropic' },
  // BYOK - Google
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Bring your key', provider: 'google' },
];

export default function ChatPage() {
  const router = useRouter();
  const { user, apiKeys, saveApiKey, removeApiKey, isLoading: authLoading } = useAuth();
  const {
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
  } = useServerChat();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showGetPlus, setShowGetPlus] = useState(false); // Hidden - no upsell
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-select Groq (always free, unlimited)
  useEffect(() => {
    // Groq is always available - no API key needed
    if (selectedModel.provider === 'groq') return;
    
    // If user has their own API keys, let them use those providers
    const provider = selectedModel.provider as keyof typeof apiKeys;
    if (apiKeys[provider]) return;
    
    // Otherwise default to Groq (free, unlimited)
    const groqModel = MODELS.find(m => m.provider === 'groq');
    if (groqModel) setSelectedModel(groqModel);
  }, [apiKeys, selectedModel.provider]);

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
  }, [createNewChat, selectedModel]);

  const handleSelectConversation = useCallback((id: string) => {
    selectConversation(id);
  }, [selectConversation]);

  // Check if we have API key for selected provider
  // Groq is FREE - no key needed
  const hasApiKey = selectedModel.provider === 'groq' || !!apiKeys[selectedModel.provider as keyof typeof apiKeys];

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
        onOpenSettings={() => setSettingsOpen(true)}
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
    </div>
  );
}
