"use client";

/**
 * Inline multi-agent composer. Returns to the simplest shape:
 * master goal at the top, vertical stack of agent rows below
 * (each row is one short tile with model + task + remove), add
 * button, attach button, send. No modal. No fields hidden behind
 * popovers. Read it, type, send.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ MASTER GOAL                                          │
 *   │ ┌──────────────────────────────────────────────────┐ │
 *   │ │ What should the team build?                      │ │
 *   │ └──────────────────────────────────────────────────┘ │
 *   │ [chip] [chip]                                        │
 *   │                                                       │
 *   │ AGENTS (3/10)                                         │
 *   │  @1 [Claude Sonnet ▾] [ task .............. ]  ×    │
 *   │  @2 [GPT-4o          ▾] [ task .............. ]  ×    │
 *   │  @3 [Perplexity      ▾] [ task .............. ]  ×    │
 *   │  + Add agent                                          │
 *   │                                                       │
 *   │ [+]                          ⌘+Enter  [Send all (3)] │
 *   └──────────────────────────────────────────────────────┘
 *
 * Coordination is invisible to the user: every agent's system prompt
 * (built in useCompareStream.startWorkflow) names the master goal +
 * every peer's task, so agents stay in lane without the user
 * declaring file scopes.
 */

import { useEffect, useRef } from "react";
import { MODELS, type ProviderId } from "@/lib/compare/models";
import type { AgentSlot } from "@/lib/compare/sessions";
import type { Attachment } from "@/lib/compare/attachments";
import { revokeAttachment } from "@/lib/compare/attachments";
import {
  AttachmentChips,
  AttachmentDropTarget,
  PlusButton,
  useIngestFiles,
} from "./AttachmentRail";

const MAX_AGENTS = 10;

type Props = {
  goal: string;
  onGoalChange: (next: string) => void;
  agents: AgentSlot[];
  onAgentsChange: (next: AgentSlot[]) => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  availableProviders: Set<ProviderId>;
  autoFocus?: boolean;
};

export function MultiAgentComposer({
  goal, onGoalChange, agents, onAgentsChange,
  attachments, onAttachmentsChange,
  busy, onSubmit, onCancel,
  availableProviders, autoFocus,
}: Props) {
  const availableModels = MODELS.filter((m) => availableProviders.has(m.provider));
  const ingest = useIngestFiles({ attachments, onChange: onAttachmentsChange });

  const goalRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [goal]);

  function updateAgent(idx: number, patch: Partial<AgentSlot>) {
    onAgentsChange(agents.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function removeAgent(idx: number) {
    onAgentsChange(agents.filter((_, i) => i !== idx));
  }
  function addAgent() {
    if (agents.length >= MAX_AGENTS) return;
    const fallback = availableModels[0];
    if (!fallback) return;
    onAgentsChange([
      ...agents,
      { modelId: fallback.id, task: "" },
    ]);
  }

  const anyPending = attachments.some((a) => a.pending);
  const canSubmit =
    !busy &&
    !anyPending &&
    goal.trim().length > 0 &&
    agents.length > 0 &&
    agents.every((a) => a.task.trim().length > 0);

  return (
    <AttachmentDropTarget onFiles={ingest} disabled={busy}>
      <div className="border border-white/10 bg-[#161616] rounded-2xl focus-within:border-white/25 transition-colors shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        {/* Master goal */}
        <div className="px-4 pt-3 pb-2">
          <div className="text-[10px] uppercase tracking-[0.06em] text-white/40 font-mono mb-1.5">
            Master goal
          </div>
          <textarea
            ref={goalRef}
            autoFocus={autoFocus}
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (canSubmit) onSubmit();
              }
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              const files: File[] = [];
              for (const item of Array.from(items)) {
                if (item.kind === "file") {
                  const f = item.getAsFile();
                  if (f) files.push(f);
                }
              }
              if (files.length) {
                e.preventDefault();
                ingest(files);
              }
            }}
            placeholder="What should the team build together?"
            rows={1}
            className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none text-[14.5px] leading-[1.5]"
          />
        </div>

        <AttachmentChips
          attachments={attachments}
          onChange={(next) => {
            attachments
              .filter((a) => !next.some((n) => n.id === a.id))
              .forEach(revokeAttachment);
            onAttachmentsChange(next);
          }}
        />

        {/* Agents stack */}
        <div className="border-t border-white/5 px-3 pt-3 pb-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[10px] uppercase tracking-[0.06em] text-white/40 font-mono">
              Agents
            </span>
            <span className="text-[10px] text-white/35 font-mono">
              {agents.length}/{MAX_AGENTS}
            </span>
          </div>
          <div className="space-y-1.5">
            {agents.map((a, idx) => (
              <AgentRow
                key={idx}
                index={idx + 1}
                agent={a}
                models={availableModels}
                onChange={(p) => updateAgent(idx, p)}
                onRemove={() => removeAgent(idx)}
                onSubmit={() => canSubmit && onSubmit()}
                canRemove={agents.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addAgent}
              disabled={agents.length >= MAX_AGENTS}
              className="w-full inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <line x1="8" y1="3" x2="8" y2="13" />
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
              Add agent
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pl-2 pr-2 pb-2 pt-2 border-t border-white/5">
          <PlusButton onFiles={ingest} disabled={busy} />
          <div className="flex items-center gap-3">
            {anyPending && (
              <span className="text-[11px] text-white/40 font-mono">preparing…</span>
            )}
            {!anyPending && (
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-white/40 font-mono">
                ⌘ + Enter
              </span>
            )}
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
                Send all{agents.length > 0 ? ` (${agents.length})` : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </AttachmentDropTarget>
  );
}

function AgentRow({
  index, agent, models, onChange, onRemove, onSubmit, canRemove,
}: {
  index: number;
  agent: AgentSlot;
  models: typeof MODELS;
  onChange: (patch: Partial<AgentSlot>) => void;
  onRemove: () => void;
  onSubmit: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md hover:bg-white/[0.02] px-1.5 py-1">
      <span className="w-9 shrink-0 text-center text-[11px] font-mono text-white/55 select-none">
        @{index}
      </span>
      <select
        value={agent.modelId}
        onChange={(e) => onChange({ modelId: e.target.value })}
        className="shrink-0 w-[140px] bg-[#0f0f0f] border border-white/10 rounded-md px-2 py-1.5 text-[12px] text-white/85 outline-none focus:border-white/30 transition-colors"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id} className="bg-[#0f0f0f] text-white">
            {m.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={agent.task}
        onChange={(e) => onChange({ task: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={`Task for agent ${index}…`}
        className="flex-1 min-w-0 bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white/95 placeholder:text-white/25 outline-none focus:border-white/30 transition-colors"
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 inline-flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
          aria-label={`Remove agent ${index}`}
          title="Remove agent"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
