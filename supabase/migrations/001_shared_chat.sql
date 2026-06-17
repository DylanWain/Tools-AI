-- ============================================================================
-- Veronum shared chat — schema for multi-user collaboration on AI conversations.
--
-- All tables are PREFIXED with `veronum_` to coexist alongside the existing
-- Tools-AI Chrome extension schema (users, conversations, messages, embeddings,
-- summaries, memories) in the same Supabase project.
--
-- Run via Supabase SQL editor or `supabase db push`.
-- Requires the `pgcrypto` extension (built into Supabase).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Veronum users ──────────────────────────────────────────────────────────
-- Lightweight: keyed by install_token (per-DMG-install UUID stored in
-- Veronum.app's userData on first run). Separate from the Tools-AI extension's
-- own `users` table.
create table if not exists public.veronum_users (
  id uuid primary key default gen_random_uuid(),
  install_token text unique not null,
  display_name text not null,
  avatar_color text not null default '#cc785c',
  email text,
  created_at timestamptz not null default now()
);

-- ─── Veronum projects ───────────────────────────────────────────────────────
create table if not exists public.veronum_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#cc785c',
  owner_id uuid not null references public.veronum_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists veronum_projects_owner_idx on public.veronum_projects(owner_id);

-- ─── Project members ────────────────────────────────────────────────────────
do $$ begin
  create type public.veronum_project_role as enum ('owner', 'participant', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.veronum_project_members (
  project_id uuid not null references public.veronum_projects(id) on delete cascade,
  user_id uuid not null references public.veronum_users(id) on delete cascade,
  role public.veronum_project_role not null default 'participant',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists veronum_project_members_user_idx on public.veronum_project_members(user_id);

-- ─── Project invites (shareable links) ──────────────────────────────────────
create table if not exists public.veronum_project_invites (
  token text primary key,
  project_id uuid not null references public.veronum_projects(id) on delete cascade,
  role public.veronum_project_role not null default 'participant',
  created_by uuid not null references public.veronum_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  uses_remaining int
);

create index if not exists veronum_project_invites_project_idx on public.veronum_project_invites(project_id);

-- ─── Project messages (the shared chat thread) ──────────────────────────────
do $$ begin
  create type public.veronum_message_kind as enum ('human', 'ai', 'system');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.veronum_messages (
  id bigserial primary key,
  project_id uuid not null references public.veronum_projects(id) on delete cascade,
  author_id uuid references public.veronum_users(id) on delete set null,
  author_name text not null,
  author_color text not null,
  kind public.veronum_message_kind not null,
  body text not null,
  app text,
  model text,
  in_reply_to bigint references public.veronum_messages(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists veronum_messages_project_created_idx on public.veronum_messages(project_id, created_at desc);

-- ─── Live presence ──────────────────────────────────────────────────────────
create table if not exists public.veronum_presence (
  project_id uuid not null references public.veronum_projects(id) on delete cascade,
  user_id uuid not null references public.veronum_users(id) on delete cascade,
  app text,
  file text,
  line int,
  typing boolean not null default false,
  recent_snippet text,
  last_seen timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists veronum_presence_project_seen_idx on public.veronum_presence(project_id, last_seen desc);

-- ─── Realtime publication: enable broadcasting for the new tables ──────────
-- Wrapped in DO block since alter publication ... add table errors if already added
do $$
begin
  alter publication supabase_realtime add table public.veronum_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.veronum_presence;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.veronum_project_members;
exception when duplicate_object then null;
end $$;

-- ─── Row-Level Security ─────────────────────────────────────────────────────
-- For v1 the desktop bridge calls the API with the SHIPPED_DMG_TOKEN bearer
-- and the API enforces auth in the route handler (lib/auth.ts). RLS is
-- defense-in-depth. Service role bypasses RLS (used by our /api/v1/* routes
-- via SUPABASE_SERVICE_KEY).

alter table public.veronum_users enable row level security;
alter table public.veronum_projects enable row level security;
alter table public.veronum_project_members enable row level security;
alter table public.veronum_project_invites enable row level security;
alter table public.veronum_messages enable row level security;
alter table public.veronum_presence enable row level security;

create or replace function public.is_veronum_project_member(p_project_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.veronum_project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

-- Drop+create policies (safe to re-run)
drop policy if exists "veronum members can read projects" on public.veronum_projects;
create policy "veronum members can read projects"
  on public.veronum_projects for select
  using (public.is_veronum_project_member(id, auth.uid()));

drop policy if exists "veronum owners can update projects" on public.veronum_projects;
create policy "veronum owners can update projects"
  on public.veronum_projects for update
  using (owner_id = auth.uid());

drop policy if exists "veronum members can read memberships" on public.veronum_project_members;
create policy "veronum members can read memberships"
  on public.veronum_project_members for select
  using (user_id = auth.uid() or public.is_veronum_project_member(project_id, auth.uid()));

drop policy if exists "veronum members can read messages" on public.veronum_messages;
create policy "veronum members can read messages"
  on public.veronum_messages for select
  using (public.is_veronum_project_member(project_id, auth.uid()));

drop policy if exists "veronum members can insert messages" on public.veronum_messages;
create policy "veronum members can insert messages"
  on public.veronum_messages for insert
  with check (public.is_veronum_project_member(project_id, auth.uid()) and author_id = auth.uid());

drop policy if exists "veronum members can read presence" on public.veronum_presence;
create policy "veronum members can read presence"
  on public.veronum_presence for select
  using (public.is_veronum_project_member(project_id, auth.uid()));

drop policy if exists "veronum members can upsert own presence" on public.veronum_presence;
create policy "veronum members can upsert own presence"
  on public.veronum_presence for insert
  with check (user_id = auth.uid() and public.is_veronum_project_member(project_id, auth.uid()));

drop policy if exists "veronum members can update own presence" on public.veronum_presence;
create policy "veronum members can update own presence"
  on public.veronum_presence for update
  using (user_id = auth.uid());

drop policy if exists "veronum users can read own user row" on public.veronum_users;
create policy "veronum users can read own user row"
  on public.veronum_users for select
  using (id = auth.uid());

drop policy if exists "anyone can read veronum invites by token" on public.veronum_project_invites;
create policy "anyone can read veronum invites by token"
  on public.veronum_project_invites for select
  using (true);
