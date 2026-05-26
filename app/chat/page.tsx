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

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";

type ViewState =
  | { kind: "checking" }
  | { kind: "no-session" }
  | { kind: "no-bridge" }
  | { kind: "no-tunnel"; bridgeHost: string | null }
  | { kind: "redirecting"; url: string };

export default function ChatRedirect() {
  const [view, setView] = useState<ViewState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getBrowserSupabase();

      // 1. Auth check
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) {
        if (!cancelled) setView({ kind: "no-session" });
        return;
      }

      // 2. Look up user's bridge(s)
      const { data: bridges, error } = await supabase
        .from("veronum_bridges")
        .select("install_id, hostname, tunnel_url, tunnel_url_updated_at, last_seen_at")
        .not("user_id", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(1);

      if (cancelled) return;
      if (error || !bridges || bridges.length === 0) {
        setView({ kind: "no-bridge" });
        return;
      }
      const bridge = bridges[0];

      if (!bridge.tunnel_url) {
        setView({ kind: "no-tunnel", bridgeHost: bridge.hostname });
        return;
      }

      // 3. Redirect
      setView({ kind: "redirecting", url: bridge.tunnel_url });
      window.location.href = bridge.tunnel_url;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

        {view.kind === "no-session" && (
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
            <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
              Sign in to chat
            </h1>
            <p className="text-[14px] text-ink-faded mb-6">
              You need a paired Mac before opening the chat.
            </p>
            <Link
              href="/pair-bridge"
              className="inline-block bg-slate-dark text-ivory rounded-full px-6 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
            >
              Pair this Mac
            </Link>
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
