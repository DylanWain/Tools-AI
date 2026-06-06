"use client";

/**
 * Multi-agent composer. Mirrors Veronum desktop's AgentSlots pattern:
 *
 *   ┌── Master goal (common task) ────────────────────────────┐
 *   │ Build a login page with Stripe upgrade                  │
 *   └─────────────────────────────────────────────────────────┘
 *
 *   ┌── Agent 1 · Claude Sonnet ─────────────────────────  ×  ┐
 *   │ Task: Build the login form                              │
 *   │ Owned files: components/LoginForm.tsx, app/login/...    │
 *   │ Line range (optional): full file                        │
 *   └─────────────────────────────────────────────────────────┘
 *
 *   [+ Add agent (3/10)]              [⌘+Enter] [Send all (3)]
 *
 * Code-mode toggle (top-right) tells each agent's system prompt to
 * output strict ```lang:path code blocks so the project view can
 * route them into a virtual file tree. Off = free-form prose.
 *
 * Up-front overlap detection warns the user if two agents claim
 * the same file (without disjoint line ranges) BEFORE they hit Send.
 */

import { useEffect, useMemo, useRef } from "react";
import { MODELS, type CompareModel, type ProviderId } from "@/lib/compare/models";
import type { AgentSlot } from "@/lib/compare/sessions";
import { detectClaimOverlap } from "@/lib/compare/projectFiles";

const MAX_AGENTS = 10;

type Props = {
  busy: boolean;
  goal: string;
  onGoalChange: (next: string) => void;
  agents: AgentSlot[];
  onChange: (next: AgentSlot[]) => void;
  codeMode: boolean;
  onCodeModeChange: (next: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  availableProviders: Set<ProviderId>;
};

export function AgentStack({
  busy, goal, onGoalChange, agents, onChange, codeMode, onCodeModeChange,
  onSubmit, onCancel, availableProviders,
}: Props) {
  const availableModels = MODELS.filter((m) => availableProviders.has(m.provider));

  function updateAgent(idx: number, patch: Partial<AgentSlot>) {
    onChange(agents.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function removeAgent(idx: number) {
    onChange(agents.filter((_, i) => i !== idx));
  }
  function addAgent() {
    if (agents.length >= MAX_AGENTS) return;
    const fallback = availableModels[0];
    if (!fallback) return;
    const mostUsed =
      agents.length === 0
        ? fallback.id
        : modeId(agents.map((a) => a.modelId)) || fallback.id;
    onChange([...agents, { modelId: mostUsed, task: "", files: [] }]);
  }

  // Up-front overlap detection: two agents claiming the same file
  // (regardless of line range — line ranges are free-text so we can't
  // reliably tell if they're disjoint without parsing).
  const overlaps = useMemo(
    () => detectClaimOverlap(
      agents.map((a, i) => ({ slotId: `agent-${i}`, files: a.files ?? [] })),
    ),
    [agents],
  );

  const canSubmit =
    !busy &&
    goal.trim().length > 0 &&
    agents.length > 0 &&
    agents.every((a) => a.task.trim().length > 0 && availableModels.some((m) => m.id === a.modelId)) &&
    // In code mode require at least one file per agent so the routing works
    (!codeMode || agents.every((a) => (a.files ?? []).some((f) => f.trim())));

  return (
    <div className="border border-white/10 bg-[#161616] rounded-2xl p-3 focus-within:border-white/25 transition-colors shadow-[0_10px_40px_rgba(0,0,0,0.35)] space-y-3">
      {/* Master goal */}
      <div className="rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-mono">
            Master goal
          </span>
          <CodeModeToggle on={codeMode} onChange={onCodeModeChange} />
        </div>
        <textarea
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="What should the whole team build together?"
          rows={2}
          className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none text-[14.5px] leading-[1.5]"
        />
      </div>

      {/* Agent rows */}
      <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
        {agents.length === 0 ? (
          <div className="px-3 py-6 text-center text-white/40 text-[13px]">
            No agents yet. Click <span className="text-white/70">+ Add agent</span> to start.
          </div>
        ) : (
          agents.map((a, idx) => (
            <AgentRow
              key={idx}
              index={idx}
              agent={a}
              models={availableModels}
              codeMode={codeMode}
              overlapPaths={overlaps
                .filter((o) => o.slotIds.includes(`agent-${idx}`))
                .map((o) => o.path)}
              onChange={(patch) => updateAgent(idx, patch)}
              onRemove={() => removeAgent(idx)}
              onSubmit={onSubmit}
              canRemove={agents.length > 1}
            />
          ))
        )}
      </div>

      {/* Overlap warning */}
      {overlaps.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90 text-[12px] leading-[1.45]">
          ⚠ {overlaps.length} file{overlaps.length === 1 ? "" : "s"} claimed by multiple agents.
          They'll be flagged red in the project tree if they conflict. Add line ranges or split tasks if you want full isolation.
        </div>
      )}

      {/* Footer — add / send */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={addAgent}
          disabled={agents.length >= MAX_AGENTS}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.04] text-white/80 hover:text-white text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon />
          Add agent
          <span className="text-white/40 font-mono text-[11px]">
            {agents.length}/{MAX_AGENTS}
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-white/40 font-mono">
            ⌘ + Enter
          </span>
          {busy ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-white/10 text-white hover:bg-white/15 transition"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send all {agents.length > 0 ? `(${agents.length})` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentRow({
  index, agent, models, codeMode, overlapPaths,
  onChange, onRemove, onSubmit, canRemove,
}: {
  index: number;
  agent: AgentSlot;
  models: CompareModel[];
  codeMode: boolean;
  overlapPaths: string[];
  onChange: (patch: Partial<AgentSlot>) => void;
  onRemove: () => void;
  onSubmit: () => void;
  canRemove: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [agent.task]);

  const filesText = (agent.files ?? []).join(", ");

  return (
    <div className="group rounded-xl border border-white/8 bg-[#1f1f1f] px-3 py-2 hover:border-white/15 transition-colors">
      {/* Row header — agent index, model, remove */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-white/35 font-mono">
          Agent {index + 1}
        </span>
        <span className="text-white/15">·</span>
        <select
          value={agent.modelId}
          onChange={(e) => onChange({ modelId: e.target.value })}
          className="bg-transparent text-white/85 text-[12.5px] font-medium border border-white/10 hover:border-white/25 focus:border-white/40 rounded-md px-2 py-0.5 outline-none transition-colors"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} className="bg-[#1f1f1f] text-white">
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-6 h-6 inline-flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
            aria-label={`Remove agent ${index + 1}`}
            title="Remove agent"
          >
            ×
          </button>
        )}
      </div>

      {/* Task */}
      <textarea
        ref={taRef}
        value={agent.task}
        onChange={(e) => onChange({ task: e.target.value })}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={`Task for agent ${index + 1}…`}
        rows={1}
        className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none px-1 py-1 text-[14px] leading-[1.5]"
      />

      {/* Code-mode fields */}
      {codeMode && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 pt-2 border-t border-white/5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-white/35 font-mono">
                Owned files
              </span>
              {overlapPaths.length > 0 && (
                <span className="text-[10px] text-amber-400/80 font-mono">
                  shares: {overlapPaths.slice(0, 2).join(", ")}
                  {overlapPaths.length > 2 ? `, +${overlapPaths.length - 2}` : ""}
                </span>
              )}
            </div>
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
              placeholder="comma-separated: app/login/page.tsx, components/LoginForm.tsx"
              className="w-full bg-black/30 border border-white/8 rounded-md px-2 py-1.5 text-[12.5px] text-white/85 placeholder:text-white/25 font-mono outline-none focus:border-white/25 transition-colors"
            />
          </div>
          <div className="md:w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-white/35 font-mono mb-1">
              Line range (optional)
            </div>
            <input
              type="text"
              value={agent.lineRange ?? ""}
              onChange={(e) => onChange({ lineRange: e.target.value })}
              placeholder="e.g. 1-50"
              className="w-full bg-black/30 border border-white/8 rounded-md px-2 py-1.5 text-[12.5px] text-white/85 placeholder:text-white/25 font-mono outline-none focus:border-white/25 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CodeModeToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className="text-[11px] uppercase tracking-wider text-white/50 font-mono">
        Code mode
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={[
          "relative inline-flex h-4 w-7 rounded-full transition-colors",
          on ? "bg-[#d97757]" : "bg-white/15",
        ].join(" ")}
      >
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(12px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}

function modeId(ids: string[]): string | null {
  if (ids.length === 0) return null;
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestN = 0;
  for (const id of ids) {
    const n = (counts.get(id) ?? 0) + 1;
    counts.set(id, n);
    if (n > bestN) { best = id; bestN = n; }
  }
  return best;
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
