"use client";

/**
 * ComparePaywall — over-quota overlay.
 *
 * Shown when /api/compare returns 402 (free user has used >= 10¢ and
 * has no active subscription). Three paid paths:
 *
 *   Subscribe ($25/mo) → POST /api/checkout         {plan:'subscribe'} → Stripe Checkout
 *   Pay as you go (3×) → POST /api/checkout         {plan:'payg'}      → Stripe Checkout
 *   Wallet (prepay)    → POST /api/checkout/wallet  {amount_cents}     → Stripe Checkout
 *
 * Subscribe + PAYG come back here via the existing thetoolswebsite.com
 * webhook, which flips `subscription_status='active'` and the next
 * /api/compare call clears the gate.
 *
 * Wallet credits land via the Supabase veronum-stripe webhook
 * (handleWalletTopUpCompleted) — separate function, separate endpoint.
 * NOTE: today the wallet balance is visible only in the desktop app
 * Settings → Billing. Wiring /api/compare to debit the wallet on
 * website usage is a follow-up; for now wallet users keep their
 * existing free / subscribe / PAYG quota on the website and burn down
 * their wallet via the desktop app.
 */

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type Props = {
  consumedCents: number;
  freeTrialCents: number;
  userId: string;
  /** Called when the user dismisses the modal (re-check on next send). */
  onDismiss?: () => void;
};

type Plan = "subscribe" | "payg" | "wallet";

/** Top-up presets shown on the wallet card. Module-scoped so the
 *  buttons get a stable reference across renders. */
const WALLET_PRESETS_CENTS = [500, 1000, 2500, 10000] as const;
const DEFAULT_WALLET_TOPUP_CENTS = 1000;

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function ComparePaywall({
  consumedCents, freeTrialCents, userId, onDismiss,
}: Props) {
  // `userId` is held in case we want to surface it in error messages
  // for support, but the actual user_id used by the checkout endpoints
  // is read from the JWT server-side.
  void userId;

  const [busy, setBusy] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [walletCents, setWalletCents] = useState<number>(
    DEFAULT_WALLET_TOPUP_CENTS,
  );

  async function startCheckout(plan: Plan) {
    if (busy) return;
    setErr(null);
    setBusy(plan);
    try {
      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setErr("Sign in again to continue.");
        setBusy(null);
        return;
      }
      const url = plan === "wallet"
        ? "/api/checkout/wallet"
        : "/api/checkout";
      const body = plan === "wallet"
        ? { amount_cents: walletCents }
        : { plan };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.url) {
        setErr(
          json.detail ||
          json.error ||
          `Couldn't start checkout (HTTP ${res.status}).`
        );
        setBusy(null);
        return;
      }
      // Full-page redirect to Stripe-hosted Checkout.
      window.location.href = json.url;
    } catch (e) {
      setErr((e as Error).message || "Network error starting checkout.");
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="w-full max-w-[520px] mx-auto rounded-2xl border border-white/10 bg-[#161616] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <h2 className="text-white font-serif text-[22px] mb-1.5">
        You&rsquo;ve used your free trial
      </h2>
      <p className="text-white/55 text-[13.5px] leading-[1.5] mb-3">
        Every account gets {freeTrialCents}¢ of free use to try /compare
        across every model. Pick what fits — cancel anytime.
      </p>
      <p className="text-[12.5px] text-white/40 mb-6 font-mono">
        Used: <span className="text-white/85">${(consumedCents / 100).toFixed(2)}</span> /
        {" "}<span className="text-white/85">${(freeTrialCents / 100).toFixed(2)}</span>
      </p>

      <div className="space-y-3">
        {/* Card 1 — Subscribe (recommended) */}
        <button
          type="button"
          onClick={() => startCheckout("subscribe")}
          disabled={disabled}
          className="block w-full text-left rounded-xl border border-[#d97757]/40 bg-[#d97757]/[0.06] hover:border-[#d97757] transition p-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <p className="text-[12px] text-[#d97757] mt-3 underline">
            {busy === "subscribe" ? "Starting checkout…" : "Choose subscribe →"}
          </p>
        </button>

        {/* Card 2 — Pay as you go */}
        <button
          type="button"
          onClick={() => startCheckout("payg")}
          disabled={disabled}
          className="block w-full text-left rounded-xl border border-white/10 bg-[#1f1f1f] hover:border-white/30 transition p-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[17px] font-medium text-white">
              Pay as you go
            </span>
            <span className="font-mono text-[13.5px] text-white">3× per use</span>
          </div>
          <p className="text-[12.5px] text-white/55 mt-1">
            No monthly fee. Card on file, billed only for what you use.
          </p>
          <p className="text-[12px] text-white mt-3 underline">
            {busy === "payg" ? "Starting checkout…" : "Choose pay-as-you-go →"}
          </p>
        </button>

        {/* Card 3 — Prepaid wallet */}
        <div className="block w-full text-left rounded-xl border border-white/10 bg-[#1f1f1f] hover:border-white/30 transition p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[17px] font-medium text-white">
              Wallet
            </span>
            <span className="font-mono text-[13.5px] text-white">prepay from $5</span>
          </div>
          <p className="text-[12.5px] text-white/55 mt-1">
            Add funds up front. Spending stops at $0 — never a surprise bill. Balance never expires.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Top-up amount">
            {WALLET_PRESETS_CENTS.map((cents) => {
              const active = walletCents === cents;
              return (
                <button
                  key={cents}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setWalletCents(cents)}
                  disabled={disabled}
                  className={
                    "px-2.5 py-1 rounded-full text-[12px] font-mono border transition " +
                    (active
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-white/70 border-white/15 hover:border-white/40")
                  }
                >
                  {formatUsd(cents)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => startCheckout("wallet")}
            disabled={disabled}
            className="mt-3 text-[12px] text-white underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "wallet"
              ? "Starting checkout…"
              : `Add ${formatUsd(walletCents)} & start →`}
          </button>
        </div>
      </div>

      {err && (
        <p className="text-[12px] text-red-300/90 mt-4 leading-[1.5]">{err}</p>
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
