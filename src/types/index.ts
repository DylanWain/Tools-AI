// ============================================================================
// PERSISTENT AI CHAT - TYPE DEFINITIONS
// ============================================================================

// Enums
export type SenderType = 'user' | 'assistant';
export type SummaryLevel = 'daily' | 'weekly' | 'project';
export type ApiProvider = 'openai' | 'anthropic' | 'google';
export type ExportFormat = 'pdf' | 'csv' | 'markdown' | 'json';
export type Theme = 'dark' | 'light';

export type ModelType =
  | 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o' | 'gpt-3.5-turbo'
  | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-3.5-sonnet'
  | 'gemini-pro' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

// ============================================================================
// USER
// ============================================================================

export interface UserSettings {
  theme: Theme;
  defaultModel: ModelType;
  defaultProvider: ApiProvider;
  memoryEnabled: boolean;
  autoSummarize: boolean;
  exportFormat: ExportFormat;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  settings: UserSettings;
}

export interface ApiKey {
  id: string;
  userId: string;
  provider: ApiProvider;
  keyHint: string | null;
  isValid: boolean;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONVERSATION
// ============================================================================

export interface Conversation {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  model: ModelType;
  provider: ApiProvider;
  systemInstruction: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  totalTokens: number;
  isArchived: boolean;
  isPinned: boolean;
  metadata: Record<string, unknown>;
}

export interface ConversationGroup {
  label: string;
  conversations: Conversation[];
}

// ============================================================================
// MESSAGE
// ============================================================================

export interface MessageMetadata {
  finishReason?: 'stop' | 'length' | 'content_filter';
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  sender: SenderType;
  content: string;
  hash: string;
  createdAt: string;
  tokenCount: number | null;
  model: ModelType | null;
  fileIds: string[];
  metadata: MessageMetadata;
}

export interface MessageDisplay extends Message {
  isStreaming?: boolean;
  streamedContent?: string;
  files?: FileAttachment[];
}

// ============================================================================
// EMBEDDING
// ============================================================================

export interface Embedding {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string | null;
  sourceType: 'message' | 'file' | 'summary';
  sourceId: string | null;
  embedding: number[];
  contentPreview: string | null;
  tokenCount: number | null;
  createdAt: string;
}

export interface SimilarMessage {
  messageId: string;
  conversationId?: string;
  conversationTitle?: string;
  content: string;
  sender: SenderType;
  createdAt: string;
  similarity: number;
}

// ============================================================================
// SUMMARY
// ============================================================================

export interface Summary {
  id: string;
  userId: string;
  conversationId: string;
  level: SummaryLevel;
  content: string;
  hash: string;
  periodStart: string;
  periodEnd: string;
  messageIds: string[];
  tokenCount: number | null;
  model: ModelType | null;
  version: number;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// FILE
// ============================================================================

export interface FileAttachment {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  contentHash: string | null;
  extractedText: string | null;
  isProcessed: boolean;
  processingError: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// EXPORT
// ============================================================================

export interface Export {
  id: string;
  userId: string;
  conversationId: string | null;
  format: ExportFormat;
  storagePath: string;
  fileSize: number | null;
  messageCount: number | null;
  includesFiles: boolean;
  includesSummaries: boolean;
  verificationHash: string | null;
  createdAt: string;
  expiresAt: string | null;
}

// ============================================================================
// FOLDER
// ============================================================================

export interface Folder {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

export interface ContextBlock {
  type: 'system' | 'project_summary' | 'weekly_summary' | 'daily_summary' | 'semantic' | 'recent' | 'current';
  content: string;
  tokenCount: number;
  sourceId?: string;
}

export interface BuiltContext {
  blocks: ContextBlock[];
  totalTokens: number;
  truncated: boolean;
  truncationDetails?: {
    droppedSemanticCount: number;
    droppedRecentCount: number;
  };
}

// ============================================================================
// WEBSOCKET
// ============================================================================

export type WebSocketEventType =
  | 'message_start'
  | 'message_delta'
  | 'message_complete'
  | 'typing_start'
  | 'typing_stop'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketEventType;
  conversationId: string;
  data: {
    messageId?: string;
    content?: string;
    delta?: string;
    error?: string;
  };
}

// ============================================================================
// API REQUESTS/RESPONSES
// ============================================================================

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  fileIds?: string[];
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
  tokensUsed: { prompt: number; completion: number; total: number };
}

export interface CreateConversationRequest {
  title?: string;
  model?: ModelType;
  provider?: ApiProvider;
  systemInstruction?: string;
  folderId?: string;
}

export interface SearchRequest {
  query: string;
  conversationId?: string;
  limit?: number;
}

export interface SearchResponse {
  results: SimilarMessage[];
  totalFound: number;
}

export interface ExportRequest {
  conversationId: string;
  format: ExportFormat;
  includeFiles?: boolean;
  includeSummaries?: boolean;
}

export interface ExportResponse {
  export: Export;
  downloadUrl: string;
}

export interface SaveApiKeyRequest {
  provider: ApiProvider;
  apiKey: string;
}

export interface GenerateSummaryRequest {
  conversationId: string;
  level: SummaryLevel;
  force?: boolean;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
}

export interface UIState {
  sidebarOpen: boolean;
  settingsModalOpen: boolean;
  searchModalOpen: boolean;
  exportModalOpen: boolean;
  theme: Theme;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface SidebarProps {
  groups: ConversationGroup[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export interface MessageListProps {
  messages: MessageDisplay[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
}

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFileUpload: (files: File[]) => void;
  files: File[];
  onRemoveFile: (index: number) => void;
  isDisabled: boolean;
  placeholder?: string;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKey[];
  onSaveApiKey: (provider: ApiProvider, key: string) => Promise<void>;
  onDeleteApiKey: (provider: ApiProvider) => Promise<void>;
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

export interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  multiple?: boolean;
  children?: React.ReactNode;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ChatError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ChatError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
