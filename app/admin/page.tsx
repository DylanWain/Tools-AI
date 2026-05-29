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
  users?: { total: number; active_24h: number; active_7d: number; active_30d: number; signups_24h: number; signups_7d: number };
  subscriptions?: { flat: number; payg: number; free: number; admin: number };
  downloads?: { total: number; last_24h: number; last_7d: number; unique_users: number; unique_ip_hashes: number };
  installs?: { total_paired: number; paired_24h: number; paired_7d: number };
  usage?: { total_billed_cents: number; mtd_billed_cents: number };
  recent_users?: Array<{ id: string; email: string | null; tier: string; last_call_at: string | null; period_billed_cents: number | null; created_at: string | null }>;
  recent_downloads?: Array<{ ts: string; source: string | null; app_version: string | null; user_email: string | null }>;
};

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
        await loadStats();
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

  async function loadStats() {
    setLoadError(null);
    const { data, error } = await getClient().rpc("veronum_admin_stats");
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <Card label="Total users" num={stats.users?.total ?? 0} sub={`${stats.users?.active_24h ?? 0} active 24h · ${stats.users?.active_7d ?? 0} 7d`} />
            <Card label="Signups · 24h" num={stats.users?.signups_24h ?? 0} sub={`${stats.users?.signups_7d ?? 0} this week`} />
            <Card label="Downloads" num={stats.downloads?.total ?? 0} sub={`${stats.downloads?.last_24h ?? 0} 24h · ${stats.downloads?.last_7d ?? 0} 7d`} />
            <Card label="Paired bridges" num={stats.installs?.total_paired ?? 0} sub={`${stats.installs?.paired_24h ?? 0} new 24h`} />
            <Card label="Subscribers" num={(stats.subscriptions?.flat ?? 0) + (stats.subscriptions?.payg ?? 0)} sub={`${stats.subscriptions?.flat ?? 0} flat · ${stats.subscriptions?.payg ?? 0} payg`} />
            <Card label="Total billed" num={fmtCents(stats.usage?.total_billed_cents)} sub={`MTD ${fmtCents(stats.usage?.mtd_billed_cents)}`} />
          </div>

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

function TierBadge({ tier }: { tier: string }) {
  const t = (tier || "free").toLowerCase();
  const cls =
    t === "admin" ? "bg-amber-500/15 text-amber-300" :
    t === "payg"  ? "bg-veronum/20 text-veronum" :
    t === "chad"  ? "bg-emerald-500/15 text-emerald-300" :
                    "bg-ivory/10 text-ivory/60";
  return <span className={`inline-block px-1.5 py-px rounded-full text-[10px] uppercase tracking-wide ${cls}`}>{t}</span>;
}
