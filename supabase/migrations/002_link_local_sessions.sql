-- ============================================================================
-- Phase 1A.1 — Link a Veronum project member to their local Claude Code
-- session. Each member binds exactly ONE local JSONL to the shared room;
-- the desktop app's JSONL watcher reads it and mirrors new turns into
-- veronum_messages so all members see each other's work in real time.
--
-- Design notes:
--   • A member's link is mutable — they can re-bind to a different local
--     session later (e.g. they forked their thread).
--   • Dedup is enforced via metadata->>'source_uuid' + metadata->>'line_idx'
--     so the watcher can replay/backfill without creating duplicates.
--   • RLS already protects the parent member row; no new policies needed.
-- ============================================================================

alter table public.veronum_project_members
  add column if not exists linked_claude_session_uuid text,
  add column if not exists linked_claude_cwd text,
  add column if not exists linked_at timestamptz;

create index if not exists veronum_project_members_linked_idx
  on public.veronum_project_members(linked_claude_session_uuid)
  where linked_claude_session_uuid is not null;

-- ─── Dedup constraint for mirrored turns ───────────────────────────────────
-- The watcher tags every pushed row with metadata.source_uuid (= the local
-- session UUID) + metadata.line_idx (= the 0-based line in the JSONL it
-- came from). A unique index on (project_id, source_uuid, line_idx) makes
-- backfill + tail idempotent: if the watcher restarts, it can re-push
-- without creating duplicates.
create unique index if not exists veronum_messages_source_dedup_idx
  on public.veronum_messages(
    project_id,
    (metadata->>'source_uuid'),
    ((metadata->>'line_idx')::int)
  )
  where metadata ? 'source_uuid' and metadata ? 'line_idx';
