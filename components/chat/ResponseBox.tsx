"use client";

/**
 * Single model's response card. Click → mark as "picked" (clay ring).
 * Double-click → expand to fullscreen.
 *
 * Monochrome by design: matches Veronum's restrained dark aesthetic.
 * The model NAME is the identifier — no per-provider color band.
 */

import { useEffect, useState } from "react";
import type { CompareModel } from "@/lib/compare/models";
import type { RunState } from "./useCompareStream";

type Props = {
  model: CompareModel;
  run: RunState;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onExpand: () => void;
  /** Multi-agent only: e.g. "Agent 3". Shown next to the model name. */
  agentLabel?: string;
  /** Multi-agent only: the specific task this agent received. Shown as
   *  a small italic block above the response so each box is self-explanatory. */
  task?: string;
};

export function ResponseBox({
  model, run, isFavorite, onToggleFavorite, onExpand, agentLabel, task,
}: Props) {
  return (
    <article
      onClick={onToggleFavorite}
      onDoubleClick={(e) => { e.preventDefault(); onExpand(); }}
      className={[
        "group relative rounded-xl border bg-[#161616] overflow-hidden cursor-pointer transition-colors",
        isFavorite
          ? "border-[#d97757] shadow-[0_0_0_1px_#d97757]"
          : "border-white/10 hover:border-white/25",
      ].join(" ")}
      title="Click to mark as preferred · double-click to expand"
    >
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          {agentLabel && (
            <span className="text-[11px] uppercase tracking-wider text-white/40 font-mono shrink-0">
              {agentLabel}
            </span>
          )}
          <span className="text-[13px] font-medium text-white/95 truncate">{model.label}</span>
          <StatusPill run={run} />
        </div>
        <div className="flex items-center gap-2">
          {isFavorite && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-[#d97757] border border-[#d97757]/40 font-mono">
              picked
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="text-white/35 hover:text-white text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Expand to full screen"
            title="Expand (or double-click anywhere)"
          >
            ⛶
          </button>
        </div>
      </header>
      <div className="px-5 py-4 max-h-[420px] overflow-y-auto text-white/90 text-[14px] leading-[1.6] whitespace-pre-wrap font-sans">
        {task && (
          <div className="mb-3 -mt-1 px-3 py-2 rounded-md bg-white/[0.03] border border-white/5 text-white/60 text-[12.5px] leading-[1.45] italic">
            <span className="text-white/35 not-italic font-mono text-[10px] uppercase tracking-wider mr-2">task</span>
            {task}
          </div>
        )}
        {run.status === "error" ? (
          <div className="text-red-300/90 text-[13px]">⚠ {run.error || "Failed"}</div>
        ) : run.text ? (
          run.text
        ) : run.status === "streaming" ? (
          <span className="text-white/30">Thinking…</span>
        ) : (
          <span className="text-white/25">Awaiting prompt</span>
        )}
        {run.status === "streaming" && <Caret />}
      </div>
    </article>
  );
}

function StatusPill({ run }: { run: RunState }) {
  const elapsed = useElapsed(run.startedAt, run.status === "streaming");
  if (run.status === "idle") return null;
  if (run.status === "streaming") {
    return (
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
        {(elapsed / 1000).toFixed(1)}s
      </span>
    );
  }
  if (run.status === "error") {
    return <span className="text-[10px] uppercase tracking-wider text-red-300/80 font-mono">error</span>;
  }
  const dur = run.startedAt && run.finishedAt ? run.finishedAt - run.startedAt : 0;
  return (
    <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
      {(dur / 1000).toFixed(1)}s
    </span>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="inline-block w-[7px] h-[15px] align-text-bottom ml-0.5 bg-white/70"
      style={{ animation: "caret-blink 1s steps(2) infinite" }}
    />
  );
}

function useElapsed(startedAt: number | undefined, live: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [live]);
  return startedAt ? Date.now() - startedAt : 0;
}
