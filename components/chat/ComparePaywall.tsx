"use client";

/**
 * ComparePaywall — over-quota overlay.
 *
 * Shown when /api/compare returns 402 (free user has used >= 10¢ and
 * has no active subscription). Offers the same two plans the rest of
 * the product surfaces: $25/mo flat (chad) via Stripe Payment Link, or
 * pay-as-you-go (3×) via the JWT-gated Supabase Edge Function.
 *
 * Both URLs match the ones already wired in app/chat/page.tsx — single
 * source of truth for the checkout flow. Subscribers come back here
 * via the Stripe webhook, which flips their `subscription_status` to
 * 'active' and the next /api/compare call clears the gate.
 */

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

const STRIPE_CHECKOUT_BASE = "https://buy.stripe.com/fZu28tb3x9aufwJeLt1sQ00";
const PAYG_CHECKOUT_URL =
  "https://synpjcammfjebwsmtfpz.supabase.co/functions/v1/veronum-payg-checkout";

type Props = {
  consumedCents: number;
  freeTrialCents: number;
  userId: string;
  /** Called after a successful Stripe webhook bounces back — the
   *  parent re-runs the previously blocked Send. */
  onDismiss?: () => void;
};

export function ComparePaywall({
  consumedCents, freeTrialCents, userId, onDismiss,
}: Props) {
  const [busy, setBusy] = useState<"payg" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startPayg() {
    if (busy) return;
    setErr(null);
    setBusy("payg");
    try {
      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setErr("Sign in again to subscribe.");
        return;
      }
      const res = await fetch(PAYG_CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.checkoutUrl) {
        setErr(body.detail || body.error || `Couldn't start PAYG checkout (HTTP ${res.status}).`);
        return;
      }
      window.location.href = body.checkoutUrl;
    } catch (e) {
      setErr((e as Error).message || "Network error starting PAYG checkout.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-[480px] mx-auto rounded-2xl border border-white/10 bg-[#161616] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <h2 className="text-white font-serif text-[22px] mb-1.5">
        You&rsquo;ve used your free trial
      </h2>
      <p className="text-white/55 text-[13.5px] leading-[1.5] mb-3">
        Every account gets {freeTrialCents}¢ of free use to try /compare across every model. Pick a plan below to keep going — cancel anytime.
      </p>
      <p className="text-[12.5px] text-white/40 mb-6 font-mono">
        Used: <span className="text-white/85">${(consumedCents / 100).toFixed(2)}</span> /
        {" "}<span className="text-white/85">${(freeTrialCents / 100).toFixed(2)}</span>
      </p>

      <div className="space-y-3">
        <a
          href={`${STRIPE_CHECKOUT_BASE}?client_reference_id=${encodeURIComponent(userId)}`}
          className="block rounded-xl border border-[#d97757]/40 bg-[#d97757]/[0.06] hover:border-[#d97757] transition p-4"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[17px] font-medium text-white">
              Subscribe
            </span>
            <span className="font-mono text-[13.5px] text-white">$25/mo</span>
          </div>
          <p className="text-[12.5px] text-white/55 mt-1">
            Includes $25 of usage at 1× rate. Overage billed at 2×. Cancel anytime.
          </p>
          <p className="text-[12px] text-[#d97757] mt-3 underline">Choose subscribe →</p>
        </a>

        <button
          type="button"
          onClick={startPayg}
          disabled={busy === "payg"}
          className="block w-full text-left rounded-xl border border-white/10 bg-[#1f1f1f] hover:border-white/30 transition p-4 disabled:opacity-50"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[17px] font-medium text-white">
              Pay as you go
            </span>
            <span className="font-mono text-[13.5px] text-white">3× per use</span>
          </div>
          <p className="text-[12.5px] text-white/55 mt-1">
            No monthly fee. Card on file, billed only for what you use. Cheaper if your usage is light.
          </p>
          <p className="text-[12px] text-white mt-3 underline">
            {busy === "payg" ? "Starting checkout…" : "Choose pay-as-you-go →"}
          </p>
        </button>
      </div>

      {err && (
        <p className="text-[12px] text-red-300/90 mt-4">{err}</p>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 text-[12px] text-white/35 hover:text-white/85 transition"
        >
          Hide for now (re-check on next send)
        </button>
      )}
    </div>
  );
}
