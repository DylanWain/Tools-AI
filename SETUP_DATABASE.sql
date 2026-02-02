-- ============================================================================
-- COMPLETE DATABASE SETUP FOR UNLIMITED MEMORY
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create users table (supports both registered and anonymous users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Chat',
    model TEXT DEFAULT 'gpt-4o',
    provider TEXT DEFAULT 'openai',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);

-- Step 4: Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

-- Step 5: Create embeddings table for vector search
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_id UUID,
    source_type TEXT DEFAULT 'message',
    source_id UUID,
    content_preview TEXT,
    chunk_index INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 1,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Add any missing columns to existing embeddings table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'embeddings' AND column_name = 'embedding') THEN
        ALTER TABLE embeddings ADD COLUMN embedding vector(1536);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'embeddings' AND column_name = 'content_preview') THEN
        ALTER TABLE embeddings ADD COLUMN content_preview TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'embeddings' AND column_name = 'chunk_index') THEN
        ALTER TABLE embeddings ADD COLUMN chunk_index INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'embeddings' AND column_name = 'total_chunks') THEN
        ALTER TABLE embeddings ADD COLUMN total_chunks INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'embeddings' AND column_name = 'message_id') THEN
        ALTER TABLE embeddings ADD COLUMN message_id UUID;
    END IF;
END $$;

-- Step 4: Create index for fast similarity search
DROP INDEX IF EXISTS embeddings_embedding_idx;
CREATE INDEX embeddings_embedding_idx ON embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 5: Create the main similarity search function
DROP FUNCTION IF EXISTS match_embeddings(vector(1536), uuid, int);
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(1536),
    match_user_id uuid,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    message_id uuid,
    conversation_id uuid,
    content text,
    similarity float,
    created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.message_id,
        e.conversation_id,
        e.content_preview as content,
        1 - (e.embedding <=> query_embedding) as similarity,
        e.created_at
    FROM embeddings e
    WHERE e.user_id = match_user_id
      AND e.embedding IS NOT NULL
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 6: Create files table for storing generated files
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_id UUID,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    storage_path TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Create memories table for smart memory system
-- This stores extracted facts about the user, loaded into every chat
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'facts',
    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    source TEXT DEFAULT 'extracted',
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast memory loading
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_importance_idx ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS memories_last_used_idx ON memories(last_used_at DESC);

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION match_embeddings TO anon, authenticated, service_role;

-- Done!
SELECT 'Database setup complete!' as status;
