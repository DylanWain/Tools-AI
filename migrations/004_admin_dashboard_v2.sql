-- Migration 004 — Admin dashboard v2 RPCs
-- =====================================================================
-- Two SECURITY DEFINER RPCs that power the new searchable / sortable /
-- paginated /admin tabs. Both gate on caller.tier = 'admin'.
--
--   veronum_admin_list_users(...)   → users with their aggregate event
--                                     stats (cost, # sends, # paywall hits)
--   veronum_admin_list_events(...)  → per-Send events with the prompt
--                                     preview
--
-- Cost is computed from `compare_events.cost_cents` (the per-Send raw
-- API cost). This INCLUDES admin events — admin's `period_consumed_cents`
-- column is intentionally not bumped (admin bypasses the gate), but
-- their events ARE logged so the dashboard shows their real spend.
--
-- Sorting/filtering uses whitelisted column names — never templated
-- from user input — so the RPCs are safe to expose to authenticated.
--
-- Apply via Supabase SQL editor. Idempotent.

-- ---------------------------------------------------------------------
-- 1. List users with their aggregate stats.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_admin_list_users(text, text, text, text, boolean, int, int);

CREATE FUNCTION public.veronum_admin_list_users(
  p_search       text    DEFAULT '',
  p_sort         text    DEFAULT 'signed_up',  -- signed_up | last_seen | cost | sends | email
  p_dir          text    DEFAULT 'desc',       -- asc | desc
  p_filter_tier  text    DEFAULT '',           -- '' | 'free' | 'chad' | 'payg' | 'admin'
  p_filter_sub   boolean DEFAULT NULL,         -- NULL = any · true = has sub · false = no sub
  p_offset       int     DEFAULT 0,
  p_limit        int     DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_caller_tier text;
  v_search_pattern text;
  v_total int;
  v_rows jsonb;
BEGIN
  -- Admin gate.
  SELECT tier INTO v_caller_tier FROM public.users WHERE id = auth.uid();
  IF COALESCE(v_caller_tier, 'free') <> 'admin' THEN
    RAISE EXCEPTION 'admin tier required' USING ERRCODE = '42501';
  END IF;

  v_search_pattern := '%' || COALESCE(p_search, '') || '%';

  WITH user_stats AS (
    SELECT
      au.id,
      au.email,
      au.created_at                  AS signed_up,
      au.last_sign_in_at             AS last_seen,
      COALESCE(u.tier, 'free')       AS tier,
      u.subscription_status,
      u.stripe_customer_id,
      u.period_consumed_cents,
      (u.subscription_status IN ('active','trialing'))   AS has_sub,
      COALESCE(stats.cost_cents, 0)::int                 AS cost_cents,
      COALESCE(stats.sends, 0)::int                      AS sends,
      COALESCE(stats.paywall_hits, 0)::int               AS paywall_hits,
      stats.last_send_at
    FROM auth.users au
    LEFT JOIN public.users u ON u.id = au.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(ce.cost_cents)::int                                       AS cost_cents,
        COUNT(*)::int                                                 AS sends,
        SUM(CASE WHEN ce.error_kind = 'over_quota' THEN 1 ELSE 0 END)::int AS paywall_hits,
        MAX(ce.ts)                                                    AS last_send_at
      FROM public.compare_events ce
      WHERE ce.user_id = au.id
    ) stats ON true
  ),
  filtered AS (
    SELECT * FROM user_stats
    WHERE
      (p_search = '' OR email ILIKE v_search_pattern)
      AND (p_filter_tier = '' OR tier = p_filter_tier)
      AND (p_filter_sub IS NULL OR has_sub = p_filter_sub)
  ),
  sorted AS (
    SELECT * FROM filtered
    ORDER BY
      -- Whitelisted sort columns. Anything else falls back to signed_up.
      CASE WHEN p_sort = 'cost'      AND p_dir = 'desc' THEN cost_cents      END DESC NULLS LAST,
      CASE WHEN p_sort = 'cost'      AND p_dir = 'asc'  THEN cost_cents      END ASC  NULLS LAST,
      CASE WHEN p_sort = 'sends'     AND p_dir = 'desc' THEN sends           END DESC NULLS LAST,
      CASE WHEN p_sort = 'sends'     AND p_dir = 'asc'  THEN sends           END ASC  NULLS LAST,
      CASE WHEN p_sort = 'last_seen' AND p_dir = 'desc' THEN last_seen       END DESC NULLS LAST,
      CASE WHEN p_sort = 'last_seen' AND p_dir = 'asc'  THEN last_seen       END ASC  NULLS LAST,
      CASE WHEN p_sort = 'email'     AND p_dir = 'desc' THEN email           END DESC NULLS LAST,
      CASE WHEN p_sort = 'email'     AND p_dir = 'asc'  THEN email           END ASC  NULLS LAST,
      CASE WHEN p_sort = 'signed_up' AND p_dir = 'asc'  THEN signed_up       END ASC  NULLS LAST,
      -- Default: signed_up desc
      signed_up DESC NULLS LAST
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM (SELECT * FROM sorted OFFSET p_offset LIMIT p_limit) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'rows', v_rows,
    'offset', p_offset,
    'limit', p_limit,
    'generated_at', NOW()
  );
END;
$body$;

REVOKE ALL ON FUNCTION public.veronum_admin_list_users(text, text, text, text, boolean, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_admin_list_users(text, text, text, text, boolean, int, int) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. List events with full filtering.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_admin_list_events(text, text, text, text, text, text, int, int);

CREATE FUNCTION public.veronum_admin_list_events(
  p_search         text DEFAULT '',           -- substring on email OR prompt_preview
  p_sort           text DEFAULT 'ts',          -- ts | cost | duration | email | model
  p_dir            text DEFAULT 'desc',
  p_filter_model   text DEFAULT '',
  p_filter_status  text DEFAULT '',            -- '' | 'ok' | 'error'
  p_filter_mode    text DEFAULT '',            -- '' | 'compare' | 'agents'
  p_offset         int  DEFAULT 0,
  p_limit          int  DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_caller_tier text;
  v_search_pattern text;
  v_total int;
  v_rows jsonb;
BEGIN
  SELECT tier INTO v_caller_tier FROM public.users WHERE id = auth.uid();
  IF COALESCE(v_caller_tier, 'free') <> 'admin' THEN
    RAISE EXCEPTION 'admin tier required' USING ERRCODE = '42501';
  END IF;

  v_search_pattern := '%' || COALESCE(p_search, '') || '%';

  WITH filtered AS (
    SELECT
      ce.id,
      ce.ts,
      ce.user_id,
      ce.user_email,
      ce.mode,
      ce.model_id,
      ce.status,
      ce.error_kind,
      ce.cost_cents,
      ce.prompt_chars,
      ce.prompt_preview,
      ce.input_tokens,
      ce.output_tokens,
      ce.duration_ms
    FROM public.compare_events ce
    WHERE
      (p_search = ''
         OR ce.user_email ILIKE v_search_pattern
         OR ce.prompt_preview ILIKE v_search_pattern)
      AND (p_filter_model = '' OR ce.model_id = p_filter_model)
      AND (p_filter_status = '' OR ce.status = p_filter_status)
      AND (p_filter_mode = '' OR ce.mode = p_filter_mode)
  ),
  sorted AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_sort = 'cost'     AND p_dir = 'desc' THEN cost_cents  END DESC NULLS LAST,
      CASE WHEN p_sort = 'cost'     AND p_dir = 'asc'  THEN cost_cents  END ASC  NULLS LAST,
      CASE WHEN p_sort = 'duration' AND p_dir = 'desc' THEN duration_ms END DESC NULLS LAST,
      CASE WHEN p_sort = 'duration' AND p_dir = 'asc'  THEN duration_ms END ASC  NULLS LAST,
      CASE WHEN p_sort = 'email'    AND p_dir = 'desc' THEN user_email  END DESC NULLS LAST,
      CASE WHEN p_sort = 'email'    AND p_dir = 'asc'  THEN user_email  END ASC  NULLS LAST,
      CASE WHEN p_sort = 'model'    AND p_dir = 'desc' THEN model_id    END DESC NULLS LAST,
      CASE WHEN p_sort = 'model'    AND p_dir = 'asc'  THEN model_id    END ASC  NULLS LAST,
      CASE WHEN p_sort = 'ts'       AND p_dir = 'asc'  THEN ts          END ASC  NULLS LAST,
      ts DESC NULLS LAST
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM (SELECT * FROM sorted OFFSET p_offset LIMIT p_limit) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'rows', v_rows,
    'offset', p_offset,
    'limit', p_limit,
    'generated_at', NOW()
  );
END;
$body$;

REVOKE ALL ON FUNCTION public.veronum_admin_list_events(text, text, text, text, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_admin_list_events(text, text, text, text, text, text, int, int) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Overview snapshot — top-line numbers + list of distinct models
--    seen (for the events-page model filter dropdown).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_admin_overview_v2();

CREATE FUNCTION public.veronum_admin_overview_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_caller_tier text;
  v_result jsonb;
BEGIN
  SELECT tier INTO v_caller_tier FROM public.users WHERE id = auth.uid();
  IF COALESCE(v_caller_tier, 'free') <> 'admin' THEN
    RAISE EXCEPTION 'admin tier required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'today', jsonb_build_object(
      'signups',  (SELECT COUNT(*)::int FROM auth.users WHERE created_at >= CURRENT_DATE),
      'sends',    (SELECT COUNT(*)::int FROM public.compare_events WHERE ts >= CURRENT_DATE),
      'cost_cents', COALESCE((SELECT SUM(cost_cents)::int FROM public.compare_events WHERE ts >= CURRENT_DATE), 0),
      'errors',   (SELECT COUNT(*)::int FROM public.compare_events WHERE ts >= CURRENT_DATE AND status = 'error'),
      'paywall_hits', (SELECT COUNT(*)::int FROM public.compare_events WHERE ts >= CURRENT_DATE AND error_kind = 'over_quota'),
      'active_users', (SELECT COUNT(DISTINCT user_id)::int FROM public.compare_events WHERE ts >= CURRENT_DATE AND user_id IS NOT NULL)
    ),
    'mtd', jsonb_build_object(
      'signups',  (SELECT COUNT(*)::int FROM auth.users WHERE created_at >= date_trunc('month', CURRENT_DATE)),
      'sends',    (SELECT COUNT(*)::int FROM public.compare_events WHERE ts >= date_trunc('month', CURRENT_DATE)),
      'cost_cents', COALESCE((SELECT SUM(cost_cents)::int FROM public.compare_events WHERE ts >= date_trunc('month', CURRENT_DATE)), 0)
    ),
    'all_time', jsonb_build_object(
      'users',    (SELECT COUNT(*)::int FROM auth.users),
      'sends',    (SELECT COUNT(*)::int FROM public.compare_events),
      'cost_cents', COALESCE((SELECT SUM(cost_cents)::int FROM public.compare_events), 0),
      'subscribed', (SELECT COUNT(*)::int FROM public.users WHERE subscription_status IN ('active','trialing'))
    ),
    'distinct_models', COALESCE((SELECT jsonb_agg(DISTINCT model_id ORDER BY model_id) FROM public.compare_events), '[]'::jsonb),
    'last_5min', (SELECT COUNT(DISTINCT user_id)::int FROM public.compare_events WHERE ts >= NOW() - INTERVAL '5 minutes' AND user_id IS NOT NULL),
    'recent_signups', COALESCE((SELECT jsonb_agg(row_to_json(s)) FROM (
      SELECT email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10
    ) s), '[]'::jsonb),
    'recent_paywall', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM (
      SELECT user_email, ts FROM public.compare_events
      WHERE error_kind = 'over_quota'
      ORDER BY ts DESC LIMIT 10
    ) p), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$body$;

REVOKE ALL ON FUNCTION public.veronum_admin_overview_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_admin_overview_v2() TO authenticated;
