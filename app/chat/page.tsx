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
  | { kind: "sign-in"; mode: "signin" | "signup"; busy?: boolean }
  | { kind: "no-bridge" }
  | { kind: "no-tunnel"; bridgeHost: string | null }
  | { kind: "redirecting"; url: string }
  | { kind: "error"; message: string };

export default function ChatRedirect() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [view, setView] = useState<ViewState>({ kind: "checking" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Find the user's bridge and redirect, or report what's missing.
  async function findBridgeAndRedirect() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      setView({ kind: "sign-in", mode });
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
    let cancelled = false;
    (async () => {
      // First — check the URL for an admin-issued OTP bypass:
      //   /chat?email=...&otp=...
      // We use this when Supabase's redirect_to-stripping kills the
      // magic-link redirect, or when the maintainer hands the user a
      // one-shot URL during MVP testing. Verifies the OTP inline,
      // establishes a real persistent Supabase session, then proceeds
      // through the normal bridge-lookup → redirect flow.
      if (typeof window !== "undefined") {
        const params = new URL(window.location.href).searchParams;
        const urlEmail = params.get("email");
        const urlOtp = params.get("otp");
        if (urlEmail && urlOtp) {
          const { error: vErr } = await supabase.auth.verifyOtp({
            email: urlEmail,
            token: urlOtp,
            type: "magiclink",
          });
          if (cancelled) return;
          if (vErr) {
            setView({ kind: "error", message: vErr.message });
            return;
          }
          // Clean the OTP out of the URL so a back-tap doesn't reuse it.
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
      if (!cancelled) findBridgeAndRedirect();
    })();
    // Re-attempt on SIGNED_IN (covers either password sign-in or
    // the OTP-bypass path establishing a session inline).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") findBridgeAndRedirect();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Email + password sign-in / sign-up. No emails sent — Supabase auth
  // config has mailer_autoconfirm=true so new accounts skip the
  // confirmation step. Existing magic-link users (no password) can
  // sign up here with their same email + a new password; Supabase
  // upgrades the row to have a password without losing the user_id.
  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    const eml = email.trim();
    const pwd = password;
    if (!/.+@.+\..+/.test(eml)) {
      setView({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    if (pwd.length < 8) {
      setView({ kind: "error", message: "Password must be at least 8 characters." });
      return;
    }
    setView({ kind: "sign-in", mode, busy: true });
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email: eml, password: pwd })
      : supabase.auth.signUp({ email: eml, password: pwd });
    const { error } = await fn;
    if (error) {
      // Friendly mapping for the common cases.
      let msg = error.message;
      if (/Invalid login credentials/i.test(msg)) {
        msg = "Email or password is wrong. (If you used a magic link before, hit 'Sign up' to set a password.)";
      } else if (/User already registered/i.test(msg)) {
        msg = "That email is already registered. Hit 'Sign in' instead.";
      }
      setView({ kind: "error", message: msg });
      return;
    }
    // Success — onAuthStateChange SIGNED_IN fires next and runs
    // findBridgeAndRedirect, which navigates away.
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
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8 text-left">
            <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h1>
            <p className="text-[14px] text-ink-faded mb-5">
              {mode === "signin"
                ? "Email and password. After sign-in we open your paired Mac."
                : "Pick a password. No email confirmation needed — you'll be signed in immediately."}
            </p>
            <form onSubmit={submitAuth} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-ink/15 px-4 py-2.5 text-[15px] focus:outline-none focus:border-slate-dark"
                autoComplete="email"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-ink/15 px-4 py-2.5 text-[15px] focus:outline-none focus:border-slate-dark"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="submit"
                disabled={view.busy}
                className="w-full bg-slate-dark text-ivory rounded-full px-4 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition disabled:opacity-50"
              >
                {view.busy
                  ? "…"
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>
            </form>
            <p className="text-[13px] text-ink-faded mt-4 text-center">
              {mode === "signin" ? (
                <>
                  No account yet?{" "}
                  <button
                    onClick={() => {
                      setMode("signup");
                      setView({ kind: "sign-in", mode: "signup" });
                    }}
                    className="underline text-ink hover:opacity-70"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already signed up?{" "}
                  <button
                    onClick={() => {
                      setMode("signin");
                      setView({ kind: "sign-in", mode: "signin" });
                    }}
                    className="underline text-ink hover:opacity-70"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
            <p className="text-[12px] text-ink-faded mt-4 text-center">
              Don&rsquo;t have Veronum Bridge installed yet?{" "}
              <Link href="/pair-bridge" className="underline">Pair your Mac</Link>.
            </p>
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
