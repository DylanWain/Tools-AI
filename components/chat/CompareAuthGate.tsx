"use client";

/**
 * CompareAuthGate — sign-in / sign-up overlay for /compare.
 *
 * Two flows from a single Supabase signInWithOtp call:
 *
 *   1. Magic link (browser default) — the link Supabase emails opens
 *      in the user's default browser. They land on / with an access
 *      token in the URL fragment, the supabase client picks it up,
 *      and onAuthStateChange fires SIGNED_IN.
 *
 *   2. 6-digit code (desktop fallback) — Supabase ALSO embeds a
 *      numeric token in the same email. In the Veronum Desktop wrapper
 *      the magic link can't reach the Electron-rendered origin
 *      (127.0.0.1:27500), so the user pastes the 6-digit code instead.
 *      verifyOtp completes auth in-place. Session persists via the
 *      same storageKey:"veronum-auth", so reloading the desktop
 *      keeps them signed in.
 *
 * Both flows write the same session under storageKey:"veronum-auth"
 * — /chat and /compare share auth state, and the desktop session is
 * indistinguishable from a browser session downstream.
 */

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { FREE_TRIAL_CENTS } from "@/lib/compare/billing";
import { isDesktop, onDesktopAuthCallback } from "@/lib/desktop";

const DESKTOP_HANDOFF_ORIGIN = "https://thetoolswebsite.com";

export function CompareAuthGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Code paste flow — desktop wrapper uses this because the magic
  // link can't reach the Electron renderer.
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  // Mirror isDesktop in state so it's safe across SSR (always false
  // server-side, flipped in the same mount effect we already run).
  const [inDesktop, setInDesktop] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const target = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      setErr("Enter a valid email.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const supabase = getBrowserSupabase();
      // Two redirect targets depending on where this is rendered:
      //
      //   Desktop: send Supabase to the desktop-handoff page on the
      //     live site. That page extracts the access_token from the
      //     URL hash and bounces to veronum://auth?...  — macOS
      //     reopens Veronum.app, the main process IPCs the URL into
      //     the renderer, and we sign the user in via setSession
      //     in the auth-callback effect below.
      //
      //   Browser: same behavior we had before — redirect back to
      //     the current origin's root so detectSessionInUrl picks up
      //     the token from the fragment without bouncing through a
      //     308 (fragments are fragile across redirects).
      const inDesktop = isDesktop();
      const redirect = typeof window === "undefined"
        ? undefined
        : inDesktop
          ? `${DESKTOP_HANDOFF_ORIGIN}/auth/desktop-handoff`
          : `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOtp({
        email: target,
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;
      setSent(true);
      // Once the magic link is clicked, the redirect lands back on /
      // with the access_token in the URL fragment; detectSessionInUrl
      // (configured in lib/supabase.ts) parses it. The parent
      // component listens for auth-state changes and fires onSignedIn.
    } catch (e) {
      setErr((e as Error).message || "Failed to send magic link.");
    } finally {
      setBusy(false);
    }
  }

  /** Verify the 6-digit code Supabase embedded in the email. Works
   *  anywhere — desktop OR browser — and signs the user in on the
   *  current origin without any redirect dance. */
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (verifying) return;
    const target = email.trim().toLowerCase();
    const token = code.trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(token)) {
      setErr("Enter the 6-digit code from the email.");
      return;
    }
    setErr(null);
    setVerifying(true);
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.verifyOtp({
        email: target,
        token,
        type: "email",
      });
      if (error) throw error;
      // verifyOtp triggers SIGNED_IN through onAuthStateChange below,
      // which drops the gate. No need to set state here.
    } catch (e) {
      setErr((e as Error).message || "That code didn't work. Try again or request a fresh email.");
      setVerifying(false);
    }
  }

  // Watch for sign-in (magic-link return OR verifyOtp). When the
  // session flips from null → present we tell the parent to drop
  // this overlay. Also check the persisted session at mount — if the
  // user is already signed in (reloaded after auth landed elsewhere)
  // we drop the gate immediately rather than wait for an event that
  // won't fire.
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
    // Listen for the deep-link auth callback from the desktop wrapper.
    // When the user clicks the magic link in their email, the browser
    // lands on /auth/desktop-handoff which redirects to veronum://auth?...
    // macOS opens Veronum.app, the main process IPCs us the URL — we
    // parse the tokens and complete sign-in in place. In browser mode
    // this subscription is a no-op (the lib returns an empty unsub).
    const unsub = onDesktopAuthCallback(async (url) => {
      try {
        // veronum://auth?access_token=...&refresh_token=...
        const u = new URL(url);
        const access_token = u.searchParams.get("access_token");
        const refresh_token = u.searchParams.get("refresh_token");
        if (!access_token || !refresh_token) return;
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          setErr(error.message);
        }
        // The onAuthStateChange above fires SIGNED_IN, which calls
        // onSignedIn() and dismisses the gate. No need to do it here.
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
        Sign in to compare models
      </h2>
      <p className="text-white/55 text-[13px] leading-[1.5] mb-5">
        Every account starts with <span className="text-white font-medium">{FREE_TRIAL_CENTS}¢ of free use</span> across every model. After that, pick a plan — $25/mo flat or pay-as-you-go.
      </p>

      {sent ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-[#7eb472]/30 bg-[#7eb472]/[0.06] px-4 py-3 text-[13px] text-[#a8d49b]">
            <strong className="block mb-0.5">Check your email.</strong>
            {inDesktop ? (
              <>
                We sent a one-time code to <span className="font-mono">{email}</span>. Paste it below — the email also contains a magic link, but use the code in the desktop app.
              </>
            ) : (
              <>
                We sent a magic link to <span className="font-mono">{email}</span>. Click it and you&rsquo;ll land right back here, signed in.
              </>
            )}
          </div>
          {/* Code-paste form. Always rendered so browser users who
              prefer pasting (or whose email link is blocked) have the
              option, but only auto-focused in desktop mode. */}
          <form onSubmit={verifyCode} className="flex flex-col gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              autoFocus={inDesktop}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2.5 text-[15px] font-mono tracking-[0.3em] text-center text-white/95 placeholder:text-white/30 placeholder:tracking-normal placeholder:font-sans outline-none focus:border-white/30 transition-colors"
              disabled={verifying}
            />
            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="px-4 py-2.5 rounded-md text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40"
            >
              {verifying ? "Verifying…" : "Sign in with code"}
            </button>
            {err && (
              <p className="text-[12px] text-red-300/90 mt-1">{err}</p>
            )}
          </form>
          <button
            type="button"
            onClick={() => { setSent(false); setCode(""); setErr(null); }}
            className="text-[11.5px] text-white/45 hover:text-white/75 underline underline-offset-2 self-start"
          >
            Wrong email? Start over.
          </button>
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          {err && (
            <p className="text-[12px] text-red-300/90 mt-1">{err}</p>
          )}
          <p className="text-[11.5px] text-white/35 leading-[1.5] mt-1">
            No password to remember — we email you a one-tap sign-in link.
          </p>
        </form>
      )}
    </div>
  );
}

