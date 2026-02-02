-- ============================================================================
-- ADD MEMORIES TABLE - Run this in Supabase SQL Editor
-- This enables the smart memory system like ChatGPT/Claude/Gemini
-- ============================================================================

-- Create memories table for smart memory system
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

-- Create indexes for fast memory loading (100 memories in <50ms)
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_importance_idx ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS memories_last_used_idx ON memories(last_used_at DESC);

-- Verify it worked
SELECT 'Memories table created successfully!' as status;
SELECT COUNT(*) as total_memories FROM memories;
