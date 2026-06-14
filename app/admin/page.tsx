/**
 * /admin — founder dashboard v2.
 *
 * Three tabs:
 *   Overview — today + MTD + all-time numbers, recent signups, recent
 *              paywall hits, live "active in last 5 min" count
 *   Users    — searchable + sortable + filterable table of every user
 *              with their aggregate cost / send count / paywall hits
 *   Events   — searchable + sortable + filterable feed of every Send
 *              with the 200-char prompt preview
 *
 * Cost numbers come from `compare_events.cost_cents` — the actual raw
 * API cost per Send, INCLUDING admin events (the admin's
 * `period_consumed_cents` column is intentionally not bumped, but
 * their events are logged, so this view shows real spend).
 *
 * Sign-in is magic-link; the page renders sign-in until authed and
 * the underlying RPCs gate on `tier = 'admin'` so a non-admin who
 * gets in here sees "unauthorized" not data.
 *
 * URLs:
 *   /admin           → Overview tab
 *   /admin?tab=users → Users
 *   /admin?tab=events→ Events
 * Tab state lives in the URL so refresh + share + back-button work.
 */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type Tab = "overview" | "metrics" | "users" | "events" | "activity";

export default function AdminPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab());

  // Auth listener — same pattern as the rest of the app.
  useEffect(() => {
    const apply = (s: { user?: { email?: string | null } } | null) => {
      setSignedIn(!!s?.user?.email);
      setEmail(s?.user?.email ?? null);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Mirror tab → URL so refresh keeps you on the same tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }, [tab]);

  if (signedIn === null) {
    return <Shell><p className="text-ivory/40 text-[13px]">Checking session…</p></Shell>;
  }
  if (!signedIn) {
    return <SignInForm supabase={supabase} />;
  }

  return (
    <Shell pill={email ? <UserPill email={email} onSignOut={() => supabase.auth.signOut()} /> : null}>
      <TabNav tab={tab} onChange={setTab} />
      <div className="mt-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "metrics"  && <MetricsTab />}
        {tab === "users"    && <UsersTab />}
        {tab === "events"   && <EventsTab />}
        {tab === "activity" && <ActivityTab />}
      </div>
      <p className="mt-10 text-center text-[11px] text-ivory/40 leading-relaxed">
        Prompts are stored as a 200-character preview only. Full conversation content is never surfaced here.
      </p>
    </Shell>
  );
}

function initialTab(): Tab {
  if (typeof window === "undefined") return "overview";
  const t = new URLSearchParams(window.location.search).get("tab");
  if (t === "metrics" || t === "users" || t === "events" || t === "activity") return t;
  return "overview";
}

// ─────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────
type Overview = {
  generated_at: string;
  today:    { signups: number; sends: number; cost_cents: number; errors: number; paywall_hits: number; active_users: number };
  mtd:      { signups: number; sends: number; cost_cents: number };
  all_time: { users: number; sends: number; cost_cents: number; subscribed: number };
  distinct_models: string[];
  last_5min: number;
  recent_signups: Array<{ email: string; created_at: string }>;
  recent_paywall: Array<{ user_email: string | null; ts: string }>;
};

function OverviewTab() {
  const supabase = getBrowserSupabase();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.rpc("veronum_admin_overview_v2");
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      setData(data as Overview);
    }
    load();
    // Refresh every 30s for live activity feel.
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [supabase]);

  if (err) return <p className="text-red-300/90 text-[13px]">Overview failed: {err}</p>;
  if (!data) return <p className="text-ivory/40 text-[13px]">Loading…</p>;

  return (
    <div className="space-y-7">
      <Section title="Live (last 5 min)">
        <Card label="Active users now" num={data.last_5min} sub="distinct users with a Send in last 5 min" />
      </Section>

      <Section title="Today">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card label="Signups"      num={data.today.signups} sub="new accounts" />
          <Card label="Sends"        num={data.today.sends}   sub="API calls" />
          <Card label="Cost"         num={`$${(data.today.cost_cents / 100).toFixed(2)}`} sub="raw API spend" />
          <Card label="Active users" num={data.today.active_users} sub="distinct senders" />
          <Card label="Errors"       num={data.today.errors}  sub={`${data.today.sends > 0 ? Math.round((data.today.errors / data.today.sends) * 100) : 0}%`} />
          <Card label="Paywall hits" num={data.today.paywall_hits} sub="conversion opportunities" />
        </div>
      </Section>

      <Section title="Month-to-date">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card label="Signups MTD"   num={data.mtd.signups} sub="new accounts this month" />
          <Card label="Sends MTD"     num={data.mtd.sends}   sub="API calls" />
          <Card label="Cost MTD"      num={`$${(data.mtd.cost_cents / 100).toFixed(2)}`} sub="raw API spend" />
        </div>
      </Section>

      <Section title="All time">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Users"        num={data.all_time.users} sub="total registered" />
          <Card label="Subscribers"  num={data.all_time.subscribed} sub={`${data.all_time.users > 0 ? Math.round((data.all_time.subscribed / data.all_time.users) * 100) : 0}% conversion`} />
          <Card label="Sends"        num={data.all_time.sends} sub="API calls ever" />
          <Card label="Cost"         num={`$${(data.all_time.cost_cents / 100).toFixed(2)}`} sub="total API spend ever" />
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Recent signups">
          <ul className="text-[13px] divide-y divide-ivory/[.05]">
            {data.recent_signups.map((s, i) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span className="text-ivory/85 truncate">{s.email}</span>
                <span className="text-ivory/45 font-mono text-[11px] whitespace-nowrap">{relTime(s.created_at)}</span>
              </li>
            ))}
            {data.recent_signups.length === 0 && <li className="py-3 text-ivory/40 text-center">No signups yet.</li>}
          </ul>
        </Section>
        <Section title="Recent paywall hits">
          <ul className="text-[13px] divide-y divide-ivory/[.05]">
            {data.recent_paywall.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span className="text-ivory/85 truncate">{p.user_email || "—"}</span>
                <span className="text-ivory/45 font-mono text-[11px] whitespace-nowrap">{relTime(p.ts)}</span>
              </li>
            ))}
            {data.recent_paywall.length === 0 && <li className="py-3 text-ivory/40 text-center">Nobody has hit the paywall yet.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab: Metrics — product + investor KPIs from /api/admin/metrics
// ─────────────────────────────────────────────────────────────────────
type Metric = { label: string; value: number | string; unit?: string; sub: string };
type CohortRow = { cohort: string; size: number; w1: number; w2: number; w3: number };
type SourceRow = { source: string; views: number; pct: number };

type MetricsPayload = {
  generated_at: string;
  notes: { churn: string; sources: string; feature_adoption: string };
  north_star: Metric;
  tier1: {
    retention_d1: Metric; retention_d7: Metric; retention_d30: Metric;
    wau: Metric; dau: Metric; mau: Metric;
    activation: Metric; net_new_mrr: Metric;
    cohorts: CohortRow[];
  };
  tier2: {
    mrr: Metric; arr: Metric; wau_growth: Metric; conversion: Metric;
    nrr: Metric; engagement_depth: Metric; stickiness: Metric;
  };
  tier3: {
    cac: Metric; ltv: Metric; ltv_cac: Metric; cac_payback: Metric;
    gross_margin: Metric; burn_runway: Metric;
  };
  tier4: {
    total_signups: Metric; total_users: Metric; subscribers: Metric;
    downloads: Metric; page_views: Metric; time_to_value: Metric;
    feature_adoption: Metric; churn_risk: Metric; top_sources: SourceRow[];
  };
};

function MetricsTab() {
  const supabase = getBrowserSupabase();
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr(null);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { if (!cancelled) setErr("Not signed in."); return; }
      try {
        const res = await fetch("/api/admin/metrics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 403) { setErr("Forbidden — this dashboard is admin-only."); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErr(`Metrics failed (${res.status})${body?.detail ? `: ${body.detail}` : ""}.`);
          return;
        }
        setData((await res.json()) as MetricsPayload);
      } catch (e) {
        if (!cancelled) setErr(`Metrics request failed: ${(e as Error).message}`);
      }
    }
    load();
    // Refresh every 60s — these are aggregates, no need to hammer.
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [supabase]);

  if (err) return <p className="text-red-300/90 text-[13px]">{err}</p>;
  if (!data) return <p className="text-ivory/40 text-[13px]">Computing metrics…</p>;

  const { north_star: ns, tier1, tier2, tier3, tier4 } = data;

  return (
    <div className="space-y-8">
      {/* North Star */}
      <Section title="North Star">
        <div className="rounded-lg border border-[#d97757]/40 bg-[#d97757]/[.06] p-5">
          <div className="text-[11px] text-[#d97757] uppercase tracking-wider font-mono">{ns.label}</div>
          <div className="text-[40px] font-medium tracking-tight text-ivory mt-1 leading-none">
            {typeof ns.value === "number" ? ns.value.toLocaleString() : ns.value}
          </div>
          <div className="text-[12px] text-ivory/55 mt-2">{ns.sub}</div>
        </div>
      </Section>

      {/* Tier 1 — Survival */}
      <Section title="Tier 1 · Survival">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard m={tier1.retention_d1} />
          <MetricCard m={tier1.retention_d7} />
          <MetricCard m={tier1.retention_d30} />
          <MetricCard m={tier1.activation} />
          <MetricCard m={tier1.wau} />
          <MetricCard m={tier1.dau} />
          <MetricCard m={tier1.mau} />
          <MetricCard m={tier1.net_new_mrr} />
        </div>
        <div className="mt-4">
          <CohortTable rows={tier1.cohorts} />
        </div>
      </Section>

      {/* Tier 2 — Growth */}
      <Section title="Tier 2 · Growth">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard m={tier2.mrr} />
          <MetricCard m={tier2.arr} />
          <MetricCard m={tier2.wau_growth} />
          <MetricCard m={tier2.conversion} />
          <MetricCard m={tier2.nrr} />
          <MetricCard m={tier2.engagement_depth} />
          <MetricCard m={tier2.stickiness} />
        </div>
      </Section>

      {/* Tier 3 — Unit economics */}
      <Section title="Tier 3 · Unit economics (for the raise)">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard m={tier3.cac} />
          <MetricCard m={tier3.ltv} />
          <MetricCard m={tier3.ltv_cac} />
          <MetricCard m={tier3.cac_payback} />
          <MetricCard m={tier3.gross_margin} />
          <MetricCard m={tier3.burn_runway} />
        </div>
      </Section>

      {/* Tier 4 — Inputs (vanity) */}
      <Section title="Tier 4 · Inputs (vanity — don't optimize)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard m={tier4.total_signups} />
          <MetricCard m={tier4.total_users} />
          <MetricCard m={tier4.subscribers} />
          <MetricCard m={tier4.downloads} />
          <MetricCard m={tier4.page_views} />
          <MetricCard m={tier4.time_to_value} />
          <MetricCard m={tier4.feature_adoption} />
          <MetricCard m={tier4.churn_risk} />
        </div>
        <div className="mt-4">
          <SourcesTable rows={tier4.top_sources} />
        </div>
      </Section>

      <p className="text-[11px] text-ivory/40 leading-relaxed border-t border-ivory/[.06] pt-4">
        Notes · {data.notes.churn} {data.notes.sources} {data.notes.feature_adoption}
        <br />Generated {relTime(data.generated_at)}.
      </p>
    </div>
  );
}

/** Card variant that renders one Metric (label + big value + sub), with
 *  an optional unit suffix. Mirrors the local Card but accepts the
 *  richer Metric shape the /api/admin/metrics route returns. */
function MetricCard({ m }: { m: Metric }) {
  return (
    <div className="rounded-lg border border-ivory/[.08] bg-ivory/[.02] p-4">
      <div className="text-[11px] text-ivory/45 uppercase tracking-wider font-mono">{m.label}</div>
      <div className="text-[22px] font-medium tracking-tight text-ivory mt-1">
        {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
        {m.unit ? <span className="text-[13px] text-ivory/45 ml-1">{m.unit}</span> : null}
      </div>
      <div className="text-[11px] text-ivory/50 mt-1">{m.sub}</div>
    </div>
  );
}

function CohortTable({ rows }: { rows: CohortRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
      <table className="w-full text-[13px]">
        <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[12px]">
          <tr>
            <Th>Signup-week cohort</Th>
            <Th right>Size</Th>
            <Th right>Wk +1 active</Th>
            <Th right>Wk +2 active</Th>
            <Th right>Wk +3 active</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort} className="border-t border-ivory/[.04]">
              <td className="px-3 py-2.5 text-ivory/90 font-mono text-[12.5px]">{r.cohort}</td>
              <td className="px-3 py-2.5 text-right font-mono text-ivory/85">{r.size.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-mono text-ivory/95">{r.w1}%</td>
              <td className="px-3 py-2.5 text-right font-mono text-ivory/95">{r.w2}%</td>
              <td className="px-3 py-2.5 text-right font-mono text-ivory/95">{r.w3}%</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-6 text-center text-ivory/40">Not enough signup history yet for a 3-week cohort.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SourcesTable({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
      <table className="w-full text-[13px]">
        <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[12px]">
          <tr>
            <Th>Top signup source (landing page proxy)</Th>
            <Th right>Views</Th>
            <Th right>% of views</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source} className="border-t border-ivory/[.04]">
              <td className="px-3 py-2.5 text-ivory/90 font-mono text-[12.5px] truncate max-w-[360px]">{r.source}</td>
              <td className="px-3 py-2.5 text-right font-mono text-ivory/85">{r.views.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right font-mono text-ivory/95">{r.pct}%</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-6 text-center text-ivory/40">No page-view events recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab: Users
// ─────────────────────────────────────────────────────────────────────
type UserRow = {
  id: string;
  email: string;
  signed_up: string;
  last_seen: string | null;
  tier: string;
  subscription_status: string | null;
  cost_cents: number;
  sends: number;
  paywall_hits: number;
  last_send_at: string | null;
  has_sub: boolean;
};
type UsersSort = "signed_up" | "last_seen" | "cost" | "sends" | "email";

function UsersTab() {
  const supabase = getBrowserSupabase();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<UsersSort>("signed_up");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [tierFilter, setTierFilter] = useState("");
  const [subFilter, setSubFilter] = useState<"all" | "yes" | "no">("all");
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase.rpc("veronum_admin_list_users", {
        p_search: search,
        p_sort: sort,
        p_dir: dir,
        p_filter_tier: tierFilter,
        p_filter_sub: subFilter === "all" ? null : subFilter === "yes",
        p_offset: offset,
        p_limit: limit,
      });
      if (cancelled) return;
      setLoading(false);
      if (error) { setErr(error.message); return; }
      const blob = data as { total: number; rows: UserRow[] };
      setRows(blob.rows ?? []);
      setTotal(blob.total ?? 0);
    }
    load();
    return () => { cancelled = true; };
  }, [supabase, search, sort, dir, tierFilter, subFilter, offset]);

  // Reset to first page whenever search/filter changes.
  useEffect(() => { setOffset(0); }, [search, tierFilter, subFilter]);

  function toggleSort(col: UsersSort) {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(col); setDir("desc"); }
  }

  return (
    <div>
      {/* Search + filters bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="search"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-ivory/[.04] border border-ivory/10 rounded-md px-3 py-2 text-[13px] text-ivory/95 placeholder:text-ivory/30 outline-none focus:border-ivory/30 transition"
        />
        <SelectChip label="Tier" value={tierFilter} onChange={setTierFilter}
          options={[["", "All tiers"], ["free", "Free"], ["chad", "Subscriber"], ["payg", "PAYG"], ["admin", "Admin"]]} />
        <SelectChip label="Sub" value={subFilter} onChange={(v) => setSubFilter(v as typeof subFilter)}
          options={[["all", "All"], ["yes", "Subscribed"], ["no", "Not subscribed"]]} />
        <span className="text-[12px] text-ivory/45 font-mono ml-auto">
          {loading ? "Loading…" : `${total.toLocaleString()} user${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {err && <p className="text-red-300/90 text-[13px] mb-3">{err}</p>}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
        <table className="w-full text-[13px]">
          <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[12px]">
            <tr>
              <SortableTh col="email"     sort={sort} dir={dir} onClick={toggleSort}>Email</SortableTh>
              <SortableTh col="signed_up" sort={sort} dir={dir} onClick={toggleSort}>Signed up</SortableTh>
              <SortableTh col="last_seen" sort={sort} dir={dir} onClick={toggleSort}>Last seen</SortableTh>
              <Th>Tier / Sub</Th>
              <SortableTh col="sends"     sort={sort} dir={dir} onClick={toggleSort} right>Sends</SortableTh>
              <SortableTh col="cost"      sort={sort} dir={dir} onClick={toggleSort} right>Cost</SortableTh>
              <Th right>Paywall</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-ivory/[.04] hover:bg-ivory/[.02]">
                <td className="px-3 py-2.5 text-ivory/90 truncate max-w-[280px]">{u.email}</td>
                <td className="px-3 py-2.5 text-ivory/55 font-mono text-[11.5px] whitespace-nowrap">{shortDate(u.signed_up)}</td>
                <td className="px-3 py-2.5 text-ivory/55 font-mono text-[11.5px] whitespace-nowrap">{u.last_seen ? shortDate(u.last_seen) : "—"}</td>
                <td className="px-3 py-2.5"><TierBadge tier={u.tier} hasSub={u.has_sub} /></td>
                <td className="px-3 py-2.5 text-right font-mono text-ivory/85">{u.sends.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right font-mono text-ivory/95">${(u.cost_cents / 100).toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-ivory/60">{u.paywall_hits || ""}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-ivory/40">No users match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination offset={offset} limit={limit} total={total} onChange={setOffset} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab: Events
// ─────────────────────────────────────────────────────────────────────
type EventRow = {
  id: string;
  ts: string;
  user_id: string | null;
  user_email: string | null;
  mode: string;
  model_id: string;
  status: string;
  error_kind: string | null;
  cost_cents: number;
  prompt_chars: number;
  prompt_preview: string | null;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number | null;
};
type EventsSort = "ts" | "cost" | "duration" | "email" | "model";

function EventsTab() {
  const supabase = getBrowserSupabase();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EventsSort>("ts");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [modelFilter, setModelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pull distinct model list once for the filter dropdown.
  useEffect(() => {
    supabase.rpc("veronum_admin_overview_v2").then(({ data }) => {
      const d = data as { distinct_models?: string[] } | null;
      if (d?.distinct_models) setModels(d.distinct_models);
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase.rpc("veronum_admin_list_events", {
        p_search: search,
        p_sort: sort,
        p_dir: dir,
        p_filter_model: modelFilter,
        p_filter_status: statusFilter,
        p_filter_mode: modeFilter,
        p_offset: offset,
        p_limit: limit,
      });
      if (cancelled) return;
      setLoading(false);
      if (error) { setErr(error.message); return; }
      const blob = data as { total: number; rows: EventRow[] };
      setRows(blob.rows ?? []);
      setTotal(blob.total ?? 0);
    }
    load();
    return () => { cancelled = true; };
  }, [supabase, search, sort, dir, modelFilter, statusFilter, modeFilter, offset]);

  useEffect(() => { setOffset(0); }, [search, modelFilter, statusFilter, modeFilter]);

  function toggleSort(col: EventsSort) {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(col); setDir("desc"); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="search"
          placeholder="Search email or prompt content…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] bg-ivory/[.04] border border-ivory/10 rounded-md px-3 py-2 text-[13px] text-ivory/95 placeholder:text-ivory/30 outline-none focus:border-ivory/30 transition"
        />
        <SelectChip label="Model" value={modelFilter} onChange={setModelFilter}
          options={[["", "All models"], ...models.map((m): [string, string] => [m, m])]} />
        <SelectChip label="Status" value={statusFilter} onChange={setStatusFilter}
          options={[["", "All"], ["ok", "OK only"], ["error", "Errors only"]]} />
        <SelectChip label="Mode" value={modeFilter} onChange={setModeFilter}
          options={[["", "All modes"], ["compare", "Compare"], ["agents", "Multi-agent"]]} />
        <span className="text-[12px] text-ivory/45 font-mono ml-auto">
          {loading ? "Loading…" : `${total.toLocaleString()} event${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {err && <p className="text-red-300/90 text-[13px] mb-3">{err}</p>}

      <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[11.5px]">
            <tr>
              <SortableTh col="ts"       sort={sort} dir={dir} onClick={toggleSort}>Time</SortableTh>
              <SortableTh col="email"    sort={sort} dir={dir} onClick={toggleSort}>User</SortableTh>
              <Th>Mode</Th>
              <SortableTh col="model"    sort={sort} dir={dir} onClick={toggleSort}>Model</SortableTh>
              <Th>Status</Th>
              <Th>Prompt (first 200 chars)</Th>
              <SortableTh col="cost"     sort={sort} dir={dir} onClick={toggleSort} right>Cost</SortableTh>
              <SortableTh col="duration" sort={sort} dir={dir} onClick={toggleSort} right>ms</SortableTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-ivory/[.04] hover:bg-ivory/[.02]">
                <td className="px-3 py-2 font-mono text-[11px] text-ivory/60 whitespace-nowrap">{shortDate(e.ts)}</td>
                <td className="px-3 py-2 text-ivory/85 truncate max-w-[200px]">{e.user_email || "—"}</td>
                <td className="px-3 py-2 text-ivory/55 text-[10.5px] uppercase tracking-wider">{e.mode}</td>
                <td className="px-3 py-2 font-mono text-[10.5px] text-ivory/80">{e.model_id}</td>
                <td className="px-3 py-2"><StatusPill status={e.status} kind={e.error_kind} /></td>
                <td className="px-3 py-2 text-ivory/75 max-w-[400px] truncate" title={e.prompt_preview ?? ""}>{e.prompt_preview || <span className="text-ivory/30">(empty)</span>}</td>
                <td className="px-3 py-2 text-right font-mono text-ivory/95">{e.cost_cents > 0 ? `${e.cost_cents}¢` : "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-ivory/55">{e.duration_ms ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-ivory/40">No events match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination offset={offset} limit={limit} total={total} onChange={setOffset} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab: Activity (behavioral — visits, leaves, mode toggle clicks)
// ─────────────────────────────────────────────────────────────────────
type ActivityStats = {
  generated_at: string;
  range_days: number;
  visitors?: {
    unique_visitors: number;
    signed_in_visitors: number;
    total_visits: number;
    avg_visits_per_visitor: number | null;
    avg_session_ms: number | null;
  };
  mode_clicks?: Array<{ mode: string; clicks: number; unique_users: number }>;
  top_visitors?: Array<{
    install_id: string;
    user_email: string | null;
    visits: number;
    avg_duration_ms: number | null;
    last_seen: string;
  }>;
  bounce?: { bounced: number; total_signed_in: number };
  recent?: Array<{
    ts: string;
    user_email: string | null;
    install_id: string;
    kind: string;
    path: string | null;
    from_mode: string | null;
    to_mode: string | null;
    duration_ms: number | null;
  }>;
};

function ActivityTab() {
  const supabase = getBrowserSupabase();
  const [data, setData] = useState<ActivityStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.rpc("veronum_admin_activity_stats", { p_days: days });
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      setData(data as ActivityStats);
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [supabase, days]);

  if (err) return <p className="text-red-300/90 text-[13px]">Activity stats failed: {err}. (Migration 005 may not be applied yet — paste migrations/005_activity_events.sql into the Supabase SQL editor.)</p>;
  if (!data || !data.visitors) return <p className="text-ivory/40 text-[13px]">Loading…</p>;

  const v = data.visitors;
  const bounceRate = data.bounce && data.bounce.total_signed_in > 0
    ? Math.round((data.bounce.bounced / data.bounce.total_signed_in) * 100)
    : 0;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-ivory/55">Behavioral activity for the last {days} day{days === 1 ? "" : "s"} — page enters, exits, and mode-toggle clicks (anonymous visitors counted via install_id).</p>
        <SelectChip label="Range" value={String(days)} onChange={(s) => setDays(parseInt(s, 10))}
          options={[["1", "Today"], ["7", "7d"], ["30", "30d"], ["90", "90d"]]} />
      </div>

      <Section title="Visitors">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card label="Unique visitors" num={v.unique_visitors} sub="distinct browsers" />
          <Card label="Signed-in" num={v.signed_in_visitors} sub={`${v.unique_visitors > 0 ? Math.round((v.signed_in_visitors / v.unique_visitors) * 100) : 0}% of all`} />
          <Card label="Total visits" num={v.total_visits} sub="page enters" />
          <Card label="Visits / visitor" num={v.avg_visits_per_visitor ?? 0} sub="avg per browser" />
          <Card label="Avg session" num={formatDuration(v.avg_session_ms)} sub="time on site" />
        </div>
      </Section>

      <Section title="Bounce rate (signed-in users who never sent a prompt)">
        <Card label="Bounced" num={`${bounceRate}%`} sub={`${data.bounce?.bounced ?? 0} of ${data.bounce?.total_signed_in ?? 0} signed up in range`} />
      </Section>

      <Section title="Toggle clicks — which mode are users picking?">
        <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
          <table className="w-full text-[13px]">
            <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[12px]">
              <tr>
                <Th>Mode</Th>
                <Th right>Clicks</Th>
                <Th right>Unique users</Th>
                <Th right>% of clicks</Th>
              </tr>
            </thead>
            <tbody>
              {(data.mode_clicks ?? []).map((m) => {
                const total = (data.mode_clicks ?? []).reduce((s, x) => s + x.clicks, 0);
                const pct = total > 0 ? Math.round((m.clicks / total) * 100) : 0;
                return (
                  <tr key={m.mode} className="border-t border-ivory/[.04]">
                    <td className="px-3 py-2.5 text-ivory/95 font-mono text-[12.5px]">{m.mode}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-ivory/85">{m.clicks.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-ivory/85">{m.unique_users.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-ivory/95">{pct}%</td>
                  </tr>
                );
              })}
              {(data.mode_clicks ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-ivory/40">Nobody has clicked a toggle yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Top visitors (most page enters)">
        <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
          <table className="w-full text-[13px]">
            <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[12px]">
              <tr>
                <Th>Visitor</Th>
                <Th right>Visits</Th>
                <Th right>Avg session</Th>
                <Th right>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {(data.top_visitors ?? []).map((v, i) => (
                <tr key={i} className="border-t border-ivory/[.04]">
                  <td className="px-3 py-2.5 text-ivory/90 truncate max-w-[280px]">
                    {v.user_email || <span className="text-ivory/45 font-mono text-[11px]">anon · {v.install_id.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ivory/85">{v.visits.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-ivory/55">{formatDuration(v.avg_duration_ms)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-ivory/55 text-[11.5px]">{relTime(v.last_seen)}</td>
                </tr>
              ))}
              {(data.top_visitors ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-ivory/40">No visitor activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Live activity feed (last 50)">
        <div className="overflow-x-auto rounded-lg border border-ivory/[.06]">
          <table className="w-full text-[12.5px]">
            <thead className="bg-ivory/[.02] text-ivory/55 text-left text-[11.5px]">
              <tr>
                <Th>Time</Th>
                <Th>Visitor</Th>
                <Th>Event</Th>
                <Th>Detail</Th>
                <Th right>Duration</Th>
              </tr>
            </thead>
            <tbody>
              {(data.recent ?? []).map((r, i) => (
                <tr key={i} className="border-t border-ivory/[.04]">
                  <td className="px-3 py-2 font-mono text-[11px] text-ivory/60 whitespace-nowrap">{shortDate(r.ts)}</td>
                  <td className="px-3 py-2 text-ivory/85 truncate max-w-[200px]">
                    {r.user_email || <span className="text-ivory/40 font-mono text-[10.5px]">anon · {r.install_id.slice(0, 6)}</span>}
                  </td>
                  <td className="px-3 py-2"><ActivityPill kind={r.kind} /></td>
                  <td className="px-3 py-2 text-ivory/65 text-[12px]">
                    {r.kind === "mode_change"
                      ? <span className="font-mono"><span className="text-ivory/45">{r.from_mode || "?"}</span> → <span className="text-ivory/95">{r.to_mode}</span></span>
                      : <span className="font-mono text-ivory/65">{r.path || "—"}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ivory/55 text-[11px]">{formatDuration(r.duration_ms)}</td>
                </tr>
              ))}
              {(data.recent ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-ivory/40">No activity events yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function ActivityPill({ kind }: { kind: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    page_enter:  { bg: "rgba(126,180,114,0.16)", fg: "#a8d49b" },
    page_leave:  { bg: "rgba(214,177,91,0.16)",  fg: "#d6b15b" },
    mode_change: { bg: "rgba(217,119,87,0.16)",  fg: "#d97757" },
  };
  const p = palette[kind] ?? { bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.55)" };
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-wider whitespace-nowrap"
      style={{ background: p.bg, color: p.fg }}>
      {kind.replace("_", " ")}
    </span>
  );
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

// ─────────────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────────────
function TabNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<[Tab, string]> = [["overview", "Overview"], ["metrics", "Metrics"], ["users", "Users"], ["events", "Events"], ["activity", "Activity"]];
  return (
    <div className="inline-flex bg-ivory/[.04] rounded-full p-1 text-[13px]">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={[
            "px-4 py-1.5 rounded-full transition-colors",
            tab === id ? "bg-ivory text-slate-dark font-medium" : "text-ivory/65 hover:text-ivory",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SortableTh({
  col, sort, dir, onClick, right, children,
}: {
  col: string;
  sort: string;
  dir: "asc" | "desc";
  onClick: (c: never) => void;
  right?: boolean;
  children: ReactNode;
}) {
  const active = sort === col;
  return (
    <th className={["px-3 py-2 font-medium select-none", right ? "text-right" : ""].join(" ")}>
      <button
        type="button"
        onClick={() => onClick(col as never)}
        className={[
          "inline-flex items-center gap-1 hover:text-ivory transition-colors",
          active ? "text-ivory" : "",
        ].join(" ")}
      >
        <span>{children}</span>
        {active && <span className="text-[10px]">{dir === "desc" ? "▼" : "▲"}</span>}
      </button>
    </th>
  );
}

function Th({ right, children }: { right?: boolean; children: ReactNode }) {
  return <th className={["px-3 py-2 font-medium", right ? "text-right" : ""].join(" ")}>{children}</th>;
}

function SelectChip({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="inline-flex items-center gap-2 bg-ivory/[.04] border border-ivory/10 rounded-md px-2 py-1.5 text-[12px]">
      <span className="text-ivory/45 font-mono uppercase tracking-wider text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-ivory/95 outline-none cursor-pointer"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-slate-dark text-ivory">{l}</option>
        ))}
      </select>
    </label>
  );
}

function Pagination({
  offset, limit, total, onChange,
}: { offset: number; limit: number; total: number; onChange: (n: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between mt-4 text-[12px] text-ivory/55">
      <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-2.5 py-1 rounded bg-ivory/[.04] hover:bg-ivory/[.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >Prev</button>
        <span className="px-3 py-1">{page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => onChange(offset + limit)}
          disabled={offset + limit >= total}
          className="px-2.5 py-1 rounded bg-ivory/[.04] hover:bg-ivory/[.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >Next</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] uppercase tracking-wider text-ivory/55 font-medium mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Card({ label, num, sub }: { label: string; num: number | string; sub: string }) {
  return (
    <div className="rounded-lg border border-ivory/[.08] bg-ivory/[.02] p-4">
      <div className="text-[11px] text-ivory/45 uppercase tracking-wider font-mono">{label}</div>
      <div className="text-[22px] font-medium tracking-tight text-ivory mt-1">{typeof num === "number" ? num.toLocaleString() : num}</div>
      <div className="text-[11px] text-ivory/50 mt-1">{sub}</div>
    </div>
  );
}

function StatusPill({ status, kind }: { status: string; kind: string | null }) {
  const label = status === "ok" ? "ok" : (kind || status);
  const color =
    status === "ok"
      ? { bg: "rgba(126,180,114,0.15)", fg: "#7eb472" }
      : kind === "over_quota"
        ? { bg: "rgba(217,119,87,0.18)", fg: "#d97757" }
        : { bg: "rgba(214,177,91,0.16)", fg: "#d6b15b" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-wider"
      style={{ background: color.bg, color: color.fg }}
    >
      {label}
    </span>
  );
}

function TierBadge({ tier, hasSub }: { tier: string; hasSub: boolean }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    free:  { bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.55)" },
    chad:  { bg: "rgba(126,180,114,0.18)", fg: "#7eb472" },
    payg:  { bg: "rgba(126,180,114,0.18)", fg: "#7eb472" },
    admin: { bg: "rgba(217,119,87,0.18)",  fg: "#d97757" },
  };
  const p = palette[tier] || palette.free;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-wider"
      style={{ background: p.bg, color: p.fg }}
    >
      {tier}{hasSub && tier === "chad" ? " · sub" : ""}
    </span>
  );
}

function UserPill({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-ivory/[.06] px-3 py-1 text-[12px] text-ivory/70 font-mono">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <span>{email}</span>
      <button onClick={onSignOut} className="text-ivory/40 underline pl-1">sign out</button>
    </div>
  );
}

function Shell({ children, pill }: { children: ReactNode; pill?: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-dark text-ivory" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-12">
        <header className="flex items-center justify-between mb-7 flex-wrap gap-3">
          <h1 className="text-[22px] font-medium tracking-tight">Veronum · admin</h1>
          {pill}
        </header>
        {children}
      </div>
    </div>
  );
}

function SignInForm({ supabase }: { supabase: ReturnType<typeof getBrowserSupabase> }) {
  const [emailInput, setEmailInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    });
    setBusy(false);
    if (error) setMsg({ text: `Error: ${error.message}`, ok: false });
    else setMsg({ text: "✓ Check your email for the magic link.", ok: true });
  }
  return (
    <Shell>
      <div className="max-w-[440px] mx-auto mt-12">
        <h2 className="text-[18px] mb-1">Admin sign-in</h2>
        <p className="text-ivory/55 text-[13px] mb-5">Magic link → land back here, signed in.</p>
        <form onSubmit={send} className="flex gap-2">
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 bg-ivory/[.04] border border-ivory/10 rounded-md px-3 py-2 text-[14px] text-ivory/95 placeholder:text-ivory/30 outline-none focus:border-ivory/30"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-md bg-ivory text-slate-dark text-[14px] font-medium hover:bg-ivory/90 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send link"}
          </button>
        </form>
        {msg && <p className={["mt-3 text-[12.5px]", msg.ok ? "text-emerald-400" : "text-red-300/90"].join(" ")}>{msg.text}</p>}
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────
function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
