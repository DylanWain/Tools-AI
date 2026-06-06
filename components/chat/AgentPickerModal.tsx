"use client";

/**
 * Agents popup — same modal shell as ModelPickerModal, but its body
 * is a stack of per-agent rows (model + task + optional files + line
 * range). Opened from the [N agents] chip in MultiAgentBar.
 *
 * Dead-simple flow:
 *   - One row per agent (add up to 10)
 *   - Each row collapses to one line until clicked / focused
 *   - Code-mode-only fields tucked under a "details" expander so the
 *     default view stays clean for users who just want N parallel
 *     prompts without file scoping
 *   - "Done" closes the modal; selection persists in CompareChat
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MODELS, type CompareModel, type ProviderId } from "@/lib/compare/models";
import type { AgentSlot } from "@/lib/compare/sessions";
import { detectClaimOverlap } from "@/lib/compare/projectFiles";

const MAX_AGENTS = 10;

type Props = {
  agents: AgentSlot[];
  onChange: (next: AgentSlot[]) => void;
  onClose: () => void;
  codeMode: boolean;
  availableProviders: Set<ProviderId>;
};

export function AgentPickerModal({
  agents, onChange, onClose, codeMode, availableProviders,
}: Props) {
  const availableModels = MODELS.filter((m) => availableProviders.has(m.provider));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

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

  const overlaps = useMemo(
    () => detectClaimOverlap(
      agents.map((a, i) => ({ slotId: `agent-${i}`, files: a.files ?? [] })),
    ),
    [agents],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configure agents"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] max-h-[100vh] sm:max-h-[88vh] bg-[#161616] sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white text-[16px] font-medium">Configure agents</h2>
            <p className="text-white/40 text-[12px] mt-0.5">
              {codeMode
                ? "Each agent gets a task + the files it owns. Peers stay out of those files."
                : "Each agent gets its own model + task. Up to 10, all run in parallel."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-[22px] leading-none w-8 h-8 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {agents.length === 0 ? (
            <div className="px-3 py-10 text-center text-white/40 text-[13px]">
              No agents yet. Click <span className="text-white/70">+ Add agent</span> below.
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
                canRemove={agents.length > 1}
              />
            ))
          )}

          {overlaps.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90 text-[12px] leading-[1.45]">
              ⚠ {overlaps.length} file{overlaps.length === 1 ? "" : "s"} claimed by multiple agents — will be flagged red in the project tree if both write to it.
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 shrink-0 bg-[#161616]">
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
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full text-[14px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

function AgentRow({
  index, agent, models, codeMode, overlapPaths,
  onChange, onRemove, canRemove,
}: {
  index: number;
  agent: AgentSlot;
  models: CompareModel[];
  codeMode: boolean;
  overlapPaths: string[];
  onChange: (patch: Partial<AgentSlot>) => void;
  onRemove: () => void;
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
    <div className="group rounded-xl border border-white/8 bg-[#1f1f1f] px-3 py-2.5 hover:border-white/15 transition-colors">
      {/* Top row: agent label, model dropdown, remove */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-white/35 font-mono w-[58px] shrink-0">
          Agent {index + 1}
        </span>
        <select
          value={agent.modelId}
          onChange={(e) => onChange({ modelId: e.target.value })}
          className="bg-transparent text-white/85 text-[13px] font-medium border border-white/10 hover:border-white/25 focus:border-white/40 rounded-md px-2 py-1 outline-none transition-colors min-w-0 flex-1"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} className="bg-[#1f1f1f] text-white">
              {m.label}
            </option>
          ))}
        </select>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 inline-flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
            aria-label={`Remove agent ${index + 1}`}
            title="Remove agent"
          >
            ×
          </button>
        )}
      </div>

      <textarea
        ref={taRef}
        value={agent.task}
        onChange={(e) => onChange({ task: e.target.value })}
        placeholder="What does this agent do?"
        rows={1}
        className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none px-1 py-1 text-[14px] leading-[1.5]"
      />

      {codeMode && (
        <div className="mt-2 space-y-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-white/35 font-mono w-[58px] shrink-0">
              Files
            </label>
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
              className="flex-1 min-w-0 bg-black/30 border border-white/8 rounded-md px-2 py-1 text-[12.5px] text-white/85 placeholder:text-white/25 font-mono outline-none focus:border-white/25 transition-colors"
            />
          </div>
          {overlapPaths.length > 0 && (
            <div className="pl-[66px] text-[10px] text-amber-400/80 font-mono">
              shares with peers: {overlapPaths.slice(0, 3).join(", ")}
              {overlapPaths.length > 3 ? `, +${overlapPaths.length - 3}` : ""}
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-white/35 font-mono w-[58px] shrink-0">
              Lines
            </label>
            <input
              type="text"
              value={agent.lineRange ?? ""}
              onChange={(e) => onChange({ lineRange: e.target.value })}
              placeholder="optional — e.g. 1-50"
              className="flex-1 min-w-0 bg-black/30 border border-white/8 rounded-md px-2 py-1 text-[12.5px] text-white/85 placeholder:text-white/25 font-mono outline-none focus:border-white/25 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
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
