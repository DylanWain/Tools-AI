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
  usage?: { total_billed_cents: number; mtd_billed_cents: number };
  recent_users?: Array<{ id: string; email: string | null; tier: string; last_call_at: string | null; period_billed_cents: number | null; created_at: string | null }>;
  recent_downloads?: Array<{ ts: string; source: string | null; app_version: string | null; user_email: string | null }>;
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
    const { data, error } = await getClient().rpc("veronum_admin_stats", { p_from: from, p_to: to });
    if (error) { setLoadError(error.message); return; }
    setStats((data ?? null) as Stats);
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

          <p className="mt-6 text-center text-[11px] text-ivory/40 leading-relaxed">
            Chat content is never stored or surfaced here. Only metadata — sign-ins, downloads, dispatch counts, billing totals.
          </p>
        </>
      )}
    </Shell>
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
