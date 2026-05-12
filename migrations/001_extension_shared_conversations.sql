-- Migration: extension_shared_conversations
-- Run once in the Veronum Supabase SQL editor.
--
-- Table backs the Chrome extension's "Share this chat live" action.
-- The extension generates a 12-char base62 id, POSTs the captured
-- conversation here, and the recipient page (/s/<id>) reads it back
-- and renders the conversation cleanly.
--
-- Privacy posture: shares are public-by-id (anyone with the URL can
-- view). The id is 53-bit entropy from crypto.getRandomValues — not
-- enumerable by brute-force in any reasonable time horizon. Users who
-- want privacy should use the extension's "Save to version history"
-- action instead, which doesn't expose a public URL.

create table if not exists public.extension_shared_conversations (
  id           text primary key,
  source       text not null,                       -- 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity'
  title        text,
  turns        jsonb not null,                      -- [{role: 'user'|'assistant', text}]
  source_url   text,                                -- the AI site URL the share came from
  captured_at  bigint,                              -- epoch ms (extension-side)
  stored_at    bigint default (extract(epoch from now()) * 1000)::bigint,
  view_count   integer default 0,
  is_private   boolean default false                -- "Save" path sets this true
);

create index if not exists idx_esc_stored_at
  on public.extension_shared_conversations (stored_at desc);

-- Row Level Security: public can SELECT public shares, public can
-- INSERT new shares (the website needs to write from the anon key).
-- UPDATE / DELETE are explicitly disallowed at the policy level.
alter table public.extension_shared_conversations enable row level security;

drop policy if exists "public can read public shares"
  on public.extension_shared_conversations;
create policy "public can read public shares"
  on public.extension_shared_conversations
  for select
  using (is_private = false);

drop policy if exists "public can insert new shares"
  on public.extension_shared_conversations;
create policy "public can insert new shares"
  on public.extension_shared_conversations
  for insert
  with check (true);

-- View-count bump uses a security-definer function so the website
-- can increment without exposing a generic UPDATE policy.
create or replace function public.bump_share_view_count(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.extension_shared_conversations
     set view_count = view_count + 1
   where id = p_id;
end;
$$;

grant execute on function public.bump_share_view_count(text) to anon, authenticated;
