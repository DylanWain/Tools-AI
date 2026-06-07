/**
 * Server-side compare-chat event logging.
 *
 * Called once per /api/compare invocation (one row per upstream
 * stream, so a parallel fan-out across N models writes N rows). The
 * dashboard groups by session_id + ts to reconstruct per-Send events.
 *
 * Privacy: prompt_preview is truncated to 200 chars BEFORE leaving
 * the route. The DB also enforces 200 via LEFT() in the RPC, so a
 * misbehaving caller can't write more than agreed.
 *
 * Reliability: every call is fire-and-forget. We log the failure but
 * never let an analytics write fail the user's request — analytics
 * is observability, not load-bearing for the product.
 */

import { serverSupabaseAdmin } from "@/lib/supabase";

/** Max chars stored in prompt_preview. Matches the LEFT() cap in
 *  migration 003 and the privacy choice the product owner made
 *  (length + first 200 chars, not full prompts). */
export const PROMPT_PREVIEW_MAX = 200;

export type CompareEventInput = {
  userId: string | null;
  userEmail: string | null;
  mode: "compare" | "agents";
  modelId: string;
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  status: "ok" | "error" | "aborted";
  errorKind?: string | null;
  sessionId?: string | null;
  turnIndex?: number | null;
  pickedModel?: string | null;
  durationMs: number;
};

/** Truncate without breaking surrogate pairs (rare, but a 200-char
 *  cap that splits an emoji could land mid-codepoint and corrupt the
 *  string). Slice by codepoints, not by UTF-16 code units. */
function safePreview(s: string, maxChars: number): string {
  if (!s) return "";
  const codepoints = Array.from(s);
  if (codepoints.length <= maxChars) return s;
  return codepoints.slice(0, maxChars).join("");
}

/** Fire-and-forget event log. Returns a Promise so callers CAN await
 *  if they want to test, but the /api/compare route deliberately
 *  doesn't — it `.catch(...)`s and continues immediately. */
export async function logCompareEvent(ev: CompareEventInput): Promise<void> {
  // Skip when there's no user — we can't attribute the event. We could
  // log anonymously but it'd clutter the dashboard and the gate
  // shouldn't allow anonymous traffic anyway (401 fires first).
  if (!ev.userId) return;

  let admin;
  try {
    admin = serverSupabaseAdmin();
  } catch (e) {
    // No service role key — same root cause as the rest of the gate
    // when env vars are missing. Don't crash, just skip.
    console.warn("[analytics] skipping log — admin client unavailable:", (e as Error).message);
    return;
  }

  const { error } = await admin.rpc("veronum_log_compare_event", {
    p_user_id:        ev.userId,
    p_user_email:     ev.userEmail,
    p_mode:           ev.mode,
    p_model_id:       ev.modelId,
    p_prompt_chars:   ev.prompt.length,
    p_prompt_preview: safePreview(ev.prompt, PROMPT_PREVIEW_MAX),
    p_input_tokens:   ev.inputTokens,
    p_output_tokens:  ev.outputTokens,
    p_cost_cents:     ev.costCents,
    p_status:         ev.status,
    p_error_kind:     ev.errorKind ?? null,
    p_session_id:     ev.sessionId ?? null,
    p_turn_index:     ev.turnIndex ?? null,
    p_picked_model:   ev.pickedModel ?? null,
    p_duration_ms:    ev.durationMs,
  });
  if (error) {
    // Likely the RPC doesn't exist (migration 003 not applied yet).
    // Log loudly so the next deploy noise tells you to run it.
    console.warn("[analytics] log_compare_event RPC failed:", error.message);
  }
}
