-- ============================================================================
-- Phase 2A — Live shared folder for collaborative coding.
--
-- When members are bound to a Veronum project, the desktop app watches
-- each member's local cwd (the directory of their bound Claude Code
-- session) and pushes file content here on every save. Other members'
-- Veronum instances subscribe to Realtime updates and write incoming
-- changes to their own local copy of the folder.
--
-- This gives a "shared project" experience across ANY editor (Claude
-- Code, Cursor, VS Code, Codex, etc.) without needing IDE-specific
-- extensions: each side just edits files normally; Veronum keeps the
-- folders in lockstep.
--
-- MVP scope:
--   • Text files only (utf-8), max 1 MB per file
--   • Last-write-wins conflict resolution (no OT/CRDT yet)
--   • Skip node_modules, .git, build outputs (enforced in the desktop
--     watcher, not at the DB level — the table is a generic file store)
--   • Soft-delete via `content = null`
-- ============================================================================

create table if not exists public.veronum_shared_files (
  id bigserial primary key,
  project_id uuid not null references public.veronum_projects(id) on delete cascade,
  -- relative to each member's bound cwd. No leading slash, no `..` segments.
  file_path text not null,
  -- null = deleted; non-null = full file content (utf-8 text only in MVP)
  content text,
  bytes_size int not null default 0,
  source_app text,                              -- 'Claude Code', 'VS Code', 'Cursor', 'Codex', 'unknown'
  updated_by uuid references public.veronum_users(id) on delete set null,
  updated_by_name text not null,
  updated_by_color text not null default '#cc785c',
  -- Monotonic version per (project, path) to make tail-subscriber
  -- ignore stale events. Bumped on every upsert.
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- One row per (project, file_path). Subsequent saves UPSERT on this key.
create unique index if not exists veronum_shared_files_path_idx
  on public.veronum_shared_files(project_id, file_path);

create index if not exists veronum_shared_files_updated_idx
  on public.veronum_shared_files(project_id, updated_at desc);

-- Realtime publication so subscribers receive change events.
do $$
begin
  alter publication supabase_realtime add table public.veronum_shared_files;
exception when duplicate_object then null;
end $$;

-- ─── Activity feed (separate from the file table) ─────────────────────
-- Each save also writes an immutable activity row so the Veronum overlay
-- can render a sortable feed: who edited what file when, from which app.
-- The file table has CURRENT content; this table has the HISTORY of who
-- did what.
create table if not exists public.veronum_file_changes (
  id bigserial primary key,
  project_id uuid not null references public.veronum_projects(id) on delete cascade,
  file_path text not null,
  change_kind text not null check (change_kind in ('create', 'modify', 'delete', 'rename')),
  bytes_before int,
  bytes_after int,
  -- Lines-changed estimate from the desktop side (cheap heuristic; not
  -- a real diff). Useful for the activity feed display.
  lines_added int,
  lines_removed int,
  source_app text,
  author_id uuid references public.veronum_users(id) on delete set null,
  author_name text not null,
  author_color text not null default '#cc785c',
  created_at timestamptz not null default now()
);

create index if not exists veronum_file_changes_project_time_idx
  on public.veronum_file_changes(project_id, created_at desc);

create index if not exists veronum_file_changes_author_idx
  on public.veronum_file_changes(project_id, author_id, created_at desc);

do $$
begin
  alter publication supabase_realtime add table public.veronum_file_changes;
exception when duplicate_object then null;
end $$;

-- ─── RLS ───────────────────────────────────────────────────────────────
-- Service role bypasses RLS (used by /api/v1/* with the service key);
-- direct anon-key reads from Realtime go through these policies.
alter table public.veronum_shared_files enable row level security;
alter table public.veronum_file_changes enable row level security;

drop policy if exists "veronum members can read shared files" on public.veronum_shared_files;
create policy "veronum members can read shared files"
  on public.veronum_shared_files for select
  using (public.is_veronum_project_member(project_id, auth.uid()));

drop policy if exists "veronum members can read file changes" on public.veronum_file_changes;
create policy "veronum members can read file changes"
  on public.veronum_file_changes for select
  using (public.is_veronum_project_member(project_id, auth.uid()));
