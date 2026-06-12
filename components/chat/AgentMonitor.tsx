"use client";

/**
 * AgentMonitor — a live "command center" for parallel multi-agent runs.
 *
 * One tile per slot, laid out in a responsive grid, so the user can
 * watch every agent stream at once. Purely presentational: it reads
 * from the same `runs` map that useCompareStream owns and renders a
 * model badge, a status dot, the task, and the tail of each agent's
 * streamed output.
 */

import { findModel } from "@/lib/compare/models";
import type { RunState } from "./useCompareStream";

type Slot = { id: string; modelId: string; task: string };

type Phase = "running" | "done" | "error";

const PHASE_DOT: Record<Phase, string> = {
  running: "bg-amber-400",
  done: "bg-emerald-400",
  error: "bg-red-400",
};

const PHASE_LABEL: Record<Phase, string> = {
  running: "running",
  done: "done",
  error: "error",
};

/**
 * Derive a coarse phase from a slot's run state. Priority:
 *   1. a non-empty `.error` ⇒ error
 *   2. an explicit `.status` field if present (streaming/done/error/idle)
 *   3. otherwise: presence of growing `.text` ⇒ running, else idle/running
 */
function derivePhase(run: RunState | undefined): Phase {
  if (!run) return "running";
  if (run.error && run.error.trim()) return "error";
  if (run.status === "error") return "error";
  if (run.status === "done") return "done";
  if (run.status === "streaming") return "running";
  // No explicit terminal status (e.g. "idle" or a future shape with no
  // status field) — treat the agent as still running so the dashboard
  // keeps it live until a done/error signal arrives.
  return "running";
}

/** Last `n` non-empty-ish lines of streamed output, joined for display. */
function tail(text: string | undefined, n: number): string {
  if (!text) return "";
  const lines = text.split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

/** Elapsed run time in ms, derived from the run's timestamps. RunState
 *  records `startedAt` / `finishedAt`; we surface their delta as the
 *  "durationMs" the dashboard shows next to a finished agent. */
function durationMs(run: RunState | undefined): number | null {
  if (!run?.startedAt || !run?.finishedAt) return null;
  const ms = run.finishedAt - run.startedAt;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function fmtDuration(ms: number | null): string | null {
  if (ms === null) return null;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AgentMonitor({
  runs,
  slots,
}: {
  runs: Record<string, RunState>;
  slots: Array<{ id: string; modelId: string; task: string }>;
}) {
  if (slots.length === 0) return null;

  return (
    <section
      aria-label="Agent monitor"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
    >
      {slots.map((slot) => (
        <Tile key={slot.id} slot={slot} run={runs[slot.id]} />
      ))}
    </section>
  );
}

function Tile({ slot, run }: { slot: Slot; run: RunState | undefined }) {
  const model = findModel(slot.modelId);
  const label = model?.label ?? slot.modelId;
  const accent = model?.accentHex ?? "#9ca3af";
  const phase = derivePhase(run);
  const duration = phase === "done" ? fmtDuration(durationMs(run)) : null;
  const lastLines = tail(run?.text, 4);

  return (
    <article className="flex flex-col rounded-xl border border-white/[0.08] bg-[#1f1f1f] overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span
            className="text-[12.5px] font-medium truncate"
            style={{ color: accent }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={[
              "inline-block w-1.5 h-1.5 rounded-full",
              PHASE_DOT[phase],
              phase === "running" ? "animate-pulse" : "",
            ].join(" ")}
            aria-hidden
          />
          <span
            className={[
              "text-[10px] uppercase tracking-wider font-mono",
              phase === "error" ? "text-red-300/80" : "text-white/40",
            ].join(" ")}
          >
            {PHASE_LABEL[phase]}
            {duration ? ` · ${duration}` : ""}
          </span>
        </div>
      </header>

      <div className="px-3 py-2 border-b border-white/[0.04]">
        <p className="text-white/55 text-[12.5px] leading-[1.45] line-clamp-2">
          {slot.task || <span className="text-white/25">No task</span>}
        </p>
      </div>

      <div className="px-3 py-2">
        {phase === "error" ? (
          <div className="text-red-300/90 text-[12px] font-mono leading-[1.5] line-clamp-3">
            ⚠ {run?.error || "Failed"}
          </div>
        ) : lastLines ? (
          <pre className="max-h-[88px] overflow-y-auto text-white/85 text-[11.5px] leading-[1.5] font-mono whitespace-pre-wrap break-words">
            {lastLines}
          </pre>
        ) : (
          <div className="text-white/25 text-[11.5px] font-mono">
            {phase === "running" ? "Streaming…" : "Awaiting output"}
          </div>
        )}
      </div>
    </article>
  );
}
