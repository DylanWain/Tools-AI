// ============================================================================
// SettingsModal.tsx - Settings and API key management (Simplified)
// Works with local-first auth - same design as original
// ============================================================================

import React, { useState } from 'react';

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

type ApiProvider = 'openai' | 'anthropic' | 'google';

const PROVIDERS: { value: ApiProvider; label: string; placeholder: string; link: string }[] = [
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-...', link: 'https://platform.openai.com/api-keys' },
  { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', link: 'https://console.anthropic.com/' },
  { value: 'google', label: 'Google (Gemini)', placeholder: 'AIza...', link: 'https://aistudio.google.com/apikey' },
];

interface ApiKeys {
  openai: string | null;
  anthropic: string | null;
  google: string | null;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  onSaveApiKey: (provider: string, key: string) => void;
  onDeleteApiKey: (provider: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onSaveApiKey,
  onDeleteApiKey,
}) => {
  const [keyInputs, setKeyInputs] = useState<Record<ApiProvider, string>>({
    openai: '',
    anthropic: '',
    google: '',
  });
  const [showKeys, setShowKeys] = useState<Record<ApiProvider, boolean>>({
    openai: false,
    anthropic: false,
    google: false,
  });

  const handleSaveKey = (provider: ApiProvider) => {
    const key = keyInputs[provider];
    if (!key.trim()) return;
    onSaveApiKey(provider, key);
    setKeyInputs(prev => ({ ...prev, [provider]: '' }));
  };

  const handleDeleteKey = (provider: ApiProvider) => {
    onDeleteApiKey(provider);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          <div className="settings-section">
            <h3 className="settings-section-title">API Keys</h3>
            <p className="settings-section-desc">
              Add your API keys to enable AI responses. Keys are stored locally in your browser.
            </p>

            <div className="api-keys-list">
              {PROVIDERS.map(provider => {
                const hasKey = !!apiKeys[provider.value];
                const inputValue = keyInputs[provider.value];
                const showKey = showKeys[provider.value];

                return (
                  <div key={provider.value} className="api-key-item">
                    <div className="api-key-header">
                      <span className="api-key-label">{provider.label}</span>
                      {hasKey && (
                        <span className="api-key-status connected">
                          <CheckIcon /> Connected
                        </span>
                      )}
                    </div>

                    {hasKey ? (
                      <div className="api-key-saved">
                        <span className="api-key-hint">••••••••••••</span>
                        <button
                          className="api-key-delete"
                          onClick={() => handleDeleteKey(provider.value)}
                          title="Remove key"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ) : (
                      <div className="api-key-input-wrapper">
                        <input
                          type={showKey ? 'text' : 'password'}
                          className="api-key-input"
                          placeholder={provider.placeholder}
                          value={inputValue}
                          onChange={e => setKeyInputs(prev => ({ ...prev, [provider.value]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveKey(provider.value);
                          }}
                        />
                        <button
                          className="api-key-toggle"
                          onClick={() => setShowKeys(prev => ({ ...prev, [provider.value]: !prev[provider.value] }))}
                          title={showKey ? 'Hide' : 'Show'}
                        >
                          {showKey ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                        <button
                          className="api-key-save"
                          onClick={() => handleSaveKey(provider.value)}
                          disabled={!inputValue.trim()}
                        >
                          Save
                        </button>
                      </div>
                    )}

                    <a 
                      href={provider.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="api-key-link"
                    >
                      Get your {provider.label} API key →
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
