"use client";

/**
 * PipelineView — the Auto-research chain visualization.
 *
 * Renders the ordered step list as a vertical chain:
 *
 *   ┌──────────────────────────────────────┐
 *   │  Round 1                              │
 *   │  ① Perplexity Sonar Pro    [ done ]  │  ← click to expand
 *   │  ② Gemini Pro              [ done ]  │
 *   │  ③ Claude Sonnet 4.5       [ done ]  │
 *   │  Round 2                              │
 *   │  ④ Perplexity Sonar Pro    [ ↻ ]    │  ← streaming caret
 *   │  ⑤ Gemini Pro              [ ··· ]  │  ← queued
 *   │  ⑥ Claude Sonnet 4.5       [ ··· ]  │
 *   └──────────────────────────────────────┘
 *
 *   FINAL OUTPUT (collapsible reveal of last step's text)
 *
 * Each step row is clickable — opens that step's full output in an
 * inline accordion so the user can see what each model produced.
 */

import { useState } from "react";
import { MODELS } from "@/lib/compare/models";
import type { RunState } from "./useCompareStream";

export type PipelineSlot = {
  stepId: string;
  modelId: string;
  roundIndex: number;
  slotIndex: number;
};

type Props = {
  /** Full step list in execution order. */
  steps: PipelineSlot[];
  /** Live run state per stepId — same map useCompareStream maintains. */
  runs: Record<string, RunState>;
  /** The original user prompt — rendered above the chain. */
  originalPrompt: string;
  /** Optional label shown at the top of the chain. Auto mode passes
   *  "Auto-picked for: research"; manual passes null. */
  autoLabel?: string | null;
};

export function PipelineView({ steps, runs, originalPrompt, autoLabel }: Props) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Group steps by round for the visual divider.
  const rounds = new Map<number, PipelineSlot[]>();
  for (const s of steps) {
    if (!rounds.has(s.roundIndex)) rounds.set(s.roundIndex, []);
    rounds.get(s.roundIndex)!.push(s);
  }

  // The final assistant output = last step's text. Only show it
  // when the last step is done (or errored — show whatever we got).
  const finalStep = steps[steps.length - 1];
  const finalRun = finalStep ? runs[finalStep.stepId] : null;
  const finalDone = finalRun && (finalRun.status === "done" || finalRun.status === "error");
  const finalText = finalDone ? finalRun.text : null;

  // Aggregate stats for the header.
  const completed = steps.filter((s) => {
    const r = runs[s.stepId];
    return r?.status === "done" || r?.status === "error";
  }).length;

  return (
    <div className="flex flex-col gap-5">
      {/* User prompt */}
      <div className="flex justify-end">
        <div className="rounded-2xl bg-[#1f1f1f] border border-white/10 text-white/95 px-4 py-2.5 max-w-[68ch]">
          <div className="text-[15px] leading-[1.5] whitespace-pre-wrap">{originalPrompt}</div>
        </div>
      </div>

      {/* Chain card */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <header className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[12.5px] text-white/70 font-medium">Auto-research pipeline</span>
            {autoLabel && (
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: "rgba(217,119,87,0.14)",
                  color: "#d97757",
                  border: "1px solid rgba(217,119,87,0.35)",
                }}
              >
                {autoLabel}
              </span>
            )}
          </div>
          <span className="text-[11px] text-white/40 font-mono">
            {completed} / {steps.length} step{steps.length === 1 ? "" : "s"}
          </span>
        </header>

        <div className="px-3 py-3">
          {[...rounds.entries()].map(([roundIdx, roundSteps]) => (
            <section key={roundIdx} className="mb-3 last:mb-0">
              <div className="text-[10.5px] uppercase tracking-wider text-white/35 font-mono px-2 mb-1">
                Round {roundIdx + 1}
              </div>
              <ol className="space-y-1">
                {roundSteps.map((s, posInRound) => {
                  const globalIdx = steps.findIndex((x) => x.stepId === s.stepId);
                  const r = runs[s.stepId];
                  const isExpanded = expandedStep === s.stepId;
                  return (
                    <li key={s.stepId}>
                      <StepRow
                        step={s}
                        run={r}
                        positionLabel={`${globalIdx + 1}`}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedStep(isExpanded ? null : s.stepId)}
                      />
                      {isExpanded && r && (
                        <StepDetail run={r} />
                      )}
                      {posInRound === roundSteps.length - 1 && (
                        <div className="ml-7 my-1 border-l border-dashed border-white/[0.08] h-2" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>

      {/* Final output — rendered as the canonical assistant reply. */}
      {finalText !== null && finalText.length > 0 && (
        <article className="rounded-xl border-2 border-[#d97757]/40 overflow-hidden">
          <header className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-white/70 font-medium">Final answer</span>
              <span className="text-[10.5px] uppercase tracking-wider text-white/40 font-mono">
                from {labelFor(finalStep.modelId)}
              </span>
            </div>
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
              style={{
                background: "rgba(217,119,87,0.14)",
                color: "#d97757",
                border: "1px solid rgba(217,119,87,0.35)",
              }}
            >
              final
            </span>
          </header>
          <div className="px-4 py-3 max-h-[640px] overflow-y-auto text-white/85 text-[14px] leading-[1.6] whitespace-pre-wrap font-sans">
            {finalText}
          </div>
        </article>
      )}
    </div>
  );
}

/** One step row — model label + status chip + chevron. Clickable. */
function StepRow({
  step, run, positionLabel, isExpanded, onToggle,
}: {
  step: PipelineSlot;
  run: RunState | undefined;
  positionLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = run?.status ?? "idle";
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.04] transition-colors"
    >
      <span className="text-[11px] text-white/35 font-mono w-5 text-right">{positionLabel}</span>
      <span className="text-[13px] text-white/90 flex-1 truncate">{labelFor(step.modelId)}</span>
      <StatusChip status={status} />
      <span
        className="text-white/35 text-[11px] transition-transform"
        style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
        aria-hidden
      >
        ▸
      </span>
    </button>
  );
}

/** Inline expanded output for a step. Shows error text if errored. */
function StepDetail({ run }: { run: RunState }) {
  if (run.status === "error") {
    return (
      <div className="ml-7 mt-1 mb-2 px-3 py-2 rounded-md bg-red-500/[0.06] border border-red-400/20 text-red-200/90 text-[12.5px]">
        ⚠ {run.error || "Failed"}
      </div>
    );
  }
  if (!run.text) {
    return (
      <div className="ml-7 mt-1 mb-2 px-3 py-2 text-white/40 text-[12.5px] italic">
        {run.status === "streaming" ? "Streaming…" : "Waiting to start…"}
      </div>
    );
  }
  return (
    <div className="ml-7 mt-1 mb-2 px-3 py-2 rounded-md bg-black/30 border border-white/[0.05] text-white/85 text-[13px] leading-[1.55] whitespace-pre-wrap max-h-[320px] overflow-y-auto">
      {run.text}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    idle:      { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.45)", label: "queued" },
    streaming: { bg: "rgba(126,180,114,0.16)", fg: "#a8d49b",                label: "streaming" },
    done:      { bg: "rgba(126,180,114,0.10)", fg: "#7eb472",                label: "done" },
    error:     { bg: "rgba(217,87,87,0.16)",   fg: "#e89999",                label: "error" },
  };
  const p = palette[status] ?? palette.idle;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
      style={{ background: p.bg, color: p.fg }}
    >
      {p.label}
    </span>
  );
}

function labelFor(modelId: string): string {
  return MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}
