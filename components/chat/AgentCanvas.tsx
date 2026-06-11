"use client";

/**
 * AgentCanvas — the whole multi-agent surface. Replaces the previous
 * MultiAgentBar + AgentPickerModal pattern. Every agent is visible as
 * its own card on the page; configuration and response live in the
 * same object so you can see the team at a glance.
 *
 *   ┌── master goal (also holds attachments + [+] button) ───┐
 *   │ Build a login page with Stripe                          │
 *   │ [chip] [chip] [+] ... ⌘+Enter [Send all] [+ Add agent]  │
 *   └─────────────────────────────────────────────────────────┘
 *
 *   ┌─ Agent 1 ─┐  ┌─ Agent 2 ─┐  ┌─ Agent 3 ─┐
 *   │ model     │  │ model     │  │ model     │
 *   │ task      │  │ task      │  │ task      │
 *   │ files     │  │ files     │  │ files     │
 *   │ lines     │  │ lines     │  │ lines     │
 *   │  response │  │  response │  │  response │   ← only when active
 *   └───────────┘  └───────────┘  └───────────┘
 *
 *   [+ Add agent (N/10)]                  ⌘+Enter [Send all (N)]
 *
 * Code mode is the default and only mode for multi-agent — no toggle.
 */

import { useCallback, useMemo, useState } from "react";
import { MODELS, type ProviderId } from "@/lib/compare/models";
import type { AgentSlot } from "@/lib/compare/sessions";
import type { Attachment } from "@/lib/compare/attachments";
import { revokeAttachment } from "@/lib/compare/attachments";
import { detectClaimOverlap } from "@/lib/compare/projectFiles";
import { AgentCard, type AgentDecision } from "./AgentCard";
import {
  AttachmentChips,
  AttachmentDropTarget,
  PlusButton,
  useIngestFiles,
} from "./AttachmentRail";
import type { RunSlot, RunState } from "./useCompareStream";

const MAX_AGENTS = 10;

type Props = {
  goal: string;
  onGoalChange: (next: string) => void;
  agents: AgentSlot[];
  onChange: (next: AgentSlot[]) => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  availableProviders: Set<ProviderId>;
  /** When a run is in flight or just finished, each card shows its
   *  response inline. lastSlots / runs come from CompareChat. */
  lastSlots: RunSlot[];
  getRun: (id: string) => RunState;
  favorite: string | null;
  setFavorite: (fn: (cur: string | null) => string | null) => void;
  setExpandedId: (id: string) => void;
};

export function AgentCanvas({
  goal, onGoalChange, agents, onChange,
  attachments, onAttachmentsChange,
  busy, onSubmit, onCancel,
  availableProviders,
  lastSlots, getRun, favorite, setFavorite, setExpandedId,
}: Props) {
  const availableModels = useMemo(
    () => MODELS.filter((m) => availableProviders.has(m.provider)),
    [availableProviders],
  );
  const ingest = useIngestFiles({ attachments, onChange: onAttachmentsChange });

  // Per-slot accept/skip — keyed by `agent-${idx}` to match getRun's id.
  // Local to this multi-agent flow: each new send resets via the
  // `lastSlots` change effect below (covered by clearing on send).
  // The decision flips between accepted ↔ skipped on re-click so users
  // can correct a misclick without a separate "undo" affordance.
  const [decisions, setDecisions] = useState<Map<string, AgentDecision>>(
    () => new Map(),
  );
  const setDecision = useCallback((slotId: string, next: AgentDecision) => {
    setDecisions((prev) => {
      const m = new Map(prev);
      m.set(slotId, next);
      return m;
    });
  }, []);
  const onAccept = useCallback(
    (slotId: string) =>
      setDecision(
        slotId,
        decisions.get(slotId) === "accepted" ? "pending" : "accepted",
      ),
    [decisions, setDecision],
  );
  const onSkip = useCallback(
    (slotId: string) =>
      setDecision(
        slotId,
        decisions.get(slotId) === "skipped" ? "pending" : "skipped",
      ),
    [decisions, setDecision],
  );

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

  const anyPending = attachments.some((a) => a.pending);
  const hasActiveRuns = lastSlots.length > 0;
  const canSubmit =
    !busy &&
    !hasActiveRuns &&  // lock the canvas after a send — click New chat to iterate
    goal.trim().length > 0 &&
    agents.length > 0 &&
    agents.every((a) => a.task.trim().length > 0 && (a.files ?? []).some((f) => f.trim())) &&
    !anyPending;

  return (
    <div className="space-y-4">
      {/* Master goal — drop target wraps so a file dropped ANYWHERE
          on the goal card attaches to the batch. */}
      <AttachmentDropTarget onFiles={ingest} disabled={busy || hasActiveRuns}>
        <div className="border border-white/10 bg-[#161616] rounded-2xl focus-within:border-white/25 transition-colors shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          <div className="px-4 pt-3 pb-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-1">
              Master goal
            </div>
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

          <textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
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
            readOnly={hasActiveRuns}
            rows={2}
            className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none px-4 pb-2 text-[15px] leading-[1.5]"
          />

          <div className="flex items-center justify-between mt-1 pl-2 pr-2 pb-2 gap-3">
            <PlusButton onFiles={ingest} disabled={busy || hasActiveRuns} />
            <div className="flex items-center gap-3">
              {anyPending && (
                <span className="text-[11px] text-white/40 font-mono">preparing…</span>
              )}
              {!anyPending && !hasActiveRuns && (
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

      {overlaps.length > 0 && !hasActiveRuns && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90 text-[12px] leading-[1.45]">
          ⚠ {overlaps.length} file{overlaps.length === 1 ? "" : "s"} claimed by multiple agents — will be flagged red in the project tree if both write to it.
        </div>
      )}

      {/* Agent canvas — responsive grid of cards. 1 col → 2 col → 3 col
          as the viewport widens, so all agents stay visible without
          scrolling within the card. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((a, idx) => {
          const slotId = `agent-${idx}`;
          const matchedRun = lastSlots.find((s) => s.id === slotId) ? getRun(slotId) : undefined;
          return (
            <AgentCard
              key={idx}
              index={idx}
              agent={a}
              models={availableModels}
              overlapPaths={overlaps
                .filter((o) => o.slotIds.includes(slotId))
                .map((o) => o.path)}
              run={matchedRun}
              isFavorite={favorite === slotId}
              onToggleFavorite={() => setFavorite((cur) => (cur === slotId ? null : slotId))}
              onExpand={() => setExpandedId(slotId)}
              onChange={(patch) => updateAgent(idx, patch)}
              onRemove={() => removeAgent(idx)}
              canRemove={agents.length > 1}
              decision={decisions.get(slotId) ?? "pending"}
              onAccept={() => onAccept(slotId)}
              onSkip={() => onSkip(slotId)}
            />
          );
        })}

        {/* "Add agent" tile rendered alongside the cards so it looks
            like another slot waiting to be filled, not a tacked-on
            footer button. */}
        {!hasActiveRuns && agents.length < MAX_AGENTS && (
          <button
            type="button"
            onClick={addAgent}
            className="rounded-xl border border-dashed border-white/15 hover:border-white/35 hover:bg-white/[0.03] text-white/50 hover:text-white/85 transition-colors min-h-[140px] flex flex-col items-center justify-center gap-2"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="6" x2="12" y2="18" />
              <line x1="6" y1="12" x2="18" y2="12" />
            </svg>
            <span className="text-[12.5px] font-medium">
              Add agent
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/30 font-mono">
              {agents.length}/{MAX_AGENTS}
            </span>
          </button>
        )}
      </div>
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
