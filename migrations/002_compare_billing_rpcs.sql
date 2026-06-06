-- Migration 002 — Compare-chat billing RPCs
-- ====================================================================
-- This migration adds the two functions that /api/compare and the
-- /chat paywall lean on:
--
--   veronum_consume_cents(p_user_id uuid, p_cents int) RETURNS void
--     Atomically increments public.users.period_consumed_cents for the
--     given user. Called by /api/compare server-side after each stream
--     finishes. Race-free under parallel compare-mode fan-out (N models
--     streaming concurrently all bump the same row).
--
--   veronum_my_billing_state() RETURNS table(...)
--     Per-user view of subscription_status, period_consumed_cents,
--     has_active_subscription, over_quota. Called by /chat and
--     /compare client-side. SECURITY DEFINER so RLS-locked rows still
--     return the caller's own state via auth.uid().
--
-- This migration ALSO bumps the free-trial threshold inside
-- veronum_my_billing_state from 25¢ → 10¢ so /chat (which calls this
-- RPC for its own gate) shows the paywall at the same boundary as
-- /api/compare's server-side gate (FREE_TRIAL_CENTS = 10).
--
-- Apply with:
--   psql "$DATABASE_URL" -f migrations/002_compare_billing_rpcs.sql
-- or paste into the Supabase SQL editor.
--
-- Safe to re-run — every statement uses CREATE OR REPLACE.

-- --------------------------------------------------------------------
-- 1. Atomic cents counter bump.
--    Owned by postgres (so the SECURITY DEFINER label gets row-mod
--    privilege regardless of the calling role's RLS). The function
--    body is minimal on purpose — fewer chances for accident.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.veronum_consume_cents(
  p_user_id uuid,
  p_cents   int
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET period_consumed_cents = COALESCE(period_consumed_cents, 0) + p_cents
   WHERE id = p_user_id
     AND tier IS DISTINCT FROM 'admin';  -- admin tier never accrues
$$;

-- Service-role can call freely; the route's serverSupabaseAdmin()
-- client uses the service key.
REVOKE ALL ON FUNCTION public.veronum_consume_cents(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_consume_cents(uuid, int) TO service_role;

-- --------------------------------------------------------------------
-- 2. Per-user billing snapshot. Called from the browser via
--    `supabase.rpc("veronum_my_billing_state").single()`. SECURITY
--    DEFINER + auth.uid() means callers only see their own row.
--
--    Returns columns:
--      period_consumed_cents     : raw cents spent this period
--      subscription_status       : Stripe status (active, canceled, ...)
--      tier                      : free | chad | payg | admin
--      has_active_subscription   : derived bool
--      over_quota                : derived bool — true when free user
--                                  has hit the FREE_TRIAL_CENTS cap
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.veronum_my_billing_state()
RETURNS TABLE (
  period_consumed_cents   int,
  subscription_status     text,
  tier                    text,
  has_active_subscription boolean,
  over_quota              boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT
      COALESCE(u.period_consumed_cents, 0)::int AS consumed,
      COALESCE(u.subscription_status, '')::text AS status,
      COALESCE(u.tier, 'free')::text            AS tier
    FROM public.users u
    WHERE u.id = auth.uid()
  )
  SELECT
    me.consumed                                         AS period_consumed_cents,
    me.status                                           AS subscription_status,
    me.tier                                             AS tier,
    (me.status IN ('active', 'trialing'))               AS has_active_subscription,
    -- Match FREE_TRIAL_CENTS in lib/compare/billing.ts. If you bump
    -- the cap in code, bump it here too (and vice versa).
    (
      me.tier = 'free'
      AND me.consumed >= 10
      AND me.status NOT IN ('active', 'trialing')
    )                                                   AS over_quota
  FROM me;
$$;

REVOKE ALL ON FUNCTION public.veronum_my_billing_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_my_billing_state() TO authenticated;
