/**
 * POST /api/auto-classify
 *
 * Auto-research mode helper. Takes one user prompt, fires a single
 * cheap gpt-4o-mini call to bucket it into a category, then maps to
 * the recommended model lineup (lib/compare/pipelineModels.ts).
 *
 * Body:    { prompt: string }
 * Headers: Authorization: Bearer <jwt>
 * Returns: {
 *   category: 'research' | 'factual' | 'code' | 'creative' | 'math' | 'general',
 *   lineup: Array<{ id, label, provider }>
 * }
 *
 * Auth: gated by the same Supabase JWT check the rest of the app
 * uses. NOT billed against the user's quota — classification cost
 * is sub-cent and considered overhead.
 *
 * Fallback: if the upstream OpenAI call fails OR returns junk, we
 * default to 'general' so the user can still proceed.
 */
import { extractBearer, decideBilling } from "@/lib/compare/billing";
import {
  type AutoCategory,
  LINEUPS,
  lineupFor,
} from "@/lib/compare/pipelineModels";
import { findModel, providerAvailable, providerKey, type ProviderId } from "@/lib/compare/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<AutoCategory>(
  Object.keys(LINEUPS) as AutoCategory[],
);

export async function POST(req: Request) {
  // Auth check — same gate logic as /api/compare, just for the
  // classifier call. Free users CAN classify (it's cheap and we
  // want the lineup preview UX to work even before they subscribe)
  // — but the actual pipeline run will be blocked downstream by the
  // /api/compare gate after ~10¢.
  const token = extractBearer(req);
  const decision = await decideBilling(token);
  if (!decision.ok && decision.reason === "unauthenticated") {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!decision.ok && decision.reason === "invalid_token") {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }
  // over_quota and lookup_failed are non-blocking for classification.

  let body: { prompt?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return Response.json({ error: "prompt_required" }, { status: 400 });
  }
  if (prompt.length > 8000) {
    return Response.json({ error: "prompt_too_long" }, { status: 413 });
  }

  // Which providers does this deploy actually have keys for? The
  // lineup builder needs this to drop unavailable models.
  const available = new Set<ProviderId>();
  for (const p of ["openai", "anthropic", "perplexity", "gemini", "xai"] as ProviderId[]) {
    if (providerAvailable(p)) available.add(p);
  }

  const startedAt = Date.now();
  const category = await classify(prompt) ?? "general";
  let lineup = lineupFor(category, available);
  console.log(
    `[/api/auto-classify] ${category} (${lineup.length} models) for prompt(${prompt.length}ch) in ${Date.now() - startedAt}ms`,
  );
  // If the chosen lineup is empty (no provider keys match), fall
  // back to ANY available models so the user still gets a pipeline.
  if (lineup.length === 0) {
    for (const id of Object.values(LINEUPS).flat()) {
      const m = findModel(id);
      if (m && available.has(m.provider)) {
        lineup.push(m);
        if (lineup.length >= 3) break;
      }
    }
  }

  return Response.json({
    category,
    lineup: lineup.map((m) => ({ id: m.id, label: m.label, provider: m.provider })),
  });
}

/** Cheapest possible classifier call. Uses gpt-4o-mini with a tight
 *  system prompt that forces single-word output. Returns null on
 *  any failure (network, missing key, unparseable response) — the
 *  caller falls back to 'general'. */
async function classify(prompt: string): Promise<AutoCategory | null> {
  const key = providerKey("openai");
  if (!key) return null;

  const sys =
    "You are a single-word classifier. Categorize the user's prompt " +
    "into EXACTLY ONE of: research, factual, code, creative, math, general. " +
    "Output ONLY the single word, lowercase, no punctuation, no explanation. " +
    "Definitions: research = open-ended investigation or synthesis across " +
    "many sources; factual = single answer / lookup; code = write or debug " +
    "code; creative = essay, story, marketing copy; math = numerical / " +
    "proof / reasoning; general = anything else.";

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 4,
        temperature: 0,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt.slice(0, 2000) },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
    // Strip any wrapping characters / punctuation.
    const clean = raw.replace(/[^a-z]/g, "");
    if (VALID_CATEGORIES.has(clean as AutoCategory)) {
      return clean as AutoCategory;
    }
    return null;
  } catch {
    return null;
  }
}
