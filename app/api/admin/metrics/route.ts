/**
 * GET /api/admin/metrics
 *
 * Powers the /admin "Metrics" tab. Returns ONE JSON object with all 25
 * product + investor metrics already computed (label + value + unit +
 * one-line `sub`), so the client renders without doing math.
 *
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Auth: admin-only. We mirror the /api/compare gate — validate the JWT
 * via the service-role client's GoTrue, then verify the caller's
 * `public.users.tier === 'admin'`. Non-admins get 403 and zero data.
 *
 * Data sources (all read with the SERVICE-ROLE client, which bypasses
 * RLS — compare_events / usage_events / download_events are all
 * deny-all under RLS):
 *   - auth.users               → signup ts + email (via auth.admin.listUsers, paginated)
 *   - public.users             → tier + subscription_status (subscriber / MRR)
 *   - public.compare_events    → Sends (one row per model; logical Send = session_id+ts)
 *   - public.usage_events      → page_view rows (page path; NO referrer column exists)
 *   - public.download_events   → desktop downloads
 *
 * Schema reconciliation note (vs. the original spec):
 *   - Tier/subscription live in `public.users`, NOT `profiles`. Signup
 *     time lives in `auth.users.created_at`, not on `public.users`.
 *   - `usage_events` has `page` (pathname) + `install_id`, NOT `referrer`
 *     — the tracker deliberately stores no referrers. "Top signup
 *     sources" therefore reports top landing PAGES, flagged as a proxy.
 *   - `download_events` uses `app_version`, not `version`.
 *   - Churn / cancellations are not recorded anywhere in the current
 *     schema (no status-history table), so churn-derived metrics are 0
 *     with an explicit note, per spec.
 */

import { NextResponse } from "next/server";
import { extractBearer } from "@/lib/compare/billing";
import { serverSupabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Tunable business constants ──────────────────────────────────────
const SUB_PRICE_CENTS = 2500; // $25/mo subscription
const GROSS_MARGIN = 0.65; // 3× metered markup → ~65% gross margin
const CAC_CENTS = 0; // 100% organic so far
const MONTHLY_BURN_CENTS = Number(process.env.ADMIN_MONTHLY_BURN_CENTS || 0);
const CASH_CENTS = Number(process.env.ADMIN_CASH_CENTS || 0);
const MIN_MONTHLY_CHURN = 0.02; // floor so avg lifetime stays finite
const ACTIVE_WINDOW_DAYS = 90; // how far back we pull compare_events
const DB_PAGE = 1000; // .range() page size (PostgREST default cap)

// ── Time helpers (all UTC, all derived once from `now`) ─────────────
const MS_DAY = 86_400_000;

// ── Wire types ──────────────────────────────────────────────────────
/** One displayed metric. `value` is pre-formatted for strings, or a
 *  number the client toLocaleString()s. `unit` is an optional suffix
 *  hint; `sub` is the one-line explainer shown under every card. */
type Metric = { label: string; value: number | string; unit?: string; sub: string };

type CohortRow = { cohort: string; size: number; w1: number; w2: number; w3: number };
type SourceRow = { source: string; views: number; pct: number };

/** Minimal shapes we actually select — keeps the math readable.
 *  `mode` powers feature-adoption; the rest power the active-user /
 *  Send math. */
type EventRow = {
  user_id: string | null;
  ts: string;
  session_id: string | null;
  mode: string | null;
};
type PublicUser = { id: string; tier: string | null; subscription_status: string | null };
type AuthUserLite = { id: string; created_at: string };

export async function GET(req: Request) {
  // ── ADMIN GATE ────────────────────────────────────────────────────
  let admin: SupabaseClient;
  try {
    admin = serverSupabaseAdmin();
  } catch (e) {
    return NextResponse.json(
      { error: "config_missing", detail: (e as Error).message },
      { status: 500 },
    );
  }

  const token = extractBearer(req);
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let callerId: string;
  try {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    callerId = userData.user.id;
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Verify tier === 'admin'. Service-role read so RLS can't hide the row.
  const { data: callerRow, error: callerErr } = await admin
    .from("users")
    .select("tier")
    .eq("id", callerId)
    .maybeSingle();
  if (callerErr) {
    return NextResponse.json(
      { error: "lookup_failed", detail: callerErr.message },
      { status: 500 },
    );
  }
  if ((callerRow?.tier as string | null) !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── FETCH BOUNDED RAW DATA ───────────────────────────────────────
  const now = Date.now();
  const cutoff = new Date(now - ACTIVE_WINDOW_DAYS * MS_DAY).toISOString();

  let events: EventRow[];
  let publicUsers: PublicUser[];
  let authUsers: AuthUserLite[];
  let pageRows: Array<{ page: string | null }>;
  let downloadCount: number;
  try {
    [events, publicUsers, authUsers, pageRows, downloadCount] = await Promise.all([
      fetchAll<EventRow>(admin, "compare_events", "user_id, ts, session_id, mode", {
        gte: { column: "ts", value: cutoff },
      }),
      fetchAll<PublicUser>(admin, "users", "id, tier, subscription_status"),
      listAllAuthUsers(admin),
      fetchPageRowsSafe(admin, cutoff),
      countRows(admin, "download_events"),
    ]);
  } catch (e) {
    console.error(`[/api/admin/metrics] data fetch failed: ${(e as Error).message}`);
    return NextResponse.json(
      { error: "data_fetch_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }

  const metrics = computeMetrics({
    now,
    events,
    publicUsers,
    authUsers,
    pageRows,
    downloadCount,
  });

  return NextResponse.json(
    { generated_at: new Date(now).toISOString(), ...metrics },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// =====================================================================
// Data access helpers
// =====================================================================

/** A column→value equality filter applied to every page of a query. */
type EqFilter = { column: string; value: string };
/** A "column >= value" filter (used for the ts cutoff). */
type GteFilter = { column: string; value: string };

/** Page through a public-schema table with .range() until exhausted.
 *  Service-role bypasses RLS so deny-all tables are readable. Filters
 *  are passed as plain descriptors (not builder callbacks) so we never
 *  thread PostgREST's deeply-generic builder type through here — that
 *  blows TS's recursion limit. The builder is narrowed to a tiny local
 *  interface at the single seam. */
async function fetchAll<T>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  filters?: { eq?: EqFilter; gte?: GteFilter },
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += DB_PAGE) {
    let q = admin.from(table).select(columns).range(from, from + DB_PAGE - 1) as unknown as RangedQuery<T>;
    if (filters?.eq) q = q.eq(filters.eq.column, filters.eq.value);
    if (filters?.gte) q = q.gte(filters.gte.column, filters.gte.value);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < DB_PAGE) break;
  }
  return out;
}

/** Minimal awaitable query surface — just the methods fetchAll uses.
 *  Sidesteps importing PostgREST's recursive generic builder type. */
interface RangedQuery<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  eq(column: string, value: string): RangedQuery<T>;
  gte(column: string, value: string): RangedQuery<T>;
}

/** HEAD count — cheap, no rows transferred. Returns 0 on error so a
 *  sparse/missing table never crashes the dashboard. */
async function countRows(admin: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

/** Signup timestamps + ids come from auth.users, reachable from the
 *  service client only via the GoTrue admin API. Paginated. */
async function listAllAuthUsers(admin: SupabaseClient): Promise<AuthUserLite[]> {
  const out: AuthUserLite[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: DB_PAGE });
    if (error) throw new Error(`auth.users: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.id && u.created_at) out.push({ id: u.id, created_at: u.created_at });
    }
    if (users.length < DB_PAGE) break;
  }
  return out;
}

/** usage_events is the one table whose schema we can't verify from the
 *  repo — it was created directly in Supabase, predating the migrations,
 *  and nothing else in the codebase reads it with a time filter. Its
 *  timestamp column could be `ts` or `created_at`. Page-view count +
 *  top-sources are Tier-4 vanity, so they must NEVER be able to 500 the
 *  whole dashboard: try each plausible timestamp column, then an
 *  unfiltered read, and finally degrade to [] — this never throws, so a
 *  wrong column here can't take down MRR / retention / the North Star. */
async function fetchPageRowsSafe(
  admin: SupabaseClient,
  cutoff: string,
): Promise<Array<{ page: string | null }>> {
  for (const col of ["ts", "created_at"]) {
    try {
      return await fetchAll<{ page: string | null }>(admin, "usage_events", "page", {
        eq: { column: "event_type", value: "page_view" },
        gte: { column: col, value: cutoff },
      });
    } catch {
      /* wrong timestamp column — try the next candidate */
    }
  }
  // Last resort: no time filter (all-time page views — slightly over the
  // labelled window, but a count beats a crash on a vanity metric).
  try {
    return await fetchAll<{ page: string | null }>(admin, "usage_events", "page", {
      eq: { column: "event_type", value: "page_view" },
    });
  } catch {
    return [];
  }
}

// =====================================================================
// Metric computation — pure function of the fetched data.
// =====================================================================

type Inputs = {
  now: number;
  events: EventRow[];
  publicUsers: PublicUser[];
  authUsers: AuthUserLite[];
  pageRows: Array<{ page: string | null }>;
  downloadCount: number;
};

function computeMetrics(input: Inputs) {
  const { now, events, publicUsers, authUsers, pageRows, downloadCount } = input;

  // ── Derived primitives ──────────────────────────────────────────
  const signupAt = new Map<string, number>();
  for (const u of authUsers) signupAt.set(u.id, Date.parse(u.created_at));
  const totalUsers = authUsers.length;

  // First compare_event ts per user (across the whole 90d window).
  const firstEventAt = new Map<string, number>();
  for (const e of events) {
    if (!e.user_id) continue;
    const t = Date.parse(e.ts);
    const cur = firstEventAt.get(e.user_id);
    if (cur === undefined || t < cur) firstEventAt.set(e.user_id, t);
  }

  // Logical Sends: dedupe the per-model fan-out to one row per
  // (session_id|ts). Events with no session_id fall back to user+ts.
  const sendKeys = new Set<string>();
  type Send = { user_id: string | null; ts: number };
  const sends: Send[] = [];
  for (const e of events) {
    const key = e.session_id ? `${e.session_id}|${e.ts}` : `${e.user_id ?? "?"}|${e.ts}`;
    if (sendKeys.has(key)) continue;
    sendKeys.add(key);
    sends.push({ user_id: e.user_id, ts: Date.parse(e.ts) });
  }

  // Subscriber = tier='chad' OR subscription_status='active'.
  const isSubscriber = (u: PublicUser) =>
    u.tier === "chad" || u.subscription_status === "active";
  const subscriberCount = publicUsers.filter(isSubscriber).length;

  // ── Active-user windows (distinct user_id over Sends) ────────────
  const activeIn = (days: number): Set<string> => {
    const since = now - days * MS_DAY;
    const s = new Set<string>();
    for (const e of events) {
      if (e.user_id && Date.parse(e.ts) >= since) s.add(e.user_id);
    }
    return s;
  };
  const dau = activeIn(1).size;
  const wau = activeIn(7).size;
  const mau = activeIn(30).size;

  // WAU last week (days 7→14 ago) for WoW growth.
  const wauPrev = (() => {
    const hi = now - 7 * MS_DAY;
    const lo = now - 14 * MS_DAY;
    const s = new Set<string>();
    for (const e of events) {
      const t = Date.parse(e.ts);
      if (e.user_id && t >= lo && t < hi) s.add(e.user_id);
    }
    return s.size;
  })();

  // ── North Star: weekly active devs running ≥3 compare Sends ──────
  const sendsThisWeekByUser = new Map<string, number>();
  const weekAgo = now - 7 * MS_DAY;
  for (const s of sends) {
    if (s.user_id && s.ts >= weekAgo) {
      sendsThisWeekByUser.set(s.user_id, (sendsThisWeekByUser.get(s.user_id) ?? 0) + 1);
    }
  }
  let northStar = 0;
  for (const c of sendsThisWeekByUser.values()) if (c >= 3) northStar++;

  // ── PRODUCT #1 / INVESTOR #7 — Activation (first Send ≤24h) ──────
  let activated = 0;
  for (const [uid, sat] of signupAt) {
    const fe = firstEventAt.get(uid);
    if (fe === undefined) continue;
    if (fe - sat <= MS_DAY) activated++;
  }
  const activationRate = pct(activated, totalUsers);

  // ── PRODUCT #2 — Retention D1/D7/D30 ─────────────────────────────
  // "≥1 Send within N days of signup". We treat D1 as a Send in
  // (signup, signup+1d], D7 in (signup, signup+7d], D30 in
  // (signup, signup+30d]. Denominator = users whose signup is old
  // enough for the window to have fully elapsed (else the window is
  // still open and a 0 would understate true retention).
  const byUser = eventsByUser(events);
  const retentionWindow = (uid: string, lo: number, hi: number) =>
    (byUser.get(uid) ?? []).some((t) => t > lo && t <= hi);
  const retD = (days: number) => {
    let denom = 0;
    let keep = 0;
    const horizon = days * MS_DAY;
    for (const [uid, sat] of signupAt) {
      if (now - sat < horizon) continue;
      denom++;
      if (retentionWindow(uid, sat, sat + horizon)) keep++;
    }
    return { rate: pct(keep, denom), denom };
  };
  const d1 = retD(1);
  const d7 = retD(7);
  const d30 = retD(30);

  const cohorts = weeklyCohorts(signupAt, byUser, now);

  // ── PRODUCT #4 — Engagement depth = Sends(7d) ÷ WAU ──────────────
  const sends7d = sends.filter((s) => s.ts >= weekAgo).length;
  const engagementDepth = wau > 0 ? round1(sends7d / wau) : 0;

  // ── PRODUCT #5 / INVESTOR #8 — Stickiness = DAU/MAU ──────────────
  const stickiness = pct(dau, mau);

  // ── PRODUCT #6 — Feature adoption (compare vs agents) ────────────
  const adoption = featureAdoption(events, now);

  // ── PRODUCT #7 — Time-to-value (median minutes signup→first Send) ─
  const ttvMinutes: number[] = [];
  for (const [uid, sat] of signupAt) {
    const fe = firstEventAt.get(uid);
    if (fe !== undefined && fe >= sat) ttvMinutes.push((fe - sat) / 60_000);
  }
  const ttvMedian = median(ttvMinutes);

  // ── PRODUCT #8 / INVESTOR #15 — Free→paid conversion ─────────────
  const conversion = pct(subscriberCount, totalUsers);

  // ── PRODUCT #9 — Churn-risk: active users whose Sends fell >50% WoW ─
  const churnRisk = (() => {
    const lastWk = new Map<string, number>();
    const prevWk = new Map<string, number>();
    const twoWk = now - 14 * MS_DAY;
    for (const s of sends) {
      if (!s.user_id) continue;
      if (s.ts >= weekAgo) lastWk.set(s.user_id, (lastWk.get(s.user_id) ?? 0) + 1);
      else if (s.ts >= twoWk) prevWk.set(s.user_id, (prevWk.get(s.user_id) ?? 0) + 1);
    }
    let n = 0;
    for (const [uid, prev] of prevWk) {
      if (prev <= 0) continue;
      const cur = lastWk.get(uid) ?? 0;
      if (cur < prev * 0.5) n++; // dropped more than 50%
    }
    return n;
  })();

  // ── PRODUCT #10 — Top signup sources (proxy: landing pages) ──────
  const topSources = topPages(pageRows);

  // ── INVESTOR #1/#2 — MRR / ARR ───────────────────────────────────
  const mrrCents = subscriberCount * SUB_PRICE_CENTS;
  const arrCents = mrrCents * 12;

  // ── INVESTOR #3 — Net new MRR this month ─────────────────────────
  // New subs this month: subscribers whose signup is in the current
  // calendar month. Churned subs not trackable → 0 (see note).
  const monthStart = startOfMonth(now);
  const subIds = new Set(publicUsers.filter(isSubscriber).map((u) => u.id));
  let newSubsThisMonth = 0;
  for (const id of subIds) {
    const sat = signupAt.get(id);
    if (sat !== undefined && sat >= monthStart) newSubsThisMonth++;
  }
  const churnedSubsThisMonth = 0; // not recorded in schema
  const netNewMrrCents = (newSubsThisMonth - churnedSubsThisMonth) * SUB_PRICE_CENTS;

  // ── INVESTOR #4 — Logo churn (monthly) ───────────────────────────
  // subs lost this month ÷ subs at month start. Not trackable → 0%.
  const subsAtMonthStart = Math.max(0, subscriberCount - newSubsThisMonth);
  const logoChurn = 0; // churnedSubsThisMonth / subsAtMonthStart → 0

  // ── INVESTOR #5 — NRR (flat subs) ────────────────────────────────
  // (start_MRR − churned_MRR)/start_MRR. With churn=0 this is 100%.
  const startMrrCents = subsAtMonthStart * SUB_PRICE_CENTS;
  const nrr = startMrrCents > 0 ? Math.round(((startMrrCents - 0) / startMrrCents) * 100) : 100;

  // ── INVESTOR #6 — WAU growth WoW % ───────────────────────────────
  const wauGrowth = wauPrev > 0 ? Math.round(((wau - wauPrev) / wauPrev) * 100) : null;

  // ── INVESTOR #10/#11/#12 — LTV, LTV:CAC, payback ─────────────────
  const monthlyChurnFrac = Math.max(logoChurn / 100, MIN_MONTHLY_CHURN);
  const avgLifetimeMonths = 1 / monthlyChurnFrac; // capped via MIN_MONTHLY_CHURN
  const arpuCents = SUB_PRICE_CENTS;
  const ltvCents = Math.round(arpuCents * GROSS_MARGIN * avgLifetimeMonths);
  const ltvCac = CAC_CENTS === 0 ? "∞ (CAC $0)" : round1(ltvCents / CAC_CENTS).toString();
  const cacPayback = CAC_CENTS === 0 ? "Instant" : `${round1(CAC_CENTS / arpuCents)} mo`;

  // ── INVESTOR #14 — Burn & runway ─────────────────────────────────
  const runwayMonths =
    MONTHLY_BURN_CENTS > 0 ? round1(CASH_CENTS / MONTHLY_BURN_CENTS) : null;

  // ── ASSEMBLE OUTPUT (grouped by UI tier) ─────────────────────────
  const m = (label: string, value: number | string, sub: string, unit?: string): Metric => ({
    label,
    value,
    sub,
    ...(unit ? { unit } : {}),
  });

  return {
    notes: {
      churn:
        "No subscription cancellation history is recorded in the current schema, so churn, logo-churn, net-new (churn side) and NRR-churn inputs are 0. Add a subscription status-history table to populate them.",
      sources:
        "usage_events stores landing-page path, not HTTP referrer (referrers are deliberately not collected), so 'Top signup sources' shows top landing pages as a proxy.",
      feature_adoption:
        "Voice and linked-session usage are not yet instrumented as events; only compare vs agents mode is tracked.",
    },

    north_star: m(
      "Weekly active devs running ≥3 compares",
      northStar,
      "distinct users with ≥3 logical compare Sends in the last 7 days — our one true health number",
    ),

    tier1: {
      retention_d1: m("Retention · D1", `${d1.rate}%`, `≥1 Send within 24h of signup (n=${d1.denom} eligible)`),
      retention_d7: m("Retention · D7", `${d7.rate}%`, `≥1 Send within 7d of signup (n=${d7.denom})`),
      retention_d30: m("Retention · D30", `${d30.rate}%`, `≥1 Send within 30d of signup (n=${d30.denom})`),
      wau: m("WAU", wau, "distinct users with a Send in the last 7 days"),
      dau: m("DAU", dau, "distinct users with a Send in the last 24h"),
      mau: m("MAU", mau, "distinct users with a Send in the last 30 days"),
      activation: m("Activation rate", `${activationRate}%`, "% of all signups whose first Send landed ≤24h after signup"),
      net_new_mrr: m(
        "Net new MRR (mo)",
        usd(netNewMrrCents),
        `${newSubsThisMonth} new sub${newSubsThisMonth === 1 ? "" : "s"} this month − 0 churned (churn not tracked)`,
      ),
      cohorts,
    },

    tier2: {
      mrr: m("MRR", usd(mrrCents), `${subscriberCount} subscriber${subscriberCount === 1 ? "" : "s"} × $25/mo`),
      arr: m("ARR", usd(arrCents), "MRR × 12 — annualized run-rate"),
      wau_growth: m(
        "WAU growth (WoW)",
        wauGrowth === null ? "n/a" : `${wauGrowth > 0 ? "+" : ""}${wauGrowth}%`,
        `this week ${wau} vs last week ${wauPrev}`,
      ),
      conversion: m("Free→paid conversion", `${conversion}%`, "subscribers ÷ total users"),
      nrr: m("Net revenue retention", `${nrr}%`, "flat subs → ~100%; real expansion comes from PAYG metering (not in this number)"),
      engagement_depth: m("Engagement depth", engagementDepth, `Sends in last 7d (${sends7d}) ÷ WAU — avg Sends per active user`),
      stickiness: m("Stickiness", `${stickiness}%`, "DAU ÷ MAU — how many monthly users show up daily"),
    },

    tier3: {
      cac: m("CAC", "$0", "customer acquisition cost — 100% organic, no paid spend"),
      ltv: m("LTV", usd(ltvCents), `ARPU $25 × ${Math.round(GROSS_MARGIN * 100)}% margin × ${round1(avgLifetimeMonths)}-mo avg lifetime`),
      ltv_cac: m("LTV : CAC", ltvCac, "lifetime value relative to acquisition cost"),
      cac_payback: m("CAC payback", cacPayback, "months of margin to recover CAC"),
      gross_margin: m("Gross margin", `${Math.round(GROSS_MARGIN * 100)}%`, "3× metered markup over raw API cost (cost_cents)"),
      burn_runway:
        MONTHLY_BURN_CENTS > 0
          ? m("Burn / runway", `${usd(MONTHLY_BURN_CENTS)}/mo`, `runway ≈ ${runwayMonths} months at $${(CASH_CENTS / 100).toLocaleString()} cash`)
          : m("Burn / runway", "not set", "set ADMIN_MONTHLY_BURN_CENTS / ADMIN_CASH_CENTS env to populate"),
    },

    tier4: {
      total_signups: m("Total signups", totalUsers, "every account ever created"),
      total_users: m("Total users", totalUsers, "registered accounts (same as signups — no deletions)"),
      subscribers: m("Subscribers", subscriberCount, "tier=chad OR subscription_status=active"),
      downloads: m("Desktop downloads", downloadCount, "all-time download_events"),
      page_views: m("Page views", pageRows.length, `page_view events in last ${ACTIVE_WINDOW_DAYS}d`),
      time_to_value: m(
        "Time-to-value",
        ttvMedian === null ? "n/a" : fmtMinutes(ttvMedian),
        "median time from signup to first Send",
      ),
      feature_adoption: m(
        "Feature adoption",
        `compare ${adoption.comparePct}% · agents ${adoption.agentsPct}%`,
        "% of 30d-active users who used each mode (voice/linked: not yet instrumented)",
      ),
      churn_risk: m("Churn-risk users", churnRisk, "active users whose Sends dropped >50% vs last week"),
      top_sources: topSources,
    },
  };
}

// =====================================================================
// Sub-computations
// =====================================================================

/** Map user_id → sorted array of event timestamps (ms). Memo-free; the
 *  caller computes it once and passes it down. */
function eventsByUser(events: EventRow[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const e of events) {
    if (!e.user_id) continue;
    const arr = m.get(e.user_id);
    const t = Date.parse(e.ts);
    if (arr) arr.push(t);
    else m.set(e.user_id, [t]);
  }
  return m;
}

/** 4-row weekly signup cohort → % of the cohort active in week +1/+2/+3.
 *  Cohort = ISO-ish week bucket of signup. Only buckets old enough for
 *  +3 weeks to have elapsed are shown; newest 4 such buckets returned. */
function weeklyCohorts(
  signupAt: Map<string, number>,
  byUser: Map<string, number[]>,
  now: number,
): CohortRow[] {
  const WEEK = 7 * MS_DAY;
  // Bucket users by the Monday-anchored week of their signup.
  const buckets = new Map<number, string[]>(); // weekStartMs → userIds
  for (const [uid, sat] of signupAt) {
    const ws = weekStart(sat);
    const arr = buckets.get(ws);
    if (arr) arr.push(uid);
    else buckets.set(ws, [uid]);
  }
  const rows: CohortRow[] = [];
  const sortedWeeks = [...buckets.keys()].sort((a, b) => b - a); // newest first
  for (const ws of sortedWeeks) {
    if (now - ws < 4 * WEEK) continue; // need +3 weeks fully elapsed
    const ids = buckets.get(ws) ?? [];
    const size = ids.length;
    const activeInWeek = (k: number) => {
      const lo = ws + k * WEEK;
      const hi = lo + WEEK;
      let n = 0;
      for (const uid of ids) {
        if ((byUser.get(uid) ?? []).some((t) => t >= lo && t < hi)) n++;
      }
      return pct(n, size);
    };
    rows.push({
      cohort: shortWeek(ws),
      size,
      w1: activeInWeek(1),
      w2: activeInWeek(2),
      w3: activeInWeek(3),
    });
    if (rows.length >= 4) break;
  }
  return rows;
}

/** Feature adoption: of users active in the last 30d, what % used each
 *  mode at least once. A user can count toward both. */
function featureAdoption(
  events: EventRow[],
  now: number,
): { comparePct: number; agentsPct: number } {
  const since = now - 30 * MS_DAY;
  const active = new Set<string>();
  const usedCompare = new Set<string>();
  const usedAgents = new Set<string>();
  for (const e of events) {
    if (!e.user_id || Date.parse(e.ts) < since) continue;
    active.add(e.user_id);
    if (e.mode === "agents") usedAgents.add(e.user_id);
    else usedCompare.add(e.user_id); // default/compare
  }
  return {
    comparePct: pct(usedCompare.size, active.size),
    agentsPct: pct(usedAgents.size, active.size),
  };
}

/** Top 5 landing pages with share %. Proxy for signup sources. */
function topPages(rows: Array<{ page: string | null }>): SourceRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.page && r.page.trim() ? r.page : "(unknown)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = rows.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, views]) => ({ source, views, pct: pct(views, total) }));
}

// =====================================================================
// Pure formatters / math (every divide guarded)
// =====================================================================

function pct(numer: number, denom: number): number {
  if (!denom || denom <= 0) return 0;
  return Math.round((numer / denom) * 100);
}
function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}
function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function fmtMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) return `${round1(min)} min`;
  const h = min / 60;
  if (h < 24) return `${round1(h)} h`;
  return `${round1(h / 24)} d`;
}
function startOfMonth(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
/** Monday-anchored start of the week containing `ms` (UTC). */
function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - day * MS_DAY;
}
function shortWeek(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
