/**
 * Registry of LLMs available in the compare chat.
 *
 * Each entry maps a stable client-side `id` to a provider + the
 * upstream model string + display metadata. The /api/compare route
 * picks a handler off this registry by id and streams a completion.
 *
 * Adding a new model: append an entry here, and (if it's a new
 * provider) add a stream handler in `lib/compare/stream.ts`. The
 * client picker auto-updates from this list.
 */

export type ProviderId = "openai" | "anthropic" | "perplexity" | "gemini" | "xai";

export type CompareModel = {
  id: string;            // stable client id ('gpt-4o', 'claude-sonnet', ...)
  label: string;         // shown on the chip
  provider: ProviderId;
  model: string;         // upstream model string (e.g. 'gpt-4o-2024-08-06')
  accentHex: string;     // per-model brand color for the response box header
  blurb: string;         // short tooltip describing the model
  defaultSelected?: boolean;
};

// Model strings refer to the EXACT identifier each provider expects on
// their API. Verify these against the provider's docs before bumping —
// the API returns 404 if the string is stale or wrong.
//   OpenAI:     https://platform.openai.com/docs/models
//   Anthropic:  https://docs.anthropic.com/en/docs/about-claude/models
//   Gemini:     https://ai.google.dev/gemini-api/docs/models
//   Perplexity: https://docs.perplexity.ai/guides/model-cards
//   xAI:        https://docs.x.ai/docs/models
export const MODELS: CompareModel[] = [
  // ── OpenAI ────────────────────────────────────────────────
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    accentHex: "#10a37f",
    blurb: "OpenAI flagship — fast, multi-modal.",
    defaultSelected: true,
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    model: "gpt-4o-mini",
    accentHex: "#34d399",
    blurb: "Cheaper, faster GPT-4o variant.",
    defaultSelected: true,
  },
  {
    id: "gpt-4-turbo",
    label: "GPT-4 Turbo",
    provider: "openai",
    model: "gpt-4-turbo",
    accentHex: "#0d9488",
    blurb: "Higher-quality reasoning, slower.",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    model: "gpt-4.1",
    accentHex: "#059669",
    blurb: "OpenAI's coding-focused upgrade to GPT-4.",
  },
  {
    id: "o1-mini",
    label: "o1-mini",
    provider: "openai",
    model: "o1-mini",
    accentHex: "#a78bfa",
    blurb: "Reasoning model — slower, deeper.",
  },
  {
    id: "o3-mini",
    label: "o3-mini",
    provider: "openai",
    model: "o3-mini",
    accentHex: "#8b5cf6",
    blurb: "Newer reasoning — faster than o1, sharper math.",
  },
  // ── Anthropic ─────────────────────────────────────────────
  {
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    accentHex: "#c45a3b",
    blurb: "Anthropic's current flagship coder.",
    defaultSelected: true,
  },
  {
    id: "claude-opus-4-1",
    label: "Claude Opus 4.1",
    provider: "anthropic",
    model: "claude-opus-4-1",
    accentHex: "#a04020",
    blurb: "Deepest Claude reasoning — slower, costlier.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    accentHex: "#f4a26a",
    blurb: "Fastest current Claude — quick answers.",
  },
  {
    id: "claude-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    accentHex: "#d97757",
    blurb: "Last-gen 3.5 Sonnet — kept for comparison.",
  },
  // ── Perplexity ────────────────────────────────────────────
  {
    id: "perplexity-sonar",
    label: "Perplexity Sonar",
    provider: "perplexity",
    model: "sonar",
    accentHex: "#20b2aa",
    blurb: "Web-grounded with citations.",
  },
  {
    id: "perplexity-sonar-pro",
    label: "Perplexity Sonar Pro",
    provider: "perplexity",
    model: "sonar-pro",
    accentHex: "#14b8a6",
    blurb: "Deeper-research Sonar variant.",
  },
  {
    id: "perplexity-sonar-reasoning",
    label: "Sonar Reasoning",
    provider: "perplexity",
    model: "sonar-reasoning",
    accentHex: "#0d9488",
    blurb: "Web-grounded + chain-of-thought.",
  },
  // ── Gemini ────────────────────────────────────────────────
  {
    id: "gemini-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    model: "gemini-2.5-flash",
    accentHex: "#4285f4",
    blurb: "Google's fast multi-modal model.",
  },
  {
    id: "gemini-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    model: "gemini-2.5-pro",
    accentHex: "#1a73e8",
    blurb: "Google's flagship — higher quality.",
  },
  // ── xAI ───────────────────────────────────────────────────
  {
    id: "grok-3",
    label: "Grok 3",
    provider: "xai",
    model: "grok-3",
    accentHex: "#9ca3af",
    blurb: "xAI's flagship — current-events aware.",
  },
  {
    id: "grok-4",
    label: "Grok 4",
    provider: "xai",
    model: "grok-4",
    accentHex: "#6b7280",
    blurb: "xAI's newest — broader reasoning.",
  },
];

/** Returns whether a provider has its env key set on the server. */
export function providerAvailable(p: ProviderId): boolean {
  switch (p) {
    case "openai":     return !!process.env.OPENAI_API_KEY;
    case "anthropic":  return !!process.env.ANTHROPIC_API_KEY;
    case "perplexity": return !!process.env.PERPLEXITY_API_KEY;
    case "gemini":     return !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;
    case "xai":        return !!process.env.XAI_API_KEY;
  }
}

export function findModel(id: string): CompareModel | undefined {
  return MODELS.find((m) => m.id === id);
}
