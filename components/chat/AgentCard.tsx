"use client";

/**
 * Single agent card. Two visual states:
 *
 *   ┌── idle ─────────────────────────┐    ┌── streaming / done ──────┐
 *   │ Agent 1 · [Claude Sonnet ▼]  ×  │    │ Agent 1 · Claude Sonnet  │
 *   │ ─────────────────────────────── │    │ Task: build the form     │
 *   │ TASK                            │    │ Files: app/login/...     │
 *   │ Build the form…                 │ →  │ ─────────────────────────│
 *   │ ─────────────────────────────── │    │ <streaming response>     │
 *   │ FILES                           │    │ ...                      │
 *   │ app/login/page.tsx, ...         │    └──────────────────────────┘
 *   │ ─────────────────────────────── │
 *   │ LINES                           │
 *   │ 1-50 (optional)                 │
 *   └─────────────────────────────────┘
 *
 * The whole multi-agent flow is code-focused now (no toggle), so files
 * + lines are always visible. Conflicts with peers (file claims that
 * overlap without disjoint lines) show as a small amber line above
 * the files input.
 */

import { useEffect, useRef, useState } from "react";
import type { CompareModel } from "@/lib/compare/models";
import type { AgentSlot } from "@/lib/compare/sessions";
import type { RunState } from "./useCompareStream";

/** Per-card decision the user makes about the agent's response.
 *  Cursor-style accept/skip — `undo`/`redo` (at the editor level) already
 *  exists, so we don't need accept-to-disk semantics here. This is a
 *  chat-level triage: keep this output, or move on. */
export type AgentDecision = "pending" | "accepted" | "skipped";

type Props = {
  index: number;
  agent: AgentSlot;
  models: CompareModel[];
  overlapPaths: string[];
  /** If present, the card renders in "active" mode showing the
   *  streaming response and locking the config inputs. */
  run?: RunState;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onExpand?: () => void;
  onChange: (patch: Partial<AgentSlot>) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** Decision state for the streamed response. Buttons surface only
   *  when `run.status === "done"` AND decision is still "pending". */
  decision?: AgentDecision;
  onAccept?: () => void;
  onSkip?: () => void;
};

export function AgentCard({
  index, agent, models, overlapPaths,
  run, isFavorite, onToggleFavorite, onExpand,
  onChange, onRemove, canRemove,
  decision = "pending", onAccept, onSkip,
}: Props) {
  const taskRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = taskRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [agent.task]);

  const filesText = (agent.files ?? []).join(", ");
  const active = !!run && run.status !== "idle";
  const isStreaming = run?.status === "streaming";
  const isError = run?.status === "error";
  const currentModel = models.find((m) => m.id === agent.modelId);

  return (
    <article
      onClick={active && onToggleFavorite ? onToggleFavorite : undefined}
      onDoubleClick={active && onExpand ? (e) => { e.preventDefault(); onExpand(); } : undefined}
      className={[
        "group rounded-xl border bg-[#161616] overflow-hidden transition-colors",
        active && isFavorite
          ? "border-[#d97757] shadow-[0_0_0_1px_#d97757] cursor-pointer"
          : active
            ? "border-white/10 hover:border-white/25 cursor-pointer"
            : "border-white/10",
      ].join(" ")}
      title={active ? "Click to mark as preferred · double-click to expand" : undefined}
    >
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-mono shrink-0">
            Agent {index + 1}
          </span>
          {active ? (
            <span className="text-[13px] font-medium text-white/95 truncate">
              {currentModel?.label ?? agent.modelId}
            </span>
          ) : (
            <select
              value={agent.modelId}
              onChange={(e) => onChange({ modelId: e.target.value })}
              className="bg-transparent text-white/85 text-[13px] font-medium border border-white/10 hover:border-white/25 focus:border-white/40 rounded-md px-2 py-0.5 outline-none transition-colors min-w-0 flex-1"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#161616] text-white">
                  {m.label}
                </option>
              ))}
            </select>
          )}
          {active && <StatusPill run={run} />}
        </div>
        <div className="flex items-center gap-1.5">
          {active && isFavorite && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-[#d97757] border border-[#d97757]/40 font-mono">
              picked
            </span>
          )}
          {!active && canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="w-6 h-6 inline-flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
              aria-label={`Remove agent ${index + 1}`}
              title="Remove agent"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          )}
          {active && onExpand && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExpand(); }}
              className="text-white/35 hover:text-white text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Expand"
              title="Expand"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <path d="M4 10v3h3M12 6V3H9M4 13l4-4M12 3l-4 4" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Body: config (always visible — even when active they show as read-only) */}
      <div className="px-4 py-3 space-y-2.5">
        <Field label="Task">
          {active ? (
            <p className="text-white/85 text-[13.5px] leading-[1.5] whitespace-pre-wrap">
              {agent.task || <span className="text-white/30">(no task)</span>}
            </p>
          ) : (
            <textarea
              ref={taskRef}
              value={agent.task}
              onChange={(e) => onChange({ task: e.target.value })}
              placeholder="What does this agent do?"
              rows={1}
              className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none text-[13.5px] leading-[1.5]"
            />
          )}
        </Field>

        <Field
          label="Files"
          warning={
            !active && overlapPaths.length > 0
              ? `shares ${overlapPaths.slice(0, 2).join(", ")}${overlapPaths.length > 2 ? `, +${overlapPaths.length - 2}` : ""}`
              : undefined
          }
        >
          {active ? (
            <p className="text-white/75 text-[12.5px] font-mono leading-[1.4]">
              {filesText || <span className="text-white/30">(none)</span>}
            </p>
          ) : (
            <input
              type="text"
              value={filesText}
              onChange={(e) =>
                onChange({
                  files: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="app/login/page.tsx, components/LoginForm.tsx"
              className="w-full bg-black/30 border border-white/8 rounded-md px-2 py-1 text-[12.5px] text-white/85 placeholder:text-white/25 font-mono outline-none focus:border-white/25 transition-colors"
            />
          )}
        </Field>

        <Field label="Lines (optional)">
          {active ? (
            <p className="text-white/75 text-[12.5px] font-mono leading-[1.4]">
              {agent.lineRange || <span className="text-white/30">full file</span>}
            </p>
          ) : (
            <input
              type="text"
              value={agent.lineRange ?? ""}
              onChange={(e) => onChange({ lineRange: e.target.value })}
              placeholder="e.g. 1-50"
              className="w-full bg-black/30 border border-white/8 rounded-md px-2 py-1 text-[12.5px] text-white/85 placeholder:text-white/25 font-mono outline-none focus:border-white/25 transition-colors"
            />
          )}
        </Field>
      </div>

      {/* Response section — only when active */}
      {active && run && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-1.5">
            Response
          </div>
          {isError ? (
            <div className="text-red-300/90 text-[12.5px]">⚠ {run.error || "Failed"}</div>
          ) : run.text ? (
            <div
              className={[
                "text-[13.5px] leading-[1.55] whitespace-pre-wrap max-h-[360px] overflow-y-auto font-sans",
                decision === "skipped" ? "text-white/40 line-through" : "text-white/90",
              ].join(" ")}
            >
              {run.text}
              {isStreaming && <Caret />}
            </div>
          ) : isStreaming ? (
            <span className="text-white/30 text-[13px]">Thinking…</span>
          ) : (
            <span className="text-white/25 text-[13px]">No output</span>
          )}

          {/* Accept / Skip — Cursor's idiom in Veronum's clay accent.
           *  Renders only once the model is done; while streaming the
           *  user is still watching the answer take shape. Once the
           *  user picks, the buttons are replaced with a small pill
           *  echoing the decision so the action is reversible by
           *  intent (click the pill to undo). */}
          {!isStreaming && !isError && run.text && (
            <div className="mt-3 flex items-center gap-2">
              {decision === "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAccept?.(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium text-[#d97757] border border-[#d97757]/40 bg-[#d97757]/[0.08] hover:bg-[#d97757]/[0.16] hover:border-[#d97757] transition-colors"
                    aria-label={`Accept agent ${index + 1} response`}
                  >
                    <CheckIcon />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSkip?.(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium text-white/65 border border-white/15 bg-transparent hover:bg-white/[0.06] hover:text-white/90 hover:border-white/30 transition-colors"
                    aria-label={`Skip agent ${index + 1} response`}
                  >
                    <CloseIcon />
                    Skip
                  </button>
                </>
              ) : decision === "accepted" ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSkip?.(); /* allow flipping */ }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#d97757] border border-[#d97757]/40 bg-[#d97757]/[0.08]"
                  title="Click to undo accept"
                >
                  <CheckIcon />
                  Accepted
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAccept?.(); /* allow flipping */ }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white/55 border border-white/15"
                  title="Click to accept instead"
                >
                  <CloseIcon />
                  Skipped
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Compact 11×11 check — Cursor's accept indicator. */
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.5l2.5 2.5L9.5 3.5" />
    </svg>
  );
}

/** Compact 11×11 X — Cursor's reject indicator. */
function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}

function Field({
  label, warning, children,
}: {
  label: string;
  warning?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
          {label}
        </span>
        {warning && (
          <span className="text-[10px] text-amber-400/80 font-mono">{warning}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ run }: { run: RunState }) {
  const elapsed = useElapsed(run.startedAt, run.status === "streaming");
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
