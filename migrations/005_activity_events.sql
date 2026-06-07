-- Migration 005 — Behavioral activity tracking
-- =====================================================================
-- New table for fine-grained behavioral events that aren't a /api/compare
-- Send. Kept separate from `compare_events` (which is per-API-call
-- billing data) so the volumes don't mix and the admin queries stay fast.
--
-- Tracks:
--   page_enter   — user landed on the site (or any client-route nav)
--   page_leave   — user closed tab / navigated away (paired with the
--                  matching page_enter so we get session duration)
--   mode_change  — user clicked Compare / Multi-agent / Auto-research
--                  toggle (whether or not they actually Send)
--
-- ANONYMOUS USERS COUNT — every browser gets a random install_id in
-- localStorage on first visit, and that's the join key for visitor
-- analytics. user_id is NULL until/unless they sign in; once they do
-- their install_id back-references all their pre-signup activity.
--
-- Privacy: no IPs, no referrers, no query strings. Path is stored
-- because it's the only way to know which page they were on.
--
-- Apply via Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS public.activity_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts            timestamptz NOT NULL DEFAULT NOW(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,              -- denormalized at log time
  install_id    text NOT NULL,     -- per-browser stable id (localStorage UUID)
  kind          text NOT NULL,     -- 'page_enter' | 'page_leave' | 'mode_change'
  path          text,              -- pathname at event time
  from_mode     text,              -- mode_change: what they switched FROM
  to_mode       text,              -- mode_change: what they switched TO
  duration_ms   int                -- page_leave: ms since matching page_enter
);

CREATE INDEX IF NOT EXISTS activity_events_ts_idx       ON public.activity_events (ts DESC);
CREATE INDEX IF NOT EXISTS activity_events_user_ts_idx  ON public.activity_events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS activity_events_install_idx  ON public.activity_events (install_id, ts DESC);
CREATE INDEX IF NOT EXISTS activity_events_kind_idx     ON public.activity_events (kind);

-- Lock down direct reads — only SECURITY DEFINER RPCs see this.
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 1. Insert RPC — open to anon + authenticated so the tracker can
--    log visits from logged-out browsers.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_log_activity(text, text, text, text, text, int);

CREATE FUNCTION public.veronum_log_activity(
  p_install_id  text,
  p_kind        text,
  p_path        text DEFAULT NULL,
  p_from_mode   text DEFAULT NULL,
  p_to_mode     text DEFAULT NULL,
  p_duration_ms int  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $log$
DECLARE
  v_uid   uuid;
  v_email text;
BEGIN
  -- Reject obviously-bad input fast — keeps the table honest if a
  -- bot starts hammering /rpc/veronum_log_activity.
  IF p_install_id IS NULL OR LENGTH(p_install_id) < 4 OR LENGTH(p_install_id) > 64 THEN
    RETURN;
  END IF;
  IF p_kind NOT IN ('page_enter', 'page_leave', 'mode_change') THEN
    RETURN;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  END IF;

  INSERT INTO public.activity_events (
    user_id, user_email, install_id, kind, path,
    from_mode, to_mode, duration_ms
  ) VALUES (
    v_uid, v_email, p_install_id, p_kind,
    LEFT(COALESCE(p_path, ''), 200),
    LEFT(COALESCE(p_from_mode, ''), 32),
    LEFT(COALESCE(p_to_mode, ''), 32),
    p_duration_ms
  );
END;
$log$;

REVOKE ALL ON FUNCTION public.veronum_log_activity(text, text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_log_activity(text, text, text, text, text, int) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Admin aggregation — returns the JSONB blob the dashboard reads.
--    Gated on caller.tier = 'admin'.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_admin_activity_stats(int);

CREATE FUNCTION public.veronum_admin_activity_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $stats$
DECLARE
  v_caller_tier text;
  v_cutoff timestamptz := NOW() - (p_days || ' days')::interval;
  v_result jsonb;
BEGIN
  SELECT tier INTO v_caller_tier FROM public.users WHERE id = auth.uid();
  IF COALESCE(v_caller_tier, 'free') <> 'admin' THEN
    RAISE EXCEPTION 'admin tier required' USING ERRCODE = '42501';
  END IF;

  WITH
  events AS (SELECT * FROM public.activity_events WHERE ts >= v_cutoff),
  -- Mode-change breakdown — how many times each toggle was clicked.
  mode_clicks AS (
    SELECT
      COALESCE(NULLIF(to_mode, ''), 'unknown') AS mode,
      COUNT(*)::int                            AS clicks,
      COUNT(DISTINCT install_id)::int          AS unique_users
    FROM events
    WHERE kind = 'mode_change'
    GROUP BY 1
    ORDER BY clicks DESC
  ),
  -- Per-install session stats: page_enter count + avg duration
  -- (only page_leave events have duration). Distinct installs =
  -- unique visitors regardless of sign-in state.
  sessions AS (
    SELECT
      install_id,
      MAX(user_email) AS user_email,
      COUNT(*) FILTER (WHERE kind = 'page_enter')::int AS visits,
      AVG(duration_ms) FILTER (WHERE kind = 'page_leave' AND duration_ms IS NOT NULL)::int AS avg_duration_ms,
      MAX(ts) AS last_seen
    FROM events
    GROUP BY install_id
  ),
  visitor_summary AS (
    SELECT
      COUNT(*)::int                                                AS unique_visitors,
      COUNT(*) FILTER (WHERE user_email IS NOT NULL)::int          AS signed_in_visitors,
      SUM(visits)::int                                             AS total_visits,
      AVG(visits)::numeric(10,1)                                   AS avg_visits_per_visitor,
      AVG(avg_duration_ms)::int                                    AS avg_session_ms
    FROM sessions
  ),
  -- Top "engaged" users: by visit count
  top_visitors AS (
    SELECT install_id, user_email, visits, avg_duration_ms, last_seen
    FROM sessions
    ORDER BY visits DESC, last_seen DESC
    LIMIT 25
  ),
  -- Bounce: installs that visited but never sent a /api/compare Send
  -- (no row in compare_events for their user_id)
  bounce AS (
    SELECT
      COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM public.compare_events ce
        WHERE ce.user_id = au.id
      ))::int AS bounced,
      COUNT(*)::int AS total_signed_in
    FROM auth.users au
    WHERE au.created_at >= v_cutoff
  ),
  -- Recent activity feed (last 50)
  recent AS (
    SELECT ts, user_email, install_id, kind, path, from_mode, to_mode, duration_ms
    FROM events
    ORDER BY ts DESC
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'generated_at',   NOW(),
    'range_days',     p_days,
    'visitors',       (SELECT to_jsonb(visitor_summary) FROM visitor_summary),
    'mode_clicks',    COALESCE((SELECT jsonb_agg(to_jsonb(mode_clicks)) FROM mode_clicks), '[]'::jsonb),
    'top_visitors',   COALESCE((SELECT jsonb_agg(to_jsonb(top_visitors)) FROM top_visitors), '[]'::jsonb),
    'bounce',         (SELECT to_jsonb(bounce) FROM bounce),
    'recent',         COALESCE((SELECT jsonb_agg(to_jsonb(recent)) FROM recent), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$stats$;

REVOKE ALL ON FUNCTION public.veronum_admin_activity_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_admin_activity_stats(int) TO authenticated;
