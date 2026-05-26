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
  | { kind: "signed-out" }           // need magic link
  | { kind: "magic-link-sent"; email: string }
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

  // ─── Read pair code from URL once on mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URL(window.location.href).searchParams.get("code") || "";
    // Normalize: trim, uppercase. The daemon always emits A-Z2-9 (no 0/O/1/I).
    const normalized = raw.trim().toUpperCase();
    setCode(normalized);
  }, []);

  // ─── Decide initial flow: signed-in or sign-in-needed ───────────────────
  useEffect(() => {
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
      } else {
        setView({ kind: "signed-out" });
      }
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
          setView({
            kind: "error",
            message:
              body.error === "invalid_or_expired_pair_code"
                ? "That pair code is invalid or has expired. Try again from the Bridge app — it'll mint a fresh one."
                : body.error || "Failed to pair. Please try again.",
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

  // ─── Magic link submit ─────────────────────────────────────────────────
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      setView({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    // Preserve the pair code in the redirect URL so when the user clicks
    // the link in their inbox they land back here mid-pair.
    const redirectTo = `${window.location.origin}/pair-bridge?code=${encodeURIComponent(code)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setView({ kind: "error", message: error.message });
      return;
    }
    setView({ kind: "magic-link-sent", email: trimmed });
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
                Sign in to pair
              </h1>
              <p className="text-[14px] text-ink-faded mb-6">
                We&rsquo;ll email you a one-time link. Click it to come back here and
                confirm the bridge.
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
            </>
          )}

          {view.kind === "magic-link-sent" && (
            <>
              <h1 className="font-serif text-[22px] font-medium text-ink mb-2">
                Check your email
              </h1>
              <p className="text-[14px] text-ink-faded">
                Sent a sign-in link to{" "}
                <span className="font-mono text-ink">{view.email}</span>. Click the
                link to come back here and finish pairing.
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
                <Link href="/chat" className="underline">
                  chat.thetoolswebsite.com
                </Link>{" "}
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
              <p className="text-[14px] text-ink-faded mb-6">{view.message}</p>
              <button
                onClick={() => setView({ kind: "signed-out" })}
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
