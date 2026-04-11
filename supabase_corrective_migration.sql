-- ============================================================================
-- CORRECTIVE MIGRATION — restore original users schema + billing columns
--
-- Context: Earlier today we ran a DROP TABLE public.users CASCADE that wiped
-- out the shared production users table for the Tools AI chat app + Chrome
-- extension. This script recreates the users table with the ORIGINAL schema
-- from SETUP_DATABASE.sql AND adds the new billing columns we need for the
-- trial/Chad/PAYG payment system.
--
-- RUN ORDER:
--   1. (Only if you have a backup to restore from) Restore users table from
--      Supabase point-in-time recovery or daily backup FIRST. Then STOP — do
--      not run this script, use the ALTER TABLE additions at the bottom
--      instead.
--   2. (If you have NO backup) Run this whole script. It recreates users
--      with the merged schema. Existing user accounts are not recoverable.
--
-- This script is idempotent: safe to run multiple times.
-- ============================================================================

-- ─── Drop anything our previous (wrong) migration left behind ──────────────
drop table if exists public.usage_events cascade;
drop table if exists public.auth_tokens cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.trials cascade;
drop table if exists public.users cascade;
drop function if exists public.record_usage(uuid, integer, integer) cascade;
drop function if exists public.check_and_bump_velocity(uuid, integer) cascade;
drop function if exists public.reset_period(uuid, timestamptz, timestamptz) cascade;

-- ─── users: ORIGINAL SCHEMA + BILLING COLUMNS ─────────────────────────────
-- Columns 1-9 are the original production schema from SETUP_DATABASE.sql.
-- Columns 10-21 are billing additions for trial/Chad/PAYG.
create table public.users (
  -- Original columns (chat app + extension auth/settings)
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  hashed_password text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  settings jsonb not null default
    '{"theme":"dark","defaultModel":"gpt-4","exportFormat":"pdf","autoSummarize":true,"memoryEnabled":true,"defaultProvider":"openai"}'::jsonb,

  -- Billing columns (new — added for trial/Chad/PAYG)
  tier text not null default 'none',
    -- 'none' | 'trial' | 'chad' | 'payg' | 'expired' | 'suspended'
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  period_consumed_cents integer not null default 0,
  period_billed_cents integer not null default 0,
  hard_limit_cents integer not null default 5000,
  velocity_window_start timestamptz not null default now(),
  velocity_calls_this_hour integer not null default 0,
  onboarding_date timestamptz,
  last_call_at timestamptz
);

create index if not exists users_stripe_customer_idx on public.users(stripe_customer_id);
create index if not exists users_email_idx on public.users(email);

-- ─── trials ─────────────────────────────────────────────────────────
create table public.trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_cents integer not null default 0,
  ended_reason text
);

create index if not exists trials_user_idx on public.trials(user_id);
create index if not exists trials_active_idx on public.trials(user_id) where ended_reason is null;

-- ─── auth_tokens ────────────────────────────────────────────────────
-- For the new JWT/bearer-hash auth path. Does NOT replace tai_keys —
-- that table stays exactly as it is for existing paying users.
create table public.auth_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists auth_tokens_user_idx on public.auth_tokens(user_id);

-- ─── usage_events ───────────────────────────────────────────────────
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  raw_cost_cents integer not null default 0,
  charged_cents integer not null default 0,
  kind text not null,
  stripe_meter_event_id text,
  error_code text,
  error_message text
);

create index if not exists usage_events_user_time_idx on public.usage_events(user_id, created_at desc);
create index if not exists usage_events_kind_idx on public.usage_events(kind);

-- ─── subscriptions ──────────────────────────────────────────────────
create table public.subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  tier text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions(user_id);

-- ─── RPC functions ──────────────────────────────────────────────────
create or replace function public.record_usage(
  p_user_id uuid,
  p_raw_cents integer,
  p_charged_cents integer
) returns table (
  new_consumed_cents integer,
  new_billed_cents integer,
  hard_limit_cents integer
) language plpgsql security definer as $$
begin
  return query
  update public.users
  set
    period_consumed_cents = period_consumed_cents + p_raw_cents,
    period_billed_cents   = period_billed_cents + p_charged_cents,
    last_call_at = now()
  where id = p_user_id
  returning
    period_consumed_cents,
    period_billed_cents,
    public.users.hard_limit_cents;
end;
$$;

create or replace function public.check_and_bump_velocity(
  p_user_id uuid,
  p_limit integer
) returns boolean language plpgsql security definer as $$
declare
  v_window_start timestamptz;
  v_calls integer;
begin
  select velocity_window_start, velocity_calls_this_hour
    into v_window_start, v_calls
  from public.users
  where id = p_user_id
  for update;

  if now() - v_window_start > interval '1 hour' then
    update public.users
    set velocity_window_start = now(),
        velocity_calls_this_hour = 1
    where id = p_user_id;
    return true;
  end if;

  if v_calls >= p_limit then
    return false;
  end if;

  update public.users
  set velocity_calls_this_hour = velocity_calls_this_hour + 1
  where id = p_user_id;
  return true;
end;
$$;

create or replace function public.reset_period(
  p_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
) returns void language plpgsql security definer as $$
begin
  update public.users
  set
    period_consumed_cents = 0,
    period_billed_cents = 0,
    current_period_start = p_period_start,
    current_period_end = p_period_end
  where id = p_user_id;
end;
$$;

-- ============================================================================
-- ALTERNATIVE: If you restored users table from a Supabase backup and just
-- need to ADD the billing columns without re-creating, run these ALTER
-- statements instead of the full script above:
-- ============================================================================
--
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier text not null default 'none';
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id text unique;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status text;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS period_consumed_cents integer not null default 0;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS period_billed_cents integer not null default 0;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hard_limit_cents integer not null default 5000;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS velocity_window_start timestamptz not null default now();
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS velocity_calls_this_hour integer not null default 0;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_date timestamptz;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_call_at timestamptz;
--
-- Then run only the "trials", "auth_tokens", "usage_events", "subscriptions",
-- and RPC function sections above (they don't touch the users table itself).
