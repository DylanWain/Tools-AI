"use client";

/**
 * CompareAuthGate — sign-in / sign-up overlay for /compare.
 *
 * Mirrors the magic-link flow already used by /chat: a single email
 * field, sent to Supabase Auth's `signInWithOtp`, which emails a
 * one-tap link back. Reusing the same pattern keeps the user's auth
 * state aligned across /chat and /compare (same persisted session
 * under `storageKey: "veronum-auth"`).
 *
 * Rendered as a centered card inside the empty-state surface — the
 * grids + composer never render until the user is signed in, because
 * /api/compare 401s anonymous requests. Once auth is live the parent
 * component flips back to the normal compose view.
 */

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { FREE_TRIAL_CENTS } from "@/lib/compare/billing";

export function CompareAuthGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      // Redirect to "/" directly (not "/compare" → 308 → "/") so the
      // browser preserves the access_token URL fragment without ever
      // bouncing through a redirect — fragments survive 308s in most
      // browsers but it's fragile, so avoid it.
      const redirect = typeof window !== "undefined"
        ? `${window.location.origin}/`
        : undefined;
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

  // Watch for sign-in (magic-link return). When the session flips from
  // null → present we tell the parent to drop this overlay. Also check
  // the persisted session at mount — if the user is already signed in
  // (reloaded after auth landed elsewhere) we drop the gate immediately
  // rather than wait for an event that won't fire.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user?.id) {
        onSignedIn();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) onSignedIn();
    });
    return () => sub.subscription.unsubscribe();
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
        <div className="rounded-lg border border-[#7eb472]/30 bg-[#7eb472]/[0.06] px-4 py-3 text-[13px] text-[#a8d49b]">
          <strong className="block mb-0.5">Check your email.</strong>
          We sent a magic link to <span className="font-mono">{email}</span>. Click it and you&rsquo;ll land right back here, signed in.
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

