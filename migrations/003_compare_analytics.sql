-- Migration 003 — Compare-chat analytics
-- =====================================================================
-- Adds the durable event log for every /api/compare invocation plus
-- the SECURITY DEFINER aggregation RPC the /admin dashboard reads.
--
-- Why a separate table from `usage_events`:
--   - usage_events is page-view tracking (pathname + user_id only).
--   - compare_events is per-Send detail with model list, token counts,
--     cost, status, prompt preview, etc. — wider schema, hot queries.
--
-- Privacy: prompt_preview is capped at 200 chars (matches the choice
-- locked in by the product owner). No full prompts stored.
-- RLS: enabled, denied to authenticated by default; SECURITY DEFINER
-- RPCs are the only read path.
--
-- Apply via the Supabase SQL editor. Idempotent — DROP IF EXISTS on
-- every function, CREATE TABLE IF NOT EXISTS for the table.

-- ---------------------------------------------------------------------
-- 1. The event log itself.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compare_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts              timestamptz NOT NULL DEFAULT NOW(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text,                  -- denormalized; auth.users.email at log time
  mode            text NOT NULL,         -- 'compare' | 'agents'
  model_id        text NOT NULL,         -- single model per row (one row per parallel slot)
  prompt_chars    int  NOT NULL DEFAULT 0,
  prompt_preview  text,                  -- first 200 chars, may be NULL on errors
  input_tokens    int  NOT NULL DEFAULT 0,
  output_tokens   int  NOT NULL DEFAULT 0,
  cost_cents      int  NOT NULL DEFAULT 0,
  status          text NOT NULL,         -- 'ok' | 'error' | 'aborted'
  error_kind      text,                  -- 'upstream' | 'auth' | 'over_quota' | NULL
  session_id      text,                  -- groups N rows from the same user-Send
  turn_index      int,                   -- index within session (0 = first turn)
  picked_model    text,                  -- if user later picked this slot as main reply
  duration_ms     int                    -- wallclock for the stream
);

-- Hot-path indexes.
CREATE INDEX IF NOT EXISTS compare_events_ts_idx       ON public.compare_events (ts DESC);
CREATE INDEX IF NOT EXISTS compare_events_user_ts_idx  ON public.compare_events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS compare_events_mode_idx     ON public.compare_events (mode);
CREATE INDEX IF NOT EXISTS compare_events_model_idx    ON public.compare_events (model_id);
CREATE INDEX IF NOT EXISTS compare_events_status_idx   ON public.compare_events (status);

-- Lock the table down. Only the SECURITY DEFINER RPCs below get to
-- read it; nothing in `authenticated` or `anon` can touch it directly.
ALTER TABLE public.compare_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compare_events_no_direct_read ON public.compare_events;
-- (No policy = no access. RLS-enabled tables deny by default.)

-- ---------------------------------------------------------------------
-- 2. Logging RPC. Called by /api/compare after each upstream finishes.
--    Service-role only (the route uses serverSupabaseAdmin). Returns
--    the new row's id for tracing.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_log_compare_event(
  uuid, text, text, text, int, text, int, int, int, text, text, text, int, text, int
);

CREATE FUNCTION public.veronum_log_compare_event(
  p_user_id        uuid,
  p_user_email     text,
  p_mode           text,
  p_model_id       text,
  p_prompt_chars   int,
  p_prompt_preview text,
  p_input_tokens   int,
  p_output_tokens  int,
  p_cost_cents     int,
  p_status         text,
  p_error_kind     text,
  p_session_id     text,
  p_turn_index     int,
  p_picked_model   text,
  p_duration_ms    int
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $log$
  INSERT INTO public.compare_events (
    user_id, user_email, mode, model_id,
    prompt_chars, prompt_preview, input_tokens, output_tokens,
    cost_cents, status, error_kind, session_id, turn_index,
    picked_model, duration_ms
  ) VALUES (
    p_user_id, p_user_email, p_mode, p_model_id,
    p_prompt_chars,
    -- Defensive truncation: even though the route already truncates,
    -- enforce the 200-char cap at the DB layer so a misbehaving client
    -- can't store more than agreed.
    LEFT(COALESCE(p_prompt_preview, ''), 200),
    p_input_tokens, p_output_tokens,
    p_cost_cents, p_status, p_error_kind, p_session_id, p_turn_index,
    p_picked_model, p_duration_ms
  )
  RETURNING id;
$log$;

REVOKE ALL ON FUNCTION public.veronum_log_compare_event(
  uuid, text, text, text, int, text, int, int, int, text, text, text, int, text, int
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_log_compare_event(
  uuid, text, text, text, int, text, int, int, int, text, text, text, int, text, int
) TO service_role;

-- ---------------------------------------------------------------------
-- 3. Admin aggregation RPC. Returns a single JSON blob with every
--    chart's data so the dashboard fetches once per page load.
--    Gated on caller's tier = 'admin' — SECURITY DEFINER lets us read
--    auth.users.email + public.users.tier safely.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.veronum_admin_compare_stats(int);

CREATE FUNCTION public.veronum_admin_compare_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $stats$
DECLARE
  v_cutoff timestamptz := NOW() - (p_days || ' days')::interval;
  v_caller_tier text;
  v_result jsonb;
BEGIN
  -- Admin gate. Identical pattern to veronum_admin_stats so the same
  -- people who can read other admin metrics can read these.
  SELECT tier INTO v_caller_tier
    FROM public.users
   WHERE id = auth.uid();

  IF COALESCE(v_caller_tier, 'free') <> 'admin' THEN
    RAISE EXCEPTION 'admin tier required' USING ERRCODE = '42501';
  END IF;

  WITH
  events AS (
    SELECT * FROM public.compare_events WHERE ts >= v_cutoff
  ),
  signups AS (
    SELECT id, email, created_at
      FROM auth.users
     WHERE created_at >= v_cutoff
  ),
  -- Top 15 models by use + cost.
  top_models AS (
    SELECT
      model_id,
      COUNT(*)::int        AS calls,
      SUM(cost_cents)::int AS cost_cents,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::int AS errors
    FROM events
    GROUP BY model_id
    ORDER BY calls DESC
    LIMIT 15
  ),
  -- Mode split (compare vs agents).
  mode_split AS (
    SELECT mode, COUNT(*)::int AS calls
    FROM events
    GROUP BY mode
  ),
  -- Top 15 spenders.
  top_spenders AS (
    SELECT
      COALESCE(user_email, 'unknown') AS email,
      SUM(cost_cents)::int            AS cost_cents,
      COUNT(*)::int                   AS calls
    FROM events
    WHERE user_id IS NOT NULL
    GROUP BY user_email
    ORDER BY cost_cents DESC
    LIMIT 15
  ),
  -- Activation funnel.
  funnel AS (
    SELECT
      (SELECT COUNT(*)::int FROM signups) AS signups,
      (SELECT COUNT(DISTINCT s.id)::int
         FROM signups s
         JOIN events e ON e.user_id = s.id) AS first_send,
      (SELECT COUNT(*)::int
         FROM signups s
         JOIN events e ON e.user_id = s.id
        WHERE e.error_kind = 'over_quota') AS hit_paywall,
      (SELECT COUNT(*)::int
         FROM signups s
         JOIN public.users u ON u.id = s.id
        WHERE u.subscription_status IN ('active', 'trialing')) AS subscribed
  ),
  -- Daily active users for line chart.
  dau AS (
    SELECT
      date_trunc('day', ts)::date AS day,
      COUNT(DISTINCT user_id)::int AS users,
      COUNT(*)::int               AS calls,
      SUM(cost_cents)::int        AS cost_cents
    FROM events
    WHERE user_id IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
  ),
  -- Live feed: last 50 events with the prompt preview.
  recent AS (
    SELECT
      ts, user_email, mode, model_id, status, error_kind,
      cost_cents, prompt_chars, prompt_preview, duration_ms
    FROM events
    ORDER BY ts DESC
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'generated_at',  NOW(),
    'range_days',    p_days,
    'cutoff',        v_cutoff,
    'totals', jsonb_build_object(
      'events',      (SELECT COUNT(*)::int FROM events),
      'unique_users',(SELECT COUNT(DISTINCT user_id)::int FROM events WHERE user_id IS NOT NULL),
      'cost_cents',  (SELECT COALESCE(SUM(cost_cents), 0)::int FROM events),
      'errors',      (SELECT COUNT(*)::int FROM events WHERE status = 'error'),
      'paywall_hits',(SELECT COUNT(*)::int FROM events WHERE error_kind = 'over_quota')
    ),
    'top_models',   COALESCE((SELECT jsonb_agg(to_jsonb(top_models)) FROM top_models), '[]'::jsonb),
    'mode_split',   COALESCE((SELECT jsonb_agg(to_jsonb(mode_split)) FROM mode_split), '[]'::jsonb),
    'top_spenders', COALESCE((SELECT jsonb_agg(to_jsonb(top_spenders)) FROM top_spenders), '[]'::jsonb),
    'funnel',       (SELECT to_jsonb(funnel) FROM funnel),
    'dau',          COALESCE((SELECT jsonb_agg(to_jsonb(dau)) FROM dau), '[]'::jsonb),
    'recent',       COALESCE((SELECT jsonb_agg(to_jsonb(recent)) FROM recent), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$stats$;

REVOKE ALL ON FUNCTION public.veronum_admin_compare_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.veronum_admin_compare_stats(int) TO authenticated;
