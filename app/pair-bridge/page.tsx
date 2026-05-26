/**
 * /pair-bridge — completes the Veronum Bridge pairing flow.
 *
 * Trigger: Veronum Bridge.app opens this URL in the user's default
 *  browser with `?code=<6-char pair code>` after the daemon called
 *  /functions/v1/veronum-bridge/begin-pair.
 *
 * What this page does:
 *   1. Reads `code` from the query string.
 *   2. Checks for an existing Supabase session.
 *      - Signed in    → call /complete-pair with the JWT, show success +
 *                       deep-link back to the daemon via the registered
 *                       URL scheme `veronum-bridge://paired?...`.
 *      - Not signed in → show a magic-link email sign-in form. After
 *                       the link is clicked the user lands back here
 *                       with a session AND the same `code` in the URL,
 *                       and step 2's signed-in branch fires.
 *
 * Why a client component:
 *   - Reads `window.location`, drives a small state machine, deep-links
 *     to a custom URL scheme. All client behaviors. Server rendering
 *     for the shell + Tailwind styling, hydration kicks off the rest.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";

type ViewState =
  | { kind: "loading" }              // initial mount, checking auth state
  | { kind: "signed-out" }           // needs sign-in / sign-up
  | { kind: "pairing"; userId: string }   // signed in, about to call /complete-pair
  | { kind: "paired"; bridgeId: string; installId: string; hostname: string | null }
  | { kind: "error"; message: string };

const SUPABASE_EDGE_FN_URL =
  "https://synpjcammfjebwsmtfpz.supabase.co/functions/v1/veronum-bridge";

export default function PairBridgePage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [code, setCode] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");

  // ─── Read pair code from URL once on mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URL(window.location.href).searchParams.get("code") || "";
    // Normalize: trim, uppercase. The daemon always emits A-Z2-9 (no 0/O/1/I).
    const normalized = raw.trim().toUpperCase();
    setCode(normalized);
  }, []);

  // ─── Decide initial flow ──────────────────────────────────────────────────
  // Three paths in order of preference:
  //   1. Already-signed-in session — straight to pairing.
  //   2. Admin-issued OTP in URL (?email=&otp=) — verify it inline to
  //      establish a session WITHOUT going through the email rate-limited
  //      magic-link flow. Used by `supabase auth admin generate_link` to
  //      hand a tester a one-shot pair URL during MVP testing.
  //   3. No session and no OTP — fall back to magic-link email form.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setView({ kind: "error", message: error.message });
        return;
      }
      if (data.session?.user?.id) {
        setView({ kind: "pairing", userId: data.session.user.id });
        return;
      }

      // No session — check for admin-issued OTP in the URL.
      const params = new URL(window.location.href).searchParams;
      const urlEmail = params.get("email");
      const urlOtp = params.get("otp");
      if (urlEmail && urlOtp) {
        setView({ kind: "loading" });
        const { data: verified, error: verErr } = await supabase.auth.verifyOtp(
          { email: urlEmail, token: urlOtp, type: "magiclink" },
        );
        if (cancelled) return;
        if (verErr || !verified?.session?.user?.id) {
          setView({
            kind: "error",
            message: verErr?.message || "OTP verification failed",
          });
          return;
        }
        setView({ kind: "pairing", userId: verified.session.user.id });
        return;
      }

      setView({ kind: "signed-out" });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ─── Listen for auth-state changes so the magic-link redirect lands here
  //     and immediately transitions us forward instead of waiting on the
  //     initial getSession() call (which has already returned by then).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        setView({ kind: "pairing", userId: session.user.id });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // ─── When we transition into "pairing", call /complete-pair ─────────────
  useEffect(() => {
    if (view.kind !== "pairing") return;
    let cancelled = false;
    (async () => {
      if (!code || code.length !== 6) {
        if (!cancelled) {
          setView({
            kind: "error",
            message: "Missing or malformed pair code. Did you open this page from the Veronum Bridge app?",
          });
        }
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) setView({ kind: "signed-out" });
        return;
      }
      try {
        const res = await fetch(`${SUPABASE_EDGE_FN_URL}/complete-pair`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pair_code: code }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          bridge_id?: string;
          install_id?: string;
          hostname?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.bridge_id || !body.install_id) {
          // Surface BOTH the error code and the underlying detail
          // (Postgres message, network error text, etc.) — the parent
          // code alone (e.g. "complete_pair_failed") often isn't
          // enough to diagnose. Truncated for sane UI.
          const code = body.error || `HTTP ${res.status}`;
          const detail = (body as { detail?: string }).detail;
          setView({
            kind: "error",
            message:
              code === "invalid_or_expired_pair_code"
                ? "That pair code is invalid or has expired. Generate a fresh one from the Bridge app."
                : detail
                ? `${code} · ${detail.slice(0, 240)}`
                : code,
          });
          return;
        }
        setView({
          kind: "paired",
          bridgeId: body.bridge_id,
          installId: body.install_id,
          hostname: body.hostname ?? null,
        });
      } catch (err) {
        if (!cancelled) {
          setView({
            kind: "error",
            message: (err as Error).message || "Network error during pairing.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, code, supabase]);

  // ─── Email + password sign-in/up ──────────────────────────────────────────
  // Magic-link removed: Supabase free-tier caps email sends at 3/hour,
  // and the round-trip is annoying anyway. Auth is now classic
  // email + password with autoconfirm enabled in Supabase config
  // (mailer_autoconfirm=true) so signups skip the confirmation step.
  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const eml = email.trim();
    const pwd = password;
    if (!eml || !/.+@.+\..+/.test(eml)) {
      setView({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    if (pwd.length < 8) {
      setView({ kind: "error", message: "Password must be at least 8 characters." });
      return;
    }
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email: eml, password: pwd })
      : supabase.auth.signUp({ email: eml, password: pwd });
    const { error } = await fn;
    if (error) {
      let msg = error.message;
      if (/Invalid login credentials/i.test(msg)) {
        msg = "Email or password is wrong. (If you used a magic link before, hit 'Sign up' to set a password.)";
      } else if (/User already registered/i.test(msg)) {
        msg = "That email is already registered. Hit 'Sign in' instead.";
      }
      setView({ kind: "error", message: msg });
      return;
    }
    // Success — onAuthStateChange SIGNED_IN fires, the existing
    // 'pairing' useEffect runs /complete-pair with the new JWT.
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center bg-ivory px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="font-serif text-[24px] font-medium tracking-tight text-ink">
            Veronum
          </Link>
          <div className="mt-2 font-mono uppercase tracking-[0.08em] text-[11px] text-ink-faded">
            Pair this Mac
          </div>
        </div>

        {/* Code badge — visible the whole time so the user can compare to
            what their menu bar shows. Renders as a small monospace pill. */}
        {code && (
          <div className="mb-6 flex items-center justify-center gap-2 text-[12px] text-ink-faded">
            <span className="font-mono uppercase tracking-[0.06em]">Code</span>
            <span className="font-mono px-3 py-1 rounded-full border border-ink/15 text-ink text-[13px] tracking-[0.18em]">
              {code}
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
          {view.kind === "loading" && (
            <p className="text-center text-ink-faded">Checking your sign-in&hellip;</p>
          )}

          {view.kind === "signed-out" && (
            <>
              <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
                {mode === "signin" ? "Sign in to pair" : "Create account to pair"}
              </h1>
              <p className="text-[14px] text-ink-faded mb-6">
                {mode === "signin"
                  ? "Email and password. After sign-in we link this Mac to your account."
                  : "Pick a password. No email confirmation — you'll be signed in immediately."}
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
                  className="w-full bg-slate-dark text-ivory rounded-full px-4 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
                >
                  {mode === "signin" ? "Sign in & pair" : "Create account & pair"}
                </button>
              </form>
              <p className="text-[13px] text-ink-faded mt-4 text-center">
                {mode === "signin" ? (
                  <>
                    No account yet?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="underline text-ink hover:opacity-70"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already signed up?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="underline text-ink hover:opacity-70"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </>
          )}


          {view.kind === "pairing" && (
            <p className="text-center text-ink-faded">Pairing&hellip;</p>
          )}

          {view.kind === "paired" && (
            <>
              <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
                Paired ✓
              </h1>
              <p className="text-[14px] text-ink-faded mb-4">
                {view.hostname ? (
                  <>
                    <span className="font-mono text-ink">{view.hostname}</span> is
                    now linked to your account.
                  </>
                ) : (
                  <>This Mac is now linked to your account.</>
                )}
              </p>
              <p className="text-[13px] text-ink-faded mb-6">
                You can close this tab. The Veronum Bridge menu-bar icon will turn
                on. Use any device&rsquo;s browser at{" "}
                <a href="/chat-app/" className="underline">
                  chat.thetoolswebsite.com
                </a>{" "}
                to start a session.
              </p>
              <a
                href={`veronum-bridge://paired?bridge_id=${encodeURIComponent(view.bridgeId)}&install_id=${encodeURIComponent(view.installId)}`}
                className="inline-flex items-center justify-center w-full bg-slate-dark text-ivory rounded-full px-4 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
              >
                Open Veronum Bridge
              </a>
            </>
          )}

          {view.kind === "error" && (
            <>
              <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
                Couldn&rsquo;t pair
              </h1>
              <p className="text-[14px] text-ink-faded mb-6 break-words">{view.message}</p>
              <button
                onClick={async () => {
                  // Re-check session first. If still signed in (the most
                  // common case after a transient FK / network error),
                  // retry /complete-pair instead of forcing the user
                  // through another magic-link email (which hits the
                  // Supabase free-tier 3-emails-per-hour rate limit).
                  const { data } = await supabase.auth.getSession();
                  if (data.session?.user?.id) {
                    setView({ kind: "pairing", userId: data.session.user.id });
                  } else {
                    setView({ kind: "signed-out" });
                  }
                }}
                className="w-full bg-slate-dark text-ivory rounded-full px-4 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition"
              >
                Try again
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-faded">
          Don&rsquo;t have Veronum Bridge installed?{" "}
          <a
            href="https://github.com/DylanWain/veronum-bridge/releases/latest/download/Veronum-Bridge.dmg"
            className="underline"
          >
            Download for Mac
          </a>
        </p>
      </div>
    </main>
  );
}
