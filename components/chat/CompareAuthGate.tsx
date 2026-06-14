"use client";

/**
 * CompareAuthGate — sign-in / sign-up overlay for /compare.
 *
 * Primary flow: email + password (signInWithPassword / signUp).
 *   Works identically in the browser and inside Veronum Desktop —
 *   no redirect, no cross-origin cookie issue, no Supabase dashboard
 *   config (except `Enable email confirmations = OFF` so signup
 *   returns a session immediately rather than requiring an email
 *   click). Single source of truth, simplest UX.
 *
 * Fallbacks (kept for users who don't want a password or need to
 * reset):
 *   - Magic link: traditional emailed sign-in link. Works in browser;
 *     in desktop the link redirects via /auth/desktop-handoff to the
 *     veronum:// custom scheme (needs Supabase URL whitelist + the
 *     user to have opened Veronum.app at least once so Launch
 *     Services knows about the scheme).
 *   - 6-digit code: Supabase embeds a numeric token in the same magic
 *     link email; pasting it here calls verifyOtp and signs in
 *     in-place. Works EVERYWHERE with zero config. Lifeline.
 *
 * All flows write the same session under storageKey:"veronum-auth"
 * so /chat and /compare share auth state regardless of how the user
 * got signed in.
 */

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { FREE_TRIAL_CENTS } from "@/lib/compare/billing";
import { isDesktop, onDesktopAuthCallback } from "@/lib/desktop";

const DESKTOP_HANDOFF_ORIGIN = "https://thetoolswebsite.com";

type Mode = "password" | "magic" | "code-after-magic";

export function CompareAuthGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("password");
  // Code paste flow — used after a magic link was sent.
  const [code, setCode] = useState("");
  // Track sign-up vs sign-in intent for the password form. Toggled
  // by the user; on sign-in failure we auto-flip to sign-up if the
  // error suggests "user doesn't exist," giving a smoother UX.
  const [intent, setIntent] = useState<"sign-in" | "sign-up">("sign-in");
  const [inDesktop, setInDesktop] = useState(false);

  function validEmail(): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase());
  }

  /** Primary path. signInWithPassword for existing accounts, signUp
   *  for new ones. With email confirmations disabled in Supabase,
   *  signUp returns a session synchronously and onAuthStateChange
   *  fires SIGNED_IN — gate dismisses without any email round-trip. */
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validEmail()) { setErr("Enter a valid email."); return; }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const supabase = getBrowserSupabase();
      const target = email.trim().toLowerCase();
      if (intent === "sign-up") {
        const { error, data } = await supabase.auth.signUp({
          email: target,
          password,
        });
        if (error) {
          // If the account already exists Supabase returns
          // "User already registered" — flip to sign-in mode and
          // retry transparently.
          if (/already/i.test(error.message)) {
            setIntent("sign-in");
            const { error: e2 } = await supabase.auth.signInWithPassword({
              email: target,
              password,
            });
            if (e2) throw e2;
          } else {
            throw error;
          }
        } else if (!data.session) {
          // Signup succeeded but no session — email confirmations are
          // ON in the Supabase project. Tell the user to disable it
          // (one toggle in the dashboard) or to check their email.
          setErr(
            "Account created — check your email to confirm, OR ask the maintainer to disable Auth → Email → Enable email confirmations in Supabase.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: target,
          password,
        });
        if (error) {
          // Common case: typo'd password OR the user hasn't signed up
          // yet. Distinguish by checking the message. Supabase returns
          // "Invalid login credentials" for both, so just give one
          // friendly nudge.
          if (/invalid login/i.test(error.message)) {
            throw new Error("That email + password didn't match. New here? Hit 'Create account'.");
          }
          throw error;
        }
      }
      // The onAuthStateChange listener below catches SIGNED_IN and
      // calls onSignedIn() — no need to do it here.
    } catch (e) {
      setErr((e as Error).message || "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Magic-link fallback. Same logic as before — picks a redirect
   *  target based on whether we're in the desktop wrapper. */
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validEmail()) { setErr("Enter a valid email."); return; }
    setErr(null);
    setBusy(true);
    try {
      const supabase = getBrowserSupabase();
      const redirect = typeof window === "undefined"
        ? undefined
        : inDesktop
          ? `${DESKTOP_HANDOFF_ORIGIN}/auth/desktop-handoff`
          : `${window.location.origin}/app`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;
      setMode("code-after-magic");
    } catch (e) {
      setErr((e as Error).message || "Failed to send magic link.");
    } finally {
      setBusy(false);
    }
  }

  /** Verify the 6-digit code from the magic-link email. */
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const token = code.trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(token)) {
      setErr("Enter the 6-digit code from the email.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) throw error;
    } catch (e) {
      setErr((e as Error).message || "That code didn't work. Request a fresh email.");
    } finally {
      setBusy(false);
    }
  }

  // Watch for sign-in. Same effect as before, plus the desktop
  // veronum:// IPC callback listener so magic-link users on desktop
  // get signed in when the deep link round-trips.
  useEffect(() => {
    setInDesktop(isDesktop());
    const supabase = getBrowserSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user?.id) {
        onSignedIn();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) onSignedIn();
    });
    const unsub = onDesktopAuthCallback(async (url) => {
      try {
        const u = new URL(url);
        const access_token = u.searchParams.get("access_token");
        const refresh_token = u.searchParams.get("refresh_token");
        if (!access_token || !refresh_token) return;
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) setErr(error.message);
      } catch (e) {
        setErr((e as Error).message || "Couldn't read the sign-in link.");
      }
    });
    return () => {
      sub.subscription.unsubscribe();
      unsub();
    };
  }, [onSignedIn]);

  return (
    <div className="w-full max-w-[420px] mx-auto rounded-2xl border border-white/10 bg-[#161616] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <h2 className="text-white font-serif text-[22px] mb-1.5">
        {intent === "sign-up" ? "Create your Veronum account" : "Sign in to Veronum"}
      </h2>
      <p className="text-white/55 text-[13px] leading-[1.5] mb-5">
        Every account starts with <span className="text-white font-medium">{FREE_TRIAL_CENTS}¢ of free use</span> across every model. After that, pick a plan — $25/mo flat or pay-as-you-go.
      </p>

      {mode === "password" && (
        <form onSubmit={handlePassword} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2.5 text-[14px] text-white/95 placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            disabled={busy}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={intent === "sign-up" ? "Choose a password (8+ chars)" : "Password"}
            autoComplete={intent === "sign-up" ? "new-password" : "current-password"}
            className="bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2.5 text-[14px] text-white/95 placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            disabled={busy}
            minLength={8}
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2.5 rounded-md text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-50"
          >
            {busy
              ? (intent === "sign-up" ? "Creating account…" : "Signing in…")
              : (intent === "sign-up" ? "Create account" : "Sign in")}
          </button>
          {err && (
            <p className="text-[12px] text-red-300/90 mt-1">{err}</p>
          )}
          <div className="flex items-center justify-between text-[12px] text-white/45 mt-1">
            <button
              type="button"
              onClick={() => { setIntent(intent === "sign-up" ? "sign-in" : "sign-up"); setErr(null); }}
              className="hover:text-white/75 underline underline-offset-2"
            >
              {intent === "sign-up" ? "Have an account? Sign in" : "New here? Create account"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("magic"); setErr(null); }}
              className="hover:text-white/75 underline underline-offset-2"
            >
              Email me a link instead
            </button>
          </div>
        </form>
      )}

      {mode === "magic" && (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2.5 text-[14px] text-white/95 placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2.5 rounded-md text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-50"
          >
            {busy ? "Sending magic link…" : "Send magic link"}
          </button>
          {err && <p className="text-[12px] text-red-300/90 mt-1">{err}</p>}
          <button
            type="button"
            onClick={() => { setMode("password"); setErr(null); }}
            className="text-[12px] text-white/45 hover:text-white/75 underline underline-offset-2 self-start"
          >
            Use password instead
          </button>
        </form>
      )}

      {mode === "code-after-magic" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-[#7eb472]/30 bg-[#7eb472]/[0.06] px-4 py-3 text-[13px] text-[#a8d49b]">
            <strong className="block mb-0.5">Check your email.</strong>
            {inDesktop ? (
              <>We sent a one-time code to <span className="font-mono">{email}</span>. Paste it below.</>
            ) : (
              <>We sent a magic link to <span className="font-mono">{email}</span>. Click it OR paste the 6-digit code below.</>
            )}
          </div>
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2.5 text-[15px] font-mono tracking-[0.3em] text-center text-white/95 placeholder:text-white/30 placeholder:tracking-normal placeholder:font-sans outline-none focus:border-white/30 transition-colors"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="px-4 py-2.5 rounded-md text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40"
            >
              {busy ? "Verifying…" : "Sign in with code"}
            </button>
            {err && <p className="text-[12px] text-red-300/90 mt-1">{err}</p>}
          </form>
          <button
            type="button"
            onClick={() => { setMode("password"); setCode(""); setErr(null); }}
            className="text-[12px] text-white/45 hover:text-white/75 underline underline-offset-2 self-start"
          >
            Back to password sign-in
          </button>
        </div>
      )}
    </div>
  );
}
