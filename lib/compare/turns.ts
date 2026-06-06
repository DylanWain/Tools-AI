/**
 * Compare-mode multi-turn transcript model.
 *
 * One "turn" = one Send the user fired. Compare mode is special because
 * every Send fans out to N models, so a turn holds:
 *
 *   - the user prompt + attachments
 *   - the N model slots and their final responses (frozen — these
 *     never re-stream)
 *   - the user's "pick" — which model's reply they elected to treat as
 *     THE assistant turn for downstream history. Defaults to null (no
 *     pick); user can click any card at any time (even months later) to
 *     change which one is picked, or un-pick entirely.
 *
 * Direct port of the original Tools-AI Electron app (popup.js:7128-7140
 * for the render switch, 8124-8138 for the history builder). The
 * comments below cite those line ranges so future readers can find the
 * source if behavior ever diverges.
 *
 * The shape avoids importing React types so it stays reusable on the
 * server side too (sessions could persist it).
 */
import type { WireAttachment } from "./attachments";
import type { ChatMessage } from "./stream";

/** Just the slot identity we need to render a card. No streaming state.
 *  RunSlot in useCompareStream.ts carries more (systemPrompt, role, etc.)
 *  but for a frozen historical record we only need these three. */
export type FrozenSlot = {
  id: string;
  modelId: string;
  prompt: string;
};

/** Final state of one model's response in a finished turn. Mirrors
 *  RunState but only the fields a transcript needs. Crucially this is
 *  decoupled from the live `RunState` type (kept in
 *  components/chat/useCompareStream.ts) so this module can be imported
 *  from anywhere without dragging in React deps. */
export type FrozenRun = {
  text: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  modelId?: string;
  task?: string;
};

/** One full user→models round, frozen after the stream finishes. */
export type FrozenTurn = {
  id: string;
  createdAt: number;
  userPrompt: string;
  userAttachments?: WireAttachment[];
  slots: FrozenSlot[];
  runs: Record<string, FrozenRun>;
  /** Which slot the user picked as THE response for this turn. null
   *  means no pick — the turn shows as a grid of cards. The user can
   *  flip this at any time without re-running anything. Only the picked
   *  card flows into multi-turn history; un-picked turns are skipped
   *  (matches popup.js:8124-8138 — un-picked compare turns don't add
   *  anything to the assistant side of the conversation). */
  pickedSlotId: string | null;
};

/** Build the conversation history that gets sent to each model on the
 *  NEXT Send. Walks turns in order:
 *
 *    - Always push the user message.
 *    - If the user picked a card for this turn, push that card's text
 *      as the assistant reply.
 *    - If the turn has no pick yet, the assistant slot for that turn is
 *      SKIPPED. (Showing all N replies would confuse the model and
 *      bloat the payload. popup.js makes the same call.)
 *
 *  Returns [] when there's nothing to send (all turns un-picked or no
 *  turns at all) — the route then collapses to single-turn shape. */
export function buildHistory(turns: FrozenTurn[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of turns) {
    const userText = t.userPrompt.trim();
    if (!userText) continue;
    out.push({ role: "user", content: userText });
    if (t.pickedSlotId) {
      const picked = t.runs[t.pickedSlotId];
      const reply = picked?.text?.trim();
      // Drop empty or errored picks — sending an empty assistant message
      // breaks Anthropic's API and confuses every other provider too.
      if (reply && !picked?.error) {
        out.push({ role: "assistant", content: reply });
      }
    }
  }
  return out;
}

/** Snapshot the live `lastSlots` + `runs` into a frozen turn. Called
 *  right before a new Send so the prior batch survives in the
 *  transcript even though useCompareStream is about to overwrite its
 *  state. */
export function freezeTurn(args: {
  id: string;
  createdAt: number;
  userPrompt: string;
  userAttachments?: WireAttachment[];
  liveSlots: Array<{ id: string; modelId: string; prompt: string; role?: string }>;
  liveRuns: Record<string, FrozenRun>;
  pickedSlotId: string | null;
}): FrozenTurn {
  return {
    id: args.id,
    createdAt: args.createdAt,
    userPrompt: args.userPrompt,
    userAttachments: args.userAttachments,
    // Synthesizer slots only show up in multi-agent mode — drop them
    // here so compare transcript stays clean if this ever gets called
    // from the wrong mode.
    slots: args.liveSlots
      .filter((s) => s.role !== "synthesizer")
      .map((s) => ({ id: s.id, modelId: s.modelId, prompt: s.prompt })),
    // Only retain runs for the slots we kept. Defensive copy so a
    // future RunState mutation can't leak back into the transcript.
    runs: Object.fromEntries(
      args.liveSlots
        .filter((s) => s.role !== "synthesizer")
        .map((s) => {
          const r = args.liveRuns[s.id];
          return [
            s.id,
            r
              ? {
                  text: r.text ?? "",
                  error: r.error,
                  startedAt: r.startedAt,
                  finishedAt: r.finishedAt,
                  modelId: r.modelId,
                  task: r.task,
                }
              : { text: "" },
          ];
        }),
    ),
    pickedSlotId: args.pickedSlotId,
  };
}
