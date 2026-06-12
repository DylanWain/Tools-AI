/**
 * Per-model pricing + cost estimation.
 *
 * Stripe billing flow:
 *   1. /api/compare streams a response, counting input + output tokens
 *      using a 1-token-per-4-chars heuristic (close enough for billing).
 *   2. When the stream finishes (or errors mid-stream), the route looks
 *      up the model's price here, computes the raw API cost in cents,
 *      and increments the user's period_consumed_cents counter.
 *   3. /api/cron/stripe-meter-flush drains that counter into Stripe
 *      meter events on a 10-min schedule. Subscribers ($25/mo "chad")
 *      pay 2× on overage past $25 included; PAYG users pay 3× flat.
 *
 * Prices are in CENTS per 1M tokens — easy to read against published
 * pricing pages (which use $/1M tokens) and easy to multiply by token
 * count without floating-point drift (we keep everything as cents).
 *
 * NOTE: prices drift. The numbers below are best-effort accurate as of
 * 2026-Q2 against each provider's public pricing page. Verify before
 * billing real money. If a price isn't set the fallback (1¢/1M in, 5¢/1M
 * out) keeps the gate functional but undercounts — error on the side of
 * "give the user more" rather than "overcharge."
 */

import { findModel } from "./models";

// Cents per million tokens. Cheap models like gpt-4o-mini are <100;
// flagships like Opus 4 are 1500-7500. The spread is two orders of
// magnitude — accurate per-model pricing matters a lot for billing.
export type ModelPrice = {
  centsPerMTokIn: number;
  centsPerMTokOut: number;
};

const FALLBACK: ModelPrice = { centsPerMTokIn: 100, centsPerMTokOut: 500 };

/** Keyed by the registry's stable `id`, not the upstream model string —
 *  so renaming the upstream model (e.g. "gpt-4o" → "gpt-4o-2024-11-20")
 *  in models.ts doesn't break the price lookup here. */
const PRICES: Record<string, ModelPrice> = {
  // OpenAI — https://openai.com/api/pricing
  // 5.x prices estimated against the 4.x → 5.x ladder; verify before billing.
  "gpt-5.5":       { centsPerMTokIn: 500,  centsPerMTokOut: 2500 },
  "gpt-5.4":       { centsPerMTokIn: 250,  centsPerMTokOut: 1000 },
  "gpt-5.4-mini":  { centsPerMTokIn: 50,   centsPerMTokOut: 200 },
  "gpt-5.4-nano":  { centsPerMTokIn: 15,   centsPerMTokOut: 60 },
  "gpt-4o":        { centsPerMTokIn: 250,  centsPerMTokOut: 1000 },
  "gpt-4o-mini":   { centsPerMTokIn: 15,   centsPerMTokOut: 60 },
  "gpt-4-turbo":   { centsPerMTokIn: 1000, centsPerMTokOut: 3000 },
  "gpt-4.1":       { centsPerMTokIn: 200,  centsPerMTokOut: 800 },
  "o1-mini":       { centsPerMTokIn: 110,  centsPerMTokOut: 440 },
  "o3-mini":       { centsPerMTokIn: 110,  centsPerMTokOut: 440 },

  // Anthropic — https://docs.anthropic.com/en/docs/about-claude/pricing
  // 4.6/4.8/Fable 5 prices confirmed against the public pricing table.
  "claude-fable-5":      { centsPerMTokIn: 1000, centsPerMTokOut: 5000 },
  "claude-opus-4-8":     { centsPerMTokIn: 500,  centsPerMTokOut: 2500 },
  "claude-sonnet-4-6":   { centsPerMTokIn: 300,  centsPerMTokOut: 1500 },
  "claude-sonnet-4-5":   { centsPerMTokIn: 300,  centsPerMTokOut: 1500 },
  "claude-opus-4-1":     { centsPerMTokIn: 1500, centsPerMTokOut: 7500 },
  "claude-haiku-4-5":    { centsPerMTokIn: 100,  centsPerMTokOut: 500 },
  "claude-sonnet":       { centsPerMTokIn: 300,  centsPerMTokOut: 1500 }, // 3.5 Sonnet, kept for compat

  // Perplexity — https://docs.perplexity.ai/guides/pricing
  "perplexity-sonar":           { centsPerMTokIn: 100, centsPerMTokOut: 100 },
  "perplexity-sonar-pro":       { centsPerMTokIn: 300, centsPerMTokOut: 1500 },
  "perplexity-sonar-reasoning": { centsPerMTokIn: 100, centsPerMTokOut: 500 },

  // Gemini — https://ai.google.dev/pricing
  // Gemini 3 prices estimated against the 2.5 baseline; verify before billing.
  "gemini-3-5-flash": { centsPerMTokIn: 50,  centsPerMTokOut: 400 },
  "gemini-3-1-pro":   { centsPerMTokIn: 200, centsPerMTokOut: 1500 },
  "gemini-flash":     { centsPerMTokIn: 30,  centsPerMTokOut: 250 },
  "gemini-pro":       { centsPerMTokIn: 125, centsPerMTokOut: 1000 },

  // xAI — https://docs.x.ai/docs/models
  "grok-4-3":       { centsPerMTokIn: 500, centsPerMTokOut: 1500 },
  "grok-4":         { centsPerMTokIn: 500, centsPerMTokOut: 1500 },
  "grok-3":         { centsPerMTokIn: 300, centsPerMTokOut: 1500 },

  // DeepSeek — https://api-docs.deepseek.com/quick_start/pricing
  // Historically the cheapest frontier provider; estimate conservatively.
  "deepseek-v4-flash": { centsPerMTokIn: 30,  centsPerMTokOut: 100 },
  "deepseek-v4-pro":   { centsPerMTokIn: 50,  centsPerMTokOut: 200 },
};

/** Look up the price for a model id. Returns the conservative fallback
 *  if the model isn't in the table — never throws, so billing never
 *  blocks a stream just because a new model wasn't priced yet. */
export function priceFor(modelId: string): ModelPrice {
  return PRICES[modelId] ?? FALLBACK;
}

/** Rough token count from a string. Real tokenizers differ per model
 *  (cl100k for GPT, BPE for Claude, SentencePiece for Gemini), but for
 *  billing purposes the spread is small enough that the 4-chars-per-token
 *  heuristic is within ±20% of actual. We round UP so we err toward
 *  charging slightly more, not under-billing. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Compute the raw API cost in cents for a single request. Returns a
 *  fractional cent value rounded UP to the nearest integer cent — Stripe
 *  bills in whole units, and we always want to capture the full cost
 *  even if a request is sub-cent (most are). */
export function costCents(modelId: string, inTok: number, outTok: number): number {
  const p = priceFor(modelId);
  const inCents = (inTok * p.centsPerMTokIn) / 1_000_000;
  const outCents = (outTok * p.centsPerMTokOut) / 1_000_000;
  return Math.ceil(inCents + outCents);
}

/** Convenience: name + price for the picker / debug surfaces. */
export function describePrice(modelId: string): string {
  const m = findModel(modelId);
  const p = priceFor(modelId);
  const label = m?.label ?? modelId;
  return `${label}: ${p.centsPerMTokIn}¢/M in · ${p.centsPerMTokOut}¢/M out`;
}
