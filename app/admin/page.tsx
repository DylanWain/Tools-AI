/**
 * /admin — creator-only analytics dashboard.
 *
 * Sign in with magic link → calls the `veronum_admin_stats` Supabase
 * RPC which gates on tier='admin' for the caller. Only metadata is
 * surfaced (users, downloads, signups, billed totals); chat content
 * is never read. The page itself is noindex / nofollow.
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type Stats = {
  generated_at?: string;
  error?: string;
  range?: { from: string; to: string };
  users?: { total: number; in_range: number; active_24h: number; active_7d: number; active_30d: number };
  subscriptions?: { flat_total: number; payg_total: number; free: number; admin: number; subscribed_in_range: number };
  website?: { visits_in_range: number; unique_visitors_in_range: number; top_pages: Array<{ page: string; visits: number }> };
  downloads?: {
    total: number;
    in_range: number;
    unique_users: number;
    per_user: Array<{ user_id: string; email: string | null; downloads: number; last: string | null }>;
  };
  conversations?: { in_range: number; by_editor: Record<string, number> };
  dispatch_modes?: Record<string, number>;
  editors_used?: Record<string, number>;
  terminal_opens?: number;
  voice_sessions?: number;
  installs?: { total_paired: number; paired_in_range: number };
  usage?: {
    total_billed_cents: number;
    mtd_billed_cents: number;
    // Cost layer (populated by veronum_admin_cost_stats — what WE pay
    // OpenAI vs what we charge users). Optional because the RPC is
    // additive; if it errors the existing usage card still renders.
    total_consumed_cents?: number;
    mtd_consumed_cents?: number;
    range_consumed_cents?: number;
    range_billed_cents?: number;
    margin_cents?: number;
    cost_by_api?: Record<string, number>;
  };
  recent_users?: Array<{ id: string; email: string | null; tier: string; last_call_at: string | null; period_billed_cents: number | null; created_at: string | null }>;
  recent_downloads?: Array<{ ts: string; source: string | null; app_version: string | null; user_email: string | null }>;
};

/** Shape returned by veronum_admin_compare_stats(p_days). The compare
 *  RPC is additive — if it fails (migration 003 not yet applied), the
 *  rest of the dashboard still renders. */
type CompareStats = {
  generated_at?: string;
  range_days?: number;
  totals?: {
    events: number;
    unique_users: number;
    cost_cents: number;
    errors: number;
    paywall_hits: number;
  };
  top_models?: Array<{ model_id: string; calls: number; cost_cents: number; errors: number }>;
  mode_split?: Array<{ mode: string; calls: number }>;
  top_spenders?: Array<{ email: string; cost_cents: number; calls: number }>;
  funnel?: { signups: number; first_send: number; hit_paywall: number; subscribed: number };
  dau?: Array<{ day: string; users: number; calls: number; cost_cents: number }>;
  recent?: Array<{
    ts: string;
    user_email: string | null;
    mode: string;
    model_id: string;
    status: string;
    error_kind: string | null;
    cost_cents: number;
    prompt_chars: number;
    prompt_preview: string | null;
    duration_ms: number | null;
  }>;
};

const RANGE_OPTIONS: Array<{ label: string; days: number }> = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

// Reuse the shared browser Supabase client — it now persists sessions
// to localStorage ("veronum-auth" storageKey) so the magic-link
// redirect back to /admin keeps the user signed in across reloads,
// AND shares the session with /chat etc. so signing in here is enough
// for the whole site.
const getClient = getBrowserSupabase;

function fmtCents(c: number | null | undefined) {
  return "$" + ((c || 0) / 100).toFixed(2);
}
function fmtTime(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch { return "—"; }
}

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [compareStats, setCompareStats] = useState<CompareStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<number>(7);

  // Sign-in form state
  const [emailInput, setEmailInput] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicMsg, setMagicMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Re-check session on mount + whenever Supabase fires onAuthStateChange.
  useEffect(() => {
    const supabase = getClient();
    let mounted = true;
    async function refresh() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        setSignedIn(true);
        setEmail(session.user.email || session.user.id.slice(0, 8));
        await loadStats(rangeDays);
      } else {
        setSignedIn(false);
        setStats(null);
      }
    }
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { refresh(); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-load stats when the user changes the range picker.
  useEffect(() => {
    if (signedIn) loadStats(rangeDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  async function loadStats(days: number) {
    setLoadError(null);
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    const supabase = getClient();
    // Fetch the main dashboard + the cost breakdown in parallel. The
    // cost RPC is additive — if it fails (e.g. migration not yet
    // applied), we still render the existing cards with whatever the
    // main RPC returned.
    const [statsRes, costRes, compareRes] = await Promise.all([
      supabase.rpc("veronum_admin_stats", { p_from: from, p_to: to }),
      supabase.rpc("veronum_admin_cost_stats", { p_from: from, p_to: to }),
      // New compare-chat analytics. Additive — if the RPC is missing
      // (migration 003 not applied yet) the rest of the dashboard
      // still renders, and the compare section just stays empty.
      supabase.rpc("veronum_admin_compare_stats", { p_days: days }),
    ]);
    if (statsRes.error) { setLoadError(statsRes.error.message); return; }
    const base = (statsRes.data ?? {}) as Stats;
    if (!costRes.error && costRes.data && typeof costRes.data === "object" && !("error" in costRes.data)) {
      const c = costRes.data as {
        total_consumed_cents?: number;
        mtd_consumed_cents?: number;
        range_consumed_cents?: number;
        range_billed_cents?: number;
        margin_cents?: number;
        cost_by_api?: Record<string, number>;
      };
      base.usage = {
        ...(base.usage ?? { total_billed_cents: 0, mtd_billed_cents: 0 }),
        total_consumed_cents: c.total_consumed_cents,
        mtd_consumed_cents: c.mtd_consumed_cents,
        range_consumed_cents: c.range_consumed_cents,
        range_billed_cents: c.range_billed_cents,
        margin_cents: c.margin_cents,
        cost_by_api: c.cost_by_api,
      };
    }
    setStats(base);
    if (!compareRes.error && compareRes.data && typeof compareRes.data === "object") {
      setCompareStats(compareRes.data as CompareStats);
    } else if (compareRes.error) {
      // Non-fatal — log so we know the migration needs applying.
      console.warn("[admin] compare stats unavailable:", compareRes.error.message);
      setCompareStats(null);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput) return;
    setMagicSending(true);
    setMagicMsg(null);
    const { error } = await getClient().auth.signInWithOtp({
      email: emailInput,
      options: { emailRedirectTo: window.location.href },
    });
    setMagicSending(false);
    if (error) setMagicMsg({ text: `Error: ${error.message}`, ok: false });
    else setMagicMsg({ text: "✓ Check your email for the magic link.", ok: true });
  }

  async function signOut() {
    await getClient().auth.signOut();
    setSignedIn(false);
    setStats(null);
    setCompareStats(null);
  }

  if (signedIn === null) {
    return <Shell>Loading…</Shell>;
  }

  if (!signedIn) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm rounded-2xl bg-ivory/[.04] border border-ivory/10 p-7">
          <h2 className="text-lg font-medium mb-1">Sign in</h2>
          <p className="text-[13px] text-ivory/60 mb-4">Admin access only. We send a magic link to your email.</p>
          <form onSubmit={sendMagicLink} className="space-y-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="block w-full rounded-lg bg-ivory/[.04] border border-ivory/10 px-3 py-2.5 text-[14px] text-ivory placeholder:text-ivory/30 outline-none focus:border-veronum/60"
            />
            <button
              type="submit"
              disabled={magicSending}
              className="block w-full rounded-lg bg-veronum text-slate-dark font-medium py-2.5 text-[14px] disabled:opacity-50 disabled:cursor-progress"
            >
              {magicSending ? "Sending…" : "Send magic link"}
            </button>
          </form>
          {magicMsg && (
            <p className={`mt-3 text-[12px] ${magicMsg.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {magicMsg.text}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  if (stats && stats.error === "unauthorized") {
    return (
      <Shell pill={<UserPill email={email} onSignOut={signOut} />}>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[.08] text-rose-200 px-4 py-3 text-[13px]">
          Signed in, but this account doesn&apos;t have admin access.
        </div>
      </Shell>
    );
  }

  return (
    <Shell pill={<UserPill email={email} onSignOut={signOut} />}>
      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/[.08] text-rose-200 px-4 py-3 text-[13px]">
          Couldn&apos;t load stats: {loadError}
        </div>
      )}
      {!stats ? (
        <div className="text-ivory/60 text-[13px]">Loading stats…</div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-ivory/40 mr-2">Range</span>
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.days}
                onClick={() => setRangeDays(o.days)}
                className={`rounded-full px-3 py-1 text-[12px] font-mono ${
                  rangeDays === o.days
                    ? "bg-veronum text-slate-dark"
                    : "bg-ivory/[.06] text-ivory/70 hover:bg-ivory/[.10]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Card label="Website visits" num={stats.website?.visits_in_range ?? 0} sub={`${stats.website?.unique_visitors_in_range ?? 0} unique`} />
            <Card label="Total users" num={stats.users?.total ?? 0} sub={`${stats.users?.in_range ?? 0} new in range`} />
            <Card label="Downloads" num={stats.downloads?.total ?? 0} sub={`${stats.downloads?.in_range ?? 0} in range · ${stats.downloads?.unique_users ?? 0} unique users`} />
            <Card label="Paired bridges" num={stats.installs?.total_paired ?? 0} sub={`${stats.installs?.paired_in_range ?? 0} new in range`} />
            <Card label="Subscribers" num={(stats.subscriptions?.flat_total ?? 0) + (stats.subscriptions?.payg_total ?? 0)} sub={`${stats.subscriptions?.flat_total ?? 0} flat · ${stats.subscriptions?.payg_total ?? 0} payg · ${stats.subscriptions?.subscribed_in_range ?? 0} new in range`} />
            <Card label="Conversations" num={stats.conversations?.in_range ?? 0} sub={Object.entries(stats.conversations?.by_editor || {}).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} />
            <Card label="Voice sessions" num={stats.voice_sessions ?? 0} sub="in range" />
            <Card label="Terminals opened" num={stats.terminal_opens ?? 0} sub="in range" />
            <Card label="Active 24h / 7d / 30d" num={stats.users?.active_24h ?? 0} sub={`${stats.users?.active_7d ?? 0} · ${stats.users?.active_30d ?? 0}`} />
            <Card label="Total billed" num={fmtCents(stats.usage?.total_billed_cents)} sub={`MTD ${fmtCents(stats.usage?.mtd_billed_cents)}`} />
          </div>

          {/* Cost analytics row — separate strip so the "money we owe
              OpenAI vs money we're collecting" view reads at a glance. */}
          <div className="mb-2 mt-6 flex items-baseline gap-2">
            <h3 className="text-[11px] uppercase tracking-wider text-ivory/50">Cost · margin</h3>
            <span className="text-[10px] text-ivory/30">what we pay OpenAI vs what we should be getting</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Card
              label="API cost (we pay)"
              num={fmtCents(stats.usage?.range_consumed_cents)}
              sub={`MTD ${fmtCents(stats.usage?.mtd_consumed_cents)} · all-time ${fmtCents(stats.usage?.total_consumed_cents)}`}
            />
            <Card
              label="Billed in range"
              num={fmtCents(stats.usage?.range_billed_cents)}
              sub="metered events only (voice, whisper, web-search)"
            />
            <Card
              label="Margin"
              num={fmtCents(stats.usage?.margin_cents)}
              sub={(() => {
                const billed = stats.usage?.range_billed_cents ?? 0;
                const consumed = stats.usage?.range_consumed_cents ?? 0;
                if (!billed) return "—";
                const pct = ((billed - consumed) / billed) * 100;
                return `${pct.toFixed(0)}% of billed`;
              })()}
            />
            <Card
              label="Avg margin multiplier"
              num={(() => {
                const consumed = stats.usage?.range_consumed_cents ?? 0;
                const billed = stats.usage?.range_billed_cents ?? 0;
                if (!consumed) return "—";
                return `${(billed / consumed).toFixed(2)}×`;
              })()}
              sub="billed ÷ consumed in range"
            />
          </div>

          <Section title="Cost by API (in range)">
            <BreakdownBox label="raw_cents by service" data={stats.usage?.cost_by_api || {}} />
          </Section>

          <Section title="How they're coding (in range)">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <BreakdownBox label="Input mode" data={stats.dispatch_modes || {}} />
              <BreakdownBox label="Editor" data={stats.editors_used || {}} />
              <BreakdownBox label="Top pages" data={Object.fromEntries((stats.website?.top_pages || []).map((p) => [p.page, p.visits]))} />
            </div>
          </Section>

          <Section title="Downloads per user (top 30)">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] font-mono">
                <thead>
                  <tr className="text-left text-ivory/50 uppercase tracking-wider text-[10px]">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Times downloaded</th>
                    <th className="py-2 pr-3">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.downloads?.per_user || []).map((u, i) => (
                    <tr key={i} className="border-t border-ivory/5 text-ivory/80">
                      <td className="py-2 pr-3 whitespace-nowrap">{u.email || u.user_id?.slice(0, 8) || "—"}</td>
                      <td className="py-2 pr-3">{u.downloads}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(u.last)}</td>
                    </tr>
                  ))}
                  {(stats.downloads?.per_user || []).length === 0 && (
                    <tr><td colSpan={3} className="py-5 text-center text-ivory/40">no downloads with a signed-in user yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Recent users">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] font-mono">
                <thead>
                  <tr className="text-left text-ivory/50 uppercase tracking-wider text-[10px]">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3">Billed (¢)</th>
                    <th className="py-2 pr-3">Last call</th>
                    <th className="py-2 pr-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.recent_users || []).map((u) => (
                    <tr key={u.id} className="border-t border-ivory/5 text-ivory/80">
                      <td className="py-2 pr-3 whitespace-nowrap">{u.email || u.id?.slice(0, 8) || "—"}</td>
                      <td className="py-2 pr-3"><TierBadge tier={u.tier} /></td>
                      <td className="py-2 pr-3">{u.period_billed_cents ?? 0}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(u.last_call_at)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(u.created_at)}</td>
                    </tr>
                  ))}
                  {(stats.recent_users || []).length === 0 && (
                    <tr><td colSpan={5} className="py-5 text-center text-ivory/40">no users yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Recent downloads (30d)">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] font-mono">
                <thead>
                  <tr className="text-left text-ivory/50 uppercase tracking-wider text-[10px]">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.recent_downloads || []).map((d, i) => (
                    <tr key={i} className="border-t border-ivory/5 text-ivory/80">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(d.ts)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{d.user_email || "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{d.source || "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{d.app_version || "—"}</td>
                    </tr>
                  ))}
                  {(stats.recent_downloads || []).length === 0 && (
                    <tr><td colSpan={4} className="py-5 text-center text-ivory/40">no downloads tracked yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {compareStats && compareStats.totals && (
            <CompareChatSection cs={compareStats} />
          )}

          <p className="mt-6 text-center text-[11px] text-ivory/40 leading-relaxed">
            Prompts are stored as a 200-character preview only. Full conversation content is never surfaced here.
          </p>
        </>
      )}
    </Shell>
  );
}

/** Compare-chat dedicated dashboard section. Reads from
 *  veronum_admin_compare_stats (migration 003). Renders five panels:
 *  totals, activation funnel, top models, top spenders, mode split,
 *  and a live feed of the last 50 Sends with their prompt preview. */
function CompareChatSection({ cs }: { cs: CompareStats }) {
  const t = cs.totals!;
  const f = cs.funnel;
  const ms = cs.mode_split ?? [];
  const compareCount = ms.find((x) => x.mode === "compare")?.calls ?? 0;
  const agentsCount = ms.find((x) => x.mode === "agents")?.calls ?? 0;
  // Conversion rates from the activation funnel. Floor to 0 when the
  // upstream count is 0 so we don't render "NaN%".
  const pctSendOfSignup = f && f.signups > 0
    ? Math.round((f.first_send / f.signups) * 100) : 0;
  const pctSubOfSignup = f && f.signups > 0
    ? Math.round((f.subscribed / f.signups) * 100) : 0;
  const pctSubOfPaywall = f && f.hit_paywall > 0
    ? Math.round((f.subscribed / f.hit_paywall) * 100) : 0;

  return (
    <>
      <Section title="Compare chat — activity">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <Card label="API calls" num={t.events} sub={`${t.unique_users} unique users`} />
          <Card label="Total cost" num={`$${(t.cost_cents / 100).toFixed(2)}`} sub="raw API cost in range" />
          <Card label="Errors" num={t.errors} sub={`${t.events > 0 ? Math.round((t.errors / t.events) * 100) : 0}% of calls`} />
          <Card label="Paywall hits" num={t.paywall_hits} sub="free trial cap reached" />
          <Card
            label="Mode split"
            num={`${compareCount} / ${agentsCount}`}
            sub="compare / multi-agent"
          />
        </div>

        {f && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Signups (range)" num={f.signups} sub="created in window" />
            <Card label="First Send" num={`${pctSendOfSignup}%`} sub={`${f.first_send} of ${f.signups}`} />
            <Card label="Hit paywall" num={f.hit_paywall} sub="free-tier cap reached" />
            <Card label="Subscribed" num={`${pctSubOfSignup}%`} sub={`${f.subscribed} of ${f.signups} (${pctSubOfPaywall}% of paywall hits)`} />
          </div>
        )}
      </Section>

      <Section title="Top models (by calls)">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-ivory/45 text-left">
              <tr className="border-b border-ivory/[.07]">
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium text-right">Calls</th>
                <th className="py-2 pr-4 font-medium text-right">Cost</th>
                <th className="py-2 pr-4 font-medium text-right">Errors</th>
                <th className="py-2 font-medium text-right">Err %</th>
              </tr>
            </thead>
            <tbody>
              {(cs.top_models ?? []).map((m) => (
                <tr key={m.model_id} className="border-b border-ivory/[.04]">
                  <td className="py-2 pr-4 font-mono text-[12px] text-ivory/90">{m.model_id}</td>
                  <td className="py-2 pr-4 text-right font-mono">{m.calls}</td>
                  <td className="py-2 pr-4 text-right font-mono">${(m.cost_cents / 100).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{m.errors}</td>
                  <td className="py-2 text-right font-mono">{m.calls > 0 ? Math.round((m.errors / m.calls) * 100) : 0}%</td>
                </tr>
              ))}
              {(cs.top_models ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-3 text-ivory/40 text-[12px] text-center">No events in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Top spenders">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-ivory/45 text-left">
              <tr className="border-b border-ivory/[.07]">
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium text-right">Cost</th>
                <th className="py-2 font-medium text-right">Calls</th>
              </tr>
            </thead>
            <tbody>
              {(cs.top_spenders ?? []).map((s) => (
                <tr key={s.email} className="border-b border-ivory/[.04]">
                  <td className="py-2 pr-4 text-ivory/85">{s.email}</td>
                  <td className="py-2 pr-4 text-right font-mono">${(s.cost_cents / 100).toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">{s.calls}</td>
                </tr>
              ))}
              {(cs.top_spenders ?? []).length === 0 && (
                <tr><td colSpan={3} className="py-3 text-ivory/40 text-[12px] text-center">No spend yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Live feed (last 50 Sends)">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-ivory/45 text-left">
              <tr className="border-b border-ivory/[.07]">
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Mode</th>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 font-medium">Prompt (first 200 chars)</th>
                <th className="py-2 pr-3 font-medium text-right">¢</th>
                <th className="py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {(cs.recent ?? []).map((r, i) => (
                <tr key={`${r.ts}-${i}`} className="border-b border-ivory/[.04]">
                  <td className="py-2 pr-3 font-mono text-[11px] text-ivory/60 whitespace-nowrap">
                    {new Date(r.ts).toLocaleString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3 text-ivory/85 truncate max-w-[180px]">{r.user_email || "—"}</td>
                  <td className="py-2 pr-3 text-ivory/65 text-[11px] uppercase tracking-wider">{r.mode}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-ivory/80">{r.model_id}</td>
                  <td className="py-2 pr-3 text-ivory/70 max-w-[420px] truncate" title={r.prompt_preview ?? ""}>
                    {r.prompt_preview || <span className="text-ivory/30">(empty)</span>}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-ivory/85">{r.cost_cents}</td>
                  <td className="py-2 text-right">
                    <StatusPill status={r.status} kind={r.error_kind} />
                  </td>
                </tr>
              ))}
              {(cs.recent ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-4 text-ivory/40 text-center">No events yet — your first user signup + Send will land here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/** Tiny status chip for the live feed. Green ok, amber upstream/error,
 *  red paywall/auth. */
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

function Shell({ children, pill }: { children: ReactNode; pill?: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-dark text-ivory" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif" }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-12">
        <header className="flex items-center justify-between mb-7 flex-wrap gap-3">
          <h1 className="text-[22px] font-medium tracking-tight">Veronum · admin</h1>
          {pill}
        </header>
        {children}
      </div>
    </div>
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

function Card({ label, num, sub }: { label: string; num: number | string; sub: string }) {
  return (
    <div className="rounded-xl border border-ivory/10 bg-ivory/[.04] p-4">
      <div className="text-[11px] uppercase tracking-wider text-ivory/50">{label}</div>
      <div className="mt-1 text-[26px] font-medium font-mono tracking-tight">{num}</div>
      <div className="mt-1 text-[11px] text-ivory/50">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ivory/10 bg-ivory/[.04] p-4 mb-4 overflow-hidden">
      <h3 className="text-[14px] font-medium mb-3 text-ivory/80">{title}</h3>
      {children}
    </div>
  );
}

function BreakdownBox({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="rounded-lg border border-ivory/10 bg-ivory/[.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-ivory/50 mb-2">{label}</div>
      {entries.length === 0 ? (
        <div className="text-[12px] text-ivory/30">no data</div>
      ) : (
        <ul className="space-y-1.5">
          {entries.slice(0, 8).map(([k, v]) => {
            const pct = total > 0 ? (v / total) * 100 : 0;
            return (
              <li key={k} className="text-[12px]">
                <div className="flex justify-between font-mono">
                  <span className="truncate text-ivory/80 mr-2" title={k}>{k}</span>
                  <span className="text-ivory/60">{v}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-ivory/[.05] overflow-hidden">
                  <div className="h-full bg-veronum/60" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const t = (tier || "free").toLowerCase();
  const cls =
    t === "admin" ? "bg-amber-500/15 text-amber-300" :
    t === "payg"  ? "bg-veronum/20 text-veronum" :
    t === "chad"  ? "bg-emerald-500/15 text-emerald-300" :
                    "bg-ivory/10 text-ivory/60";
  return <span className={`inline-block px-1.5 py-px rounded-full text-[10px] uppercase tracking-wide ${cls}`}>{t}</span>;
}
