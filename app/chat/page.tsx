/**
 * /chat — auth-gated redirect to the user's paired Mac.
 *
 * The chat surface is the dark Veronum UI that the Bridge daemon
 * already ships at localhost:3001 on the user's Mac. We don't reskin
 * it here — we just tunnel-redirect to it. Each daemon spawns
 * cloudflared on launch and publishes its current trycloudflare.com
 * URL to its veronum_bridges.tunnel_url column. This page reads that
 * column and 302s the browser to it.
 *
 * Why redirect rather than port:
 *   - The localhost UI works perfectly — drawer + voice + sessions
 *   - The browser-side bridge.fetch-over-Supabase port had reliability
 *     issues with Realtime broadcast delivery
 *   - One canonical source of truth for the chat surface
 *
 * Flow:
 *   1. Auth check — getSession from the persisted Supabase client.
 *   2. Query veronum_bridges for the user's bridge.
 *   3. If no bridge   → /pair-bridge.
 *   4. If no tunnel   → "Wake up your Mac" message + retry button.
 *   5. Otherwise      → window.location = bridge.tunnel_url.
 *
 * Client component because we have to read the Supabase session
 * from localStorage (which is browser-only).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";

type ViewState =
  | { kind: "checking" }
  | { kind: "sign-in"; emailSent?: string }
  | { kind: "no-bridge" }
  | { kind: "no-tunnel"; bridgeHost: string | null }
  | { kind: "redirecting"; url: string }
  | { kind: "error"; message: string };

export default function ChatRedirect() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [view, setView] = useState<ViewState>({ kind: "checking" });
  const [email, setEmail] = useState("");

  // Find the user's bridge and redirect, or report what's missing.
  async function findBridgeAndRedirect() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      setView({ kind: "sign-in" });
      return;
    }
    const { data: bridges, error } = await supabase
      .from("veronum_bridges")
      .select("install_id, hostname, tunnel_url, last_seen_at")
      .not("user_id", "is", null)
      .order("last_seen_at", { ascending: false })
      .limit(1);
    if (error) {
      setView({ kind: "error", message: error.message });
      return;
    }
    if (!bridges || bridges.length === 0) {
      setView({ kind: "no-bridge" });
      return;
    }
    const bridge = bridges[0];
    if (!bridge.tunnel_url) {
      setView({ kind: "no-tunnel", bridgeHost: bridge.hostname });
      return;
    }
    setView({ kind: "redirecting", url: bridge.tunnel_url });
    window.location.href = bridge.tunnel_url;
  }

  useEffect(() => {
    findBridgeAndRedirect();
    // Re-attempt on SIGNED_IN (covers the magic-link redirect landing here).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") findBridgeAndRedirect();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/.+@.+\..+/.test(trimmed)) {
      setView({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    // Redirect the magic link back to /chat so we land here, query the
    // bridge, and tunnel-redirect — no detour through /pair-bridge.
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/chat` },
    });
    if (error) {
      setView({ kind: "error", message: error.message });
      return;
    }
    setView({ kind: "sign-in", emailSent: trimmed });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ivory px-6 py-16">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="font-serif text-[24px] font-medium tracking-tight text-ink block mb-6"
        >
          Veronum
        </Link>

        {view.kind === "checking" && (
          <p className="text-[14px] text-ink-faded">Finding your Mac…</p>
        )}

        {view.kind === "sign-in" && (
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
            {view.emailSent ? (
              <>
                <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
                  Check your email
                </h1>
                <p className="text-[14px] text-ink-faded">
                  Sent a sign-in link to{" "}
                  <span className="font-mono text-ink">{view.emailSent}</span>.
                  Tap it to come back here and open your Mac.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
                  Sign in
                </h1>
                <p className="text-[14px] text-ink-faded mb-6">
                  We&rsquo;ll email you a one-time link. Click it and you&rsquo;ll
                  land back here, then we open the chat on your paired Mac.
                </p>
                <form onSubmit={sendMagicLink} className="space-y-3">
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-full border border-ink/15 px-4 py-2.5 text-[15px] focus:outline-none focus:border-slate-dark"
                  />
                  <button
                    type="submit"
                    className="w-full bg-slate-dark text-ivory rounded-full px-4 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
                  >
                    Send sign-in link
                  </button>
                </form>
                <p className="text-[12px] text-ink-faded mt-4">
                  Don&rsquo;t have Veronum Bridge installed yet?{" "}
                  <Link href="/pair-bridge" className="underline">Pair your Mac</Link>.
                </p>
              </>
            )}
          </div>
        )}

        {view.kind === "error" && (
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
            <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
              Couldn&rsquo;t open chat
            </h1>
            <p className="text-[14px] text-ink-faded break-words mb-6">{view.message}</p>
            <button
              onClick={() => findBridgeAndRedirect()}
              className="inline-block bg-slate-dark text-ivory rounded-full px-6 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
            >
              Retry
            </button>
          </div>
        )}

        {view.kind === "no-bridge" && (
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
            <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
              No Mac paired yet
            </h1>
            <p className="text-[14px] text-ink-faded mb-6">
              Install Veronum Bridge on your Mac, then pair it.
            </p>
            <a
              href="https://github.com/DylanWain/veronum-bridge/releases/latest/download/Veronum-Bridge.dmg"
              className="inline-block bg-slate-dark text-ivory rounded-full px-6 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition mr-2"
            >
              Download for Mac
            </a>
            <Link
              href="/pair-bridge"
              className="inline-block text-ink underline text-[14px] mt-3"
            >
              Already have it? Pair
            </Link>
          </div>
        )}

        {view.kind === "no-tunnel" && (
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
            <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
              Wake up your Mac
            </h1>
            <p className="text-[14px] text-ink-faded mb-6">
              {view.bridgeHost ? (
                <>
                  <span className="font-mono text-ink">{view.bridgeHost}</span> hasn&rsquo;t reported
                  a tunnel URL recently. Make sure the Veronum Bridge menu-bar app is running on your
                  Mac and connected to the internet.
                </>
              ) : (
                <>Your Mac hasn&rsquo;t reported a tunnel URL recently.</>
              )}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-block bg-slate-dark text-ivory rounded-full px-6 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
            >
              Retry
            </button>
          </div>
        )}

        {view.kind === "redirecting" && (
          <p className="text-[14px] text-ink-faded">
            Opening your Mac&hellip;
            <br />
            <span className="font-mono text-[12px] text-ink-dim block mt-2 break-all">
              {view.url}
            </span>
          </p>
        )}
      </div>
    </main>
  );
}
