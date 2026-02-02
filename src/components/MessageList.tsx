// ============================================================================
// MessageList.tsx - Messages with File Downloads
// Supports downloading generated code files, zips, etc.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';

// Icons for message actions
const Icons = {
  copy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  thumbsUp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  ),
  thumbsDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  ),
  share: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  ),
  more: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  ),
  zip: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" x2="12" y1="11" y2="17" />
      <line x1="9" x2="15" y1="14" y2="14" />
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

// File type to icon color mapping
const FILE_COLORS: Record<string, string> = {
  jsx: '#61dafb',
  tsx: '#3178c6',
  js: '#f7df1e',
  ts: '#3178c6',
  html: '#e34f26',
  css: '#1572b6',
  py: '#3776ab',
  sql: '#336791',
  json: '#292929',
  sh: '#4eaa25',
  zip: '#f9a825',
};

export interface FileInfo {
  id: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  downloadUrl: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  files?: FileInfo[];
  zipUrl?: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  streamingContent?: string;
}

export default function MessageList({ 
  messages, 
  isLoading, 
  streamingContent 
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isLoading && !streamingContent) {
    return null;
  }

  return (
    <div className="messages-viewport">
      <div className="messages-container">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {streamingContent && (
          <div className="message message-assistant">
            <div className="message-assistant-text">
              {streamingContent}
              <span className="streaming-cursor" />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && !streamingContent && (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // User message - right aligned gray bubble
  if (message.role === 'user') {
    return (
      <div className="message message-user">
        <div className="message-user-bubble">{message.content}</div>
      </div>
    );
  }

  // Assistant message with file downloads
  const hasFiles = message.files && message.files.length > 0;
  
  return (
    <div className="message message-assistant">
      <div className="message-assistant-text">
        <FormattedContent content={message.content} />
      </div>
      
      {/* File Downloads - Claude Style Cards */}
      {hasFiles && (
        <div className="message-files">
          {message.files!.map((file) => (
            <div key={file.id} className="file-card">
              <div className="file-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="file-card-info">
                <span className="file-card-name">{file.filename}</span>
                <span className="file-card-type">{file.fileType.toUpperCase()}</span>
              </div>
              <button 
                className="file-card-download"
                onClick={() => downloadFile(file.downloadUrl, file.filename)}
              >
                Download
              </button>
            </div>
          ))}
          
          {/* Zip download card if multiple files */}
          {message.zipUrl && message.files && message.files.length > 1 && (
            <div className="file-card file-card-zip">
              <div className="file-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="file-card-info">
                <span className="file-card-name">All Files ({message.files.length})</span>
                <span className="file-card-type">ZIP</span>
              </div>
              <button 
                className="file-card-download"
                onClick={() => downloadFile(message.zipUrl!, 'project.zip')}
              >
                Download
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="message-actions">
        <button 
          className="message-action-btn" 
          onClick={copyToClipboard} 
          title={copied ? 'Copied!' : 'Copy'}
        >
          {copied ? '✓' : Icons.copy}
        </button>
        <button className="message-action-btn" title="Good response">
          {Icons.thumbsUp}
        </button>
        <button className="message-action-btn" title="Bad response">
          {Icons.thumbsDown}
        </button>
        <button className="message-action-btn" title="Share">
          {Icons.share}
        </button>
        <button className="message-action-btn" title="Regenerate">
          {Icons.refresh}
        </button>
        <button className="message-action-btn" title="More">
          {Icons.more}
        </button>
      </div>
    </div>
  );
}

// Format content with code blocks
function FormattedContent({ content }: { content: string }) {
  // Simple code block detection and formatting
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Extract language and code
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
          if (match) {
            const language = match[1] || 'code';
            const code = match[2];
            return (
              <pre key={i} className="code-block" data-language={language}>
                <code>{code}</code>
              </pre>
            );
          }
        }
        // Regular text - preserve line breaks
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function EmptyState() {
  return (
    <div className="messages-viewport">
      <div className="empty-state">
        <h2 className="empty-state-title">What can I help with?</h2>
      </div>
    </div>
  );
}
