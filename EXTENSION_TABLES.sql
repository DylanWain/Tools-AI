-- ============================================================================
-- EXTENSION TABLES - Run in Supabase SQL Editor
-- Supports the Tools AI Chrome extension cloud sync
-- ============================================================================

-- Waitlist table for landing page signups
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'landing',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extension conversations (captured from ChatGPT, Claude, Gemini)
CREATE TABLE IF NOT EXISTS extension_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform TEXT NOT NULL DEFAULT 'unknown',
    platform_url TEXT,
    title TEXT DEFAULT 'Untitled',
    message_count INTEGER DEFAULT 0,
    code_block_count INTEGER DEFAULT 0,
    first_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ext_conv_user_idx ON extension_conversations(user_id);
CREATE INDEX IF NOT EXISTS ext_conv_platform_idx ON extension_conversations(platform);
CREATE INDEX IF NOT EXISTS ext_conv_updated_idx ON extension_conversations(updated_at DESC);

-- Extension messages
CREATE TABLE IF NOT EXISTS extension_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES extension_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    sender TEXT NOT NULL DEFAULT 'assistant',
    content TEXT NOT NULL DEFAULT '',
    has_code BOOLEAN DEFAULT FALSE,
    code_blocks JSONB DEFAULT '[]',
    message_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ext_msg_conv_idx ON extension_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ext_msg_user_idx ON extension_messages(user_id);
CREATE INDEX IF NOT EXISTS ext_msg_code_idx ON extension_messages(has_code) WHERE has_code = TRUE;

-- Full-text search index on messages
CREATE INDEX IF NOT EXISTS ext_msg_content_idx ON extension_messages USING gin(to_tsvector('english', content));

-- Extension files (downloads captured from AI platforms)
CREATE TABLE IF NOT EXISTS extension_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    conversation_id UUID,
    filename TEXT NOT NULL DEFAULT 'unknown',
    file_type TEXT,
    file_size INTEGER,
    source_url TEXT,
    platform TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ext_files_user_idx ON extension_files(user_id);

-- Full-text search function for extension messages
CREATE OR REPLACE FUNCTION search_extension_messages(
    search_user_id UUID,
    search_query TEXT,
    result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    message_id UUID,
    conversation_id UUID,
    conversation_title TEXT,
    platform TEXT,
    sender TEXT,
    content TEXT,
    has_code BOOLEAN,
    message_index INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id AS message_id,
        m.conversation_id,
        c.title AS conversation_title,
        c.platform,
        m.sender,
        m.content,
        m.has_code,
        m.message_index,
        m.created_at
    FROM extension_messages m
    JOIN extension_conversations c ON c.id = m.conversation_id
    WHERE m.user_id = search_user_id
      AND to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
    ORDER BY ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_query)) DESC
    LIMIT result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_extension_messages TO anon, authenticated, service_role;

SELECT 'Extension tables created!' as status;
