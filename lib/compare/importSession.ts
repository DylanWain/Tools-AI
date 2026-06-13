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

export type ImportMessage = { role: "user" | "assistant"; text: string };

export function buildImportedSession(opts: {
  title: string;
  messages: ImportMessage[];
  /** Display label for the cards, e.g. "Claude Code" / "Cursor" / "Codex". */
  sourceLabel: string;
  createdAt: number;
}): CompareSession {
  const slotId = "imported";
  const modelId = opts.sourceLabel;
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
    modelIds: [modelId],
    turns,
    // No live batch — the transcript lives entirely in `turns`.
    runs: {},
  };
}
