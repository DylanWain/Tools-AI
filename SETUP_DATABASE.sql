-- ============================================================================
-- LIVE DATABASE SCHEMA - Tools AI (shared with Chrome extension)
-- This documents the ACTUAL production schema in Supabase
-- DO NOT run this blindly - it's for reference. Use ALTER TABLE for changes.
-- ============================================================================

-- Users table (shared between web app and extension)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    settings JSONB NOT NULL DEFAULT '{"theme": "dark", "defaultModel": "gpt-4", "exportFormat": "pdf", "autoSummarize": true, "memoryEnabled": true, "defaultProvider": "openai"}'::jsonb
);

-- Conversations table (shared between web app and extension)
-- NOTE: id is TEXT not UUID, no auto-generation - app must provide ID
-- NOTE: Both web app (platform='toolsai') and extension use this table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,                    -- App-generated UUID string
    email TEXT NOT NULL,                    -- User email or anon email
    platform TEXT,                          -- 'toolsai', 'chatgpt', 'claude', 'gemini'
    title TEXT,
    url TEXT,                               -- Source URL (extension captures this)
    message_count INTEGER DEFAULT 0,
    code_block_count INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,                           -- References users.id (nullable for extension)
    model TEXT DEFAULT 'gpt-4o',
    provider TEXT DEFAULT 'openai'
);

-- Messages table (shared between web app and extension)
-- NOTE: id is TEXT not UUID - app must provide ID
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                    -- App-generated UUID string
    conversation_id TEXT NOT NULL,          -- References conversations.id (no FK constraint)
    email TEXT NOT NULL,
    sender TEXT,                            -- 'user' or 'assistant'
    content TEXT,
    content_hash TEXT,                      -- For deduplication
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,                           -- References users.id (nullable)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Files table
-- NOTE: id is TEXT, no user_id column - uses email for ownership
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,                    -- App-generated UUID string
    conversation_id TEXT,
    email TEXT NOT NULL,
    filename TEXT,
    title TEXT,
    description TEXT,
    mime_type TEXT,
    platform TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    file_content TEXT DEFAULT ''            -- Actual file content stored as text
);

-- Memories table (AI memory system - extracted facts about users)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,                  -- References users.id
    content TEXT NOT NULL,
    category TEXT DEFAULT 'facts',
    importance INTEGER DEFAULT 5,
    source TEXT DEFAULT 'extracted',
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_email ON conversations(email);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_email ON messages(email);
CREATE INDEX IF NOT EXISTS idx_files_email ON files(email);
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
