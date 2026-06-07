/**
 * Auto-research / pipeline mode — types + per-step prompt builder.
 *
 * Flow: an ordered list of models executes sequentially across N
 * rounds. The FIRST step (round 0, slot 0) drafts a fresh response
 * to the user's prompt. EVERY subsequent step receives the prior
 * step's full output and is instructed to AUDIT + IMPROVE — not
 * rewrite from scratch, not start over, but treat the prior draft
 * as the working version and produce a better one.
 *
 *   step(0,0) = draft
 *   step(r,i) for (r,i) > (0,0) = improve-on-previous
 *
 * The last model's last-round output is the final answer the user
 * sees. (Synthesizer pass was explicitly NOT added — product
 * decision: the chain itself is the synthesis.)
 */

/** One step in the chain. */
export type PipelineStep = {
  roundIndex: number;
  slotIndex: number;
  modelId: string;
  modelLabel: string;
  /** Stable id for keying — `r${round}-s${slot}`. */
  stepId: string;
};

/** Live state of one step as it streams. */
export type PipelineStepState = {
  status: "queued" | "streaming" | "done" | "error";
  text: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
};

/** Build the ordered step list given an ordered model lineup and a
 *  round count. Rounds repeat the lineup in the same order. */
export function buildSteps(
  lineup: Array<{ id: string; label: string }>,
  rounds: number,
): PipelineStep[] {
  const out: PipelineStep[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < lineup.length; i++) {
      const m = lineup[i];
      out.push({
        roundIndex: r,
        slotIndex: i,
        modelId: m.id,
        modelLabel: m.label,
        stepId: `r${r}-s${i}`,
      });
    }
  }
  return out;
}

/** Build the user-facing prompt that gets sent to one step's model.
 *  The DRAFT step (round 0, slot 0) just gets the original prompt
 *  verbatim. Every other step gets the previous step's output as
 *  the "working draft" plus the original prompt as the goal anchor. */
export function buildStepPrompt(args: {
  originalPrompt: string;
  previousOutput: string | null;
  isDraftStep: boolean;
}): string {
  if (args.isDraftStep || !args.previousOutput) {
    return args.originalPrompt;
  }
  return [
    "=== ORIGINAL TASK ===",
    args.originalPrompt,
    "",
    "=== CURRENT DRAFT (from previous model) ===",
    args.previousOutput,
    "",
    "=== YOUR JOB ===",
    "Audit the draft above against the original task. Improve it:",
    "fix factual errors, fill gaps, tighten weak reasoning, expand",
    "thin sections, and remove anything that doesn't serve the goal.",
    "Preserve what's strong. Output the improved version in full —",
    "the next model will see YOUR output as the working draft.",
  ].join("\n");
}

/** Optional system-prompt suffix per step — gives the model a
 *  consistent voice across rounds. */
export function buildStepSystemPrompt(args: {
  modelLabel: string;
  roundIndex: number;
  slotIndex: number;
  totalSteps: number;
  isDraftStep: boolean;
  isFinalStep: boolean;
}): string {
  const base =
    "You are part of a multi-model improvement chain. Each model in " +
    "the chain reads the previous model's draft and produces a better " +
    "version. Maintain a serious, rigorous tone. Cite sources where " +
    "relevant. Never invent facts.";
  if (args.isDraftStep) {
    return base + " You are the FIRST model — produce a strong initial draft.";
  }
  if (args.isFinalStep) {
    return base + " You are the LAST model in the chain — your output is the " +
      "final answer the user will see. Polish it. Make it presentation-ready.";
  }
  return base + ` You are in round ${args.roundIndex + 1}, slot ${args.slotIndex + 1} ` +
    "— audit + improve the draft you receive.";
}
