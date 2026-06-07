/**
 * Auto-research mode — category-to-model-lineup map.
 *
 * When the user types a prompt in Auto mode, /api/auto-classify
 * sends ONE cheap gpt-4o-mini call asking it to categorize the
 * intent. We then look up the best ordered lineup for that category
 * here and run the pipeline.
 *
 * Each lineup is ordered intentionally — the first model is the
 * "draft" model, subsequent models AUDIT + IMPROVE the prior draft.
 * Picks follow these heuristics:
 *
 *   research / factual → Perplexity first (web grounding) → Gemini
 *     2.5 Pro (long-context synthesis) → Claude Sonnet (rigorous
 *     analysis + skeptical audit).
 *
 *   code → GPT-4.1 first (coding-focused) → Claude Sonnet 4.5
 *     (current-flagship coder per Anthropic) → o3-mini (reasoning
 *     audit for edge cases).
 *
 *   creative → Claude Opus 4.1 (strongest literary voice) → GPT-4o
 *     (broad cross-domain knowledge polish) → Gemini Pro
 *     (multi-modal sense check).
 *
 *   math → o3-mini (reasoning) → Claude Opus 4.1 (verify proof) →
 *     GPT-4.1 (alternate-approach audit).
 *
 *   general → balanced trio. Same as 'research' minus Perplexity,
 *     since we don't know if the user needs web grounding.
 */

import { findModel, type CompareModel } from "./models";

export type AutoCategory =
  | "research"
  | "factual"
  | "code"
  | "creative"
  | "math"
  | "general";

/** Ordered model-id lineup per category. Each id must exist in
 *  lib/compare/models.ts — we validate at runtime via findModel(). */
export const LINEUPS: Record<AutoCategory, string[]> = {
  research:  ["perplexity-sonar-pro", "gemini-pro",        "claude-sonnet-4-5"],
  factual:   ["perplexity-sonar-pro", "claude-sonnet-4-5", "gemini-pro"],
  code:      ["gpt-4.1",              "claude-sonnet-4-5", "o3-mini"],
  creative:  ["claude-opus-4-1",      "gpt-4o",            "gemini-pro"],
  math:      ["o3-mini",              "claude-opus-4-1",   "gpt-4.1"],
  general:   ["gemini-pro",           "claude-sonnet-4-5", "gpt-4o"],
};

/** Resolve a category to its lineup, dropping any model id whose
 *  provider key isn't set on the server. Returns null if no model
 *  in the lineup is available — caller should fall back to the
 *  user's currently-selected models. */
export function lineupFor(
  category: AutoCategory,
  availableProviders: Set<string>,
): CompareModel[] {
  const ids = LINEUPS[category] ?? LINEUPS.general;
  const out: CompareModel[] = [];
  for (const id of ids) {
    const m = findModel(id);
    if (m && availableProviders.has(m.provider)) out.push(m);
  }
  return out;
}

/** Human-readable label for the chip the composer shows above the
 *  prompt input in Auto mode ("Detected: research • 3 models"). */
export const CATEGORY_LABELS: Record<AutoCategory, string> = {
  research: "research",
  factual:  "factual lookup",
  code:     "code",
  creative: "creative writing",
  math:     "math / reasoning",
  general:  "general",
};
