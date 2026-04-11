// Tools AI — Billing cost computation.
//
// For v1 we use flat per-request estimates matching the existing chat.ts
// trackUsage logic (3¢ for GPT/Claude/Grok, 2¢ for Perplexity, 1¢ for
// Gemini), doubled for two-pass orchestration. Real token-based billing
// is a future improvement that requires capturing upstream usage metadata
// from each streaming provider.

import { env } from './env';

export type ModelId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

// Per-model per-request cost (cents), PRE two-pass doubling.
// These match MODEL_COST_PER_REQUEST_CENTS in the existing chat.ts.
const PER_REQUEST_COST_CENTS: Record<ModelId, number> = {
  chatgpt: 3,
  claude: 3,
  gemini: 1,
  grok: 3,
  perplexity: 2,
};

/**
 * Compute the raw upstream cost for a /api/v1/chat call that uses the
 * given models in two-pass orchestration.
 *
 * Total = sum(per-model cost) × 2 passes
 *
 * @param models — models actually requested in this call
 * @returns raw cost in integer cents
 */
export function computeRawCostCents(models: ModelId[]): number {
  const perPass = models.reduce((sum, m) => sum + (PER_REQUEST_COST_CENTS[m] ?? 2), 0);
  return Math.max(1, perPass * 2);
}

export interface BillingDecision {
  /** Cents we'll bill the user for this call (raw × multiplier). */
  chargedCents: number;
  /** Value to report to the Stripe meter (0 = skip meter report). */
  meterEventValue: number;
  /** UsageEventKind for the usage_events log row. */
  kind:
    | 'usage_based'
    | 'included_in_chad'
    | 'included_in_trial'
    | 'errored_not_charged'
    | 'hard_limit_hit';
}

/**
 * Given a user tier and the raw cost of this call, decide:
 *   - chargedCents: how much to add to user.period_billed_cents
 *   - meterEventValue: what to send to Stripe's meter (0 = no event)
 *   - kind: for audit logging
 *
 * Chad threshold straddling: if this call bridges the $15 mark, only the
 * overage portion is charged. Example: consumed=1490, call=20 → 10¢ stays
 * free (under threshold), 10¢ becomes overage and gets metered.
 */
export function computeBilling(
  tier: string,
  rawCents: number,
  oldPeriodConsumedCents: number,
): BillingDecision {
  const cfg = {
    chadIncludedCents: env.CHAD_INCLUDED_CENTS(),
    chadOverageMultiplier: env.CHAD_OVERAGE_MULTIPLIER(),
    paygMultiplier: env.PAYG_MULTIPLIER(),
  };

  switch (tier) {
    case 'trial':
      // Free for the user, but we still count raw cost against the trial's
      // allowance so a trial can't burn unlimited API cost.
      return { chargedCents: 0, meterEventValue: 0, kind: 'included_in_trial' };

    case 'chad': {
      const newConsumed = oldPeriodConsumedCents + rawCents;
      const threshold = cfg.chadIncludedCents;
      if (newConsumed <= threshold) {
        return { chargedCents: 0, meterEventValue: 0, kind: 'included_in_chad' };
      }
      const overageRaw = Math.max(
        0,
        newConsumed - Math.max(oldPeriodConsumedCents, threshold),
      );
      return {
        chargedCents: overageRaw * cfg.chadOverageMultiplier,
        meterEventValue: overageRaw,
        kind: 'usage_based',
      };
    }

    case 'payg':
      return {
        chargedCents: rawCents * cfg.paygMultiplier,
        meterEventValue: rawCents,
        kind: 'usage_based',
      };

    default:
      return { chargedCents: 0, meterEventValue: 0, kind: 'included_in_trial' };
  }
}
