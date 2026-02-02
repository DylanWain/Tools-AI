// ============================================================================
// Composer.tsx - Exact ChatGPT Input
// FIX #9: Plus button opens menu with Create image, Thinking, etc.
// FIX #13: Correct layout - + left, mic, voice/send right
// ============================================================================

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

// Icons
const Icons = {
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  ),
  mic: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  ),
  waveform: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="4" y1="12" x2="4" y2="12" />
      <line x1="8" y1="8" x2="8" y2="16" />
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="16" y1="8" x2="16" y2="16" />
      <line x1="20" y1="12" x2="20" y2="12" />
    </svg>
  ),
  arrowUp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="19" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  stop: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  ),
  // Plus menu icons
  upload: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  ),
  image: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  brain: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  cart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  ),
  moreHorizontal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
};

interface ComposerProps {
  onSend: (message: string, files?: File[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  placeholder?: string;
}

export default function Composer({ 
  onSend, 
  onStop,
  disabled = false, 
  isGenerating = false,
  placeholder = "Ask anything" 
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    }
    setPlusMenuOpen(false);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (isGenerating && onStop) {
      onStop();
      return;
    }
    const trimmed = value.trim();
    if ((trimmed || selectedFiles.length > 0) && !disabled) {
      onSend(trimmed, selectedFiles.length > 0 ? selectedFiles : undefined);
      setValue('');
      setSelectedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = (value.trim().length > 0 || selectedFiles.length > 0) && !disabled;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="composer-wrapper">
      <div className="composer-container">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xls,.xlsx,.py,.js,.ts,.tsx,.jsx,.html,.css"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* FIX #9: Plus Menu */}
        {plusMenuOpen && (
          <div className="plus-menu-overlay" onClick={() => setPlusMenuOpen(false)} />
        )}
        <div className={`plus-menu ${plusMenuOpen ? 'open' : ''}`}>
          <button className="plus-menu-item" onClick={() => fileInputRef.current?.click()}>
            {Icons.upload}
            <div className="plus-menu-item-content">
              <div>Upload files</div>
              <div className="plus-menu-item-desc">Unlimited with Tools AI</div>
            </div>
          </button>
          <div className="plus-menu-divider" />
          <button className="plus-menu-item">
            {Icons.image}
            <span>Create image</span>
          </button>
          <button className="plus-menu-item">
            {Icons.brain}
            <span>Thinking</span>
          </button>
          <button className="plus-menu-item">
            {Icons.search}
            <span>Deep research</span>
          </button>
          <button className="plus-menu-item">
            {Icons.cart}
            <span>Shopping research</span>
          </button>
          <div className="plus-menu-divider" />
          <button className="plus-menu-item">
            {Icons.moreHorizontal}
            <span>More</span>
            <span className="plus-menu-item-arrow">{Icons.chevronRight}</span>
          </button>
        </div>

        {/* Selected files display */}
        {selectedFiles.length > 0 && (
          <div className="selected-files">
            {selectedFiles.map((file, index) => (
              <div key={index} className="selected-file">
                <div className="selected-file-icon">
                  {file.type.startsWith('image/') ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                </div>
                <div className="selected-file-info">
                  <div className="selected-file-name">{file.name}</div>
                  <div className="selected-file-size">{formatFileSize(file.size)}</div>
                </div>
                <button className="selected-file-remove" onClick={() => removeFile(index)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer">
          {/* FIX #13: Plus button on left */}
          <button 
            className="composer-plus-btn" 
            onClick={() => setPlusMenuOpen(!plusMenuOpen)}
            title="More options"
          >
            {Icons.plus}
          </button>

          {/* Input */}
          <div className="composer-input-wrapper">
            <textarea
              ref={textareaRef}
              className="composer-input"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              rows={1}
            />
          </div>

          {/* FIX #13: Right side - mic and voice/send button */}
          <div className="composer-right">
            {/* Mic button - shown when no text */}
            {!canSend && !isGenerating && (
              <button className="composer-mic-btn" title="Use microphone">
                {Icons.mic}
              </button>
            )}
            
            {/* Voice/Send/Stop button */}
            {isGenerating ? (
              <button className="composer-stop-btn" onClick={handleSubmit} title="Stop">
                {Icons.stop}
              </button>
            ) : canSend ? (
              <button className="composer-send-btn" onClick={handleSubmit} title="Send">
                {Icons.arrowUp}
              </button>
            ) : (
              <button className="composer-voice-btn" title="Voice mode">
                {Icons.waveform}
              </button>
            )}
          </div>
        </div>

        <div className="composer-footer">
          <span className="composer-disclaimer">
            Tools AI can make mistakes. Check important info.
          </span>
        </div>
      </div>
    </div>
  );
}
