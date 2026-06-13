/**
 * buildImportedSession — turn a linked coding-tool conversation (Claude
 * Code / Cursor / Codex, read off disk via the desktop bridge) into a
 * CompareSession so it opens in the normal chat view and can be
 * CONTINUED.
 *
 * Each user→assistant pair becomes one FrozenTurn whose single card is
 * pre-"picked". Because picked cards flow into multi-turn history
 * (see lib/compare/turns.ts buildHistory), the whole imported
 * conversation becomes context for the next Send — so the user can keep
 * the thread going with ANY model (continue with Claude, then switch to
 * GPT, etc.).
 *
 * Read-only origin: this never writes back to ~/.claude/.cursor/.codex —
 * it copies the transcript into a fresh Veronum session.
 */
import type { CompareSession } from "./sessions";
import { newSessionId } from "./sessions";
import type { FrozenTurn } from "./turns";
import { MODELS, findModel } from "./models";

export type ImportMessage = { role: "user" | "assistant"; text: string };

/**
 * Map an imported session's model to a REAL compare model id so its
 * cards render (the transcript drops cards whose modelId isn't in
 * MODELS). Tries the session's own model first (Claude Code reports e.g.
 * "claude-opus-4-8[1m]" → "claude-opus-4-8"; Codex reports "gpt-5.4"),
 * then falls back to a sensible default per source.
 */
function resolveModelId(rawModel: string | null | undefined, sourceLabel: string): string {
  if (rawModel) {
    const cleaned = rawModel.replace(/\[.*?\]/g, "").trim();
    if (findModel(cleaned)) return cleaned;
    const partial = MODELS.find((m) => cleaned.startsWith(m.id));
    if (partial) return partial.id;
  }
  const src = sourceLabel.toLowerCase();
  const fallback = src.includes("codex") ? "gpt-5.4"
    : src.includes("cursor") ? "claude-sonnet-4-5"
    : "claude-opus-4-8"; // Claude Code default
  return findModel(fallback) ? fallback : MODELS[0].id;
}

export function buildImportedSession(opts: {
  title: string;
  messages: ImportMessage[];
  /** Display label for the cards, e.g. "Claude Code" / "Cursor" / "Codex". */
  sourceLabel: string;
  /** The session's model as reported by the reader (best-effort label). */
  model?: string | null;
  createdAt: number;
}): CompareSession {
  const slotId = "imported";
  const modelId = resolveModelId(opts.model, opts.sourceLabel);
  const turns: FrozenTurn[] = [];

  // Pair each user message with the next assistant message. A user
  // message with no following assistant (a dangling last prompt) is
  // dropped from history — there's no reply to show or feed forward.
  let pendingUser: string | null = null;
  let i = 0;
  for (const m of opts.messages) {
    const text = (m.text ?? "").trim();
    if (!text) continue;
    if (m.role === "user") {
      pendingUser = text;
    } else if (m.role === "assistant" && pendingUser !== null) {
      turns.push({
        id: `imp-${i}`,
        createdAt: opts.createdAt + i,
        userPrompt: pendingUser,
        slots: [{ id: slotId, modelId, prompt: pendingUser }],
        runs: { [slotId]: { text, modelId } },
        pickedSlotId: slotId,
      });
      pendingUser = null;
      i += 1;
    }
  }

  return {
    id: newSessionId(),
    title: (opts.title || opts.sourceLabel).slice(0, 80),
    createdAt: opts.createdAt,
    mode: "compare",
    // Empty on purpose: the source label isn't a real model id, and
    // loadSession would otherwise set it as the selected model and break
    // the next Send with unknown_model. The user picks a real model
    // (GPT / Claude / …) to continue. Cards still label via slot.modelId.
    modelIds: [],
    turns,
    // No live batch — the transcript lives entirely in `turns`.
    runs: {},
  };
}
