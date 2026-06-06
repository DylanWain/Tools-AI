"use client";

/**
 * Veronum-style multi-agent composer. Direct port of the desktop
 * overlay's AgentSlots popover (renderer/src/components/AgentSlots.tsx)
 * with one extension: each row picks its own model since the web side
 * doesn't have static @veronum-agent-N definitions.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Multi-agent composer       3 / 10 agents              × │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ MASTER TASK (OPTIONAL CONTEXT FOR ALL AGENTS)           │
 *   │ ┌─────────────────────────────────────────────────────┐ │
 *   │ │ What's the overall goal? …                          │ │
 *   │ └─────────────────────────────────────────────────────┘ │
 *   │ [chip][chip][+]                                         │
 *   │                                                          │
 *   │ SUB-TASKS (ONE PER AGENT, LEAVE BLANK TO SKIP)          │
 *   │ [@1 ][Claude▾][ Sub-task for agent 1                  ] │
 *   │ [@2 ][GPT-4o▾][ Sub-task for agent 2                  ] │
 *   │ [@3 ][Claude▾][ Sub-task for agent 3                  ] │
 *   │  ⋮                                                       │
 *   │ [@10][Sonar ▾][ Sub-task for agent 10                 ] │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Reset all                        Dispatch 3 agents      │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Modal anchors near the bottom-center of the viewport (mirrors the
 * desktop popover that opens from the chat composer). Active rows
 * brighten; blank rows fade to 0.78 opacity.
 *
 * Drafts persist to localStorage so a closed modal reopens with
 * everything intact — set up your 10 agents once, dispatch
 * repeatedly across sessions.
 */

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MODELS, type ProviderId } from "@/lib/compare/models";
import {
  type Attachment,
  revokeAttachment,
} from "@/lib/compare/attachments";
import {
  AttachmentChips,
  AttachmentDropTarget,
  PlusButton,
  useIngestFiles,
} from "./AttachmentRail";

const NUM_SLOTS = 10;
const STORAGE_KEY = "veronum.compare.dispatchDraft.v1";

export type DispatchSlot = {
  modelId: string;
  task: string;
};

type Draft = {
  master: string;
  slots: DispatchSlot[];
};

function loadDraft(defaultModelId: string): Draft {
  if (typeof window === "undefined") return blank(defaultModelId);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return blank(defaultModelId);
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const master = typeof parsed.master === "string" ? parsed.master : "";
    const fromDisk = Array.isArray(parsed.slots) ? parsed.slots : [];
    const slots: DispatchSlot[] = [];
    for (let i = 0; i < NUM_SLOTS; i++) {
      const d = fromDisk[i];
      slots.push({
        modelId: typeof d?.modelId === "string" ? d.modelId : defaultModelId,
        task: typeof d?.task === "string" ? d.task : "",
      });
    }
    return { master, slots };
  } catch {
    return blank(defaultModelId);
  }
}

function blank(defaultModelId: string): Draft {
  return {
    master: "",
    slots: Array.from({ length: NUM_SLOTS }, () => ({
      modelId: defaultModelId,
      task: "",
    })),
  };
}

function saveDraft(d: Draft) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  catch { /* quota — non-fatal */ }
}

type Props = {
  open: boolean;
  onClose: () => void;
  onDispatch: (goal: string, slots: DispatchSlot[], attachments: Attachment[]) => void;
  availableProviders: Set<ProviderId>;
};

export function AgentDispatchModal({ open, onClose, onDispatch, availableProviders }: Props) {
  const availableModels = useMemo(
    () => MODELS.filter((m) => availableProviders.has(m.provider)),
    [availableProviders],
  );
  const defaultModelId = availableModels[0]?.id ?? MODELS[0].id;

  const [draft, setDraft] = useState<Draft>(() => loadDraft(defaultModelId));
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const ingest = useIngestFiles({ attachments, onChange: setAttachments });

  // Persist on every change.
  useEffect(() => { saveDraft(draft); }, [draft]);

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const activeCount = draft.slots.filter((s) => s.task.trim().length > 0).length;
  const anyPending = attachments.some((a) => a.pending);
  const canDispatch =
    !anyPending && (activeCount > 0 || draft.master.trim().length > 0);

  function patchSlot(i: number, patch: Partial<DispatchSlot>) {
    setDraft((d) => ({
      ...d,
      slots: d.slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }

  function resetAll() {
    setDraft(blank(defaultModelId));
    attachments.forEach(revokeAttachment);
    setAttachments([]);
  }

  function dispatch() {
    if (!canDispatch) return;
    const liveSlots = draft.slots.filter((s) => s.task.trim().length > 0);
    onDispatch(draft.master, liveSlots, attachments);
    // Don't clear — Veronum's UX keeps the draft so users can iterate
    // and re-dispatch with tweaks. Reset is the explicit clear button.
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 sm:px-6 pb-6 sm:pb-24"
      onClick={onClose}
    >
      <AttachmentDropTarget onFiles={ingest}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[680px] max-h-[80vh] sm:max-h-[70vh] bg-[#161616] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        >
          {/* Header */}
          <header className="flex items-baseline gap-3 px-4 py-3 border-b border-white/10">
            <span className="font-serif text-white text-[17px] font-medium">
              Multi-agent composer
            </span>
            <span className="text-white/40 text-[11px] font-mono">
              {activeCount} / {NUM_SLOTS} agents
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 inline-flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-md transition"
              aria-label="Close"
              title="Close (Esc)"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <path d="M4 4l8 8M12 4L4 12" />
              </svg>
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
            <Label>Master task (optional context for all agents)</Label>
            <textarea
              value={draft.master}
              onChange={(e) => setDraft((d) => ({ ...d, master: e.target.value }))}
              placeholder="What's the overall goal? e.g. 'Build a login page with Stripe upgrade'"
              rows={2}
              className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white/95 placeholder:text-white/30 outline-none focus:border-white/30 transition-colors resize-y min-h-[56px]"
            />

            <AttachmentChips
              attachments={attachments}
              onChange={(next) => {
                attachments
                  .filter((a) => !next.some((n) => n.id === a.id))
                  .forEach(revokeAttachment);
                setAttachments(next);
              }}
            />
            <div>
              <PlusButton onFiles={ingest} />
            </div>

            <Label className="mt-1.5 mb-[-4px]">
              Sub-tasks (one per agent, leave blank to skip)
            </Label>

            {draft.slots.map((slot, i) => (
              <SlotRow
                key={i}
                index={i + 1}
                slot={slot}
                models={availableModels}
                onChange={(p) => patchSlot(i, p)}
                onEnter={dispatch}
              />
            ))}
          </div>

          {/* Footer */}
          <footer className="flex items-center gap-2 px-3 py-2.5 border-t border-white/10">
            <button
              type="button"
              onClick={resetAll}
              className="px-2.5 py-1.5 rounded-md text-[12px] text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Reset all
            </button>
            <div className="flex-1" />
            {anyPending && (
              <span className="text-[11px] text-white/40 font-mono mr-2">preparing…</span>
            )}
            <button
              type="button"
              onClick={dispatch}
              disabled={!canDispatch}
              className={[
                "px-4 py-2 rounded-lg text-[12.5px] font-medium transition-colors",
                canDispatch
                  ? "bg-[#d97757] text-white hover:bg-[#c6613f]"
                  : "bg-white/8 text-white/40 cursor-not-allowed",
              ].join(" ")}
            >
              {activeCount > 0
                ? `Dispatch ${activeCount} agent${activeCount === 1 ? "" : "s"}`
                : "Dispatch task"}
            </button>
          </footer>
        </div>
      </AttachmentDropTarget>
    </div>,
    document.body,
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={[
      "text-[10.5px] uppercase tracking-[0.06em] text-white/40 font-mono font-medium",
      className,
    ].filter(Boolean).join(" ")}>
      {children}
    </label>
  );
}

function SlotRow({
  index, slot, models, onChange, onEnter,
}: {
  index: number;
  slot: DispatchSlot;
  models: typeof MODELS;
  onChange: (patch: Partial<DispatchSlot>) => void;
  onEnter: () => void;
}) {
  const active = slot.task.trim().length > 0;
  return (
    <div
      className="flex items-stretch gap-2"
      style={{ opacity: active ? 1 : 0.72 }}
    >
      {/* @N tag (matches the desktop's @veronum-agent-N convention) */}
      <span
        className={[
          "w-[44px] shrink-0 inline-flex items-center justify-center rounded-md font-mono text-[11px] font-medium",
          active
            ? "text-white bg-white/[0.12]"
            : "text-white/45 bg-white/[0.04]",
        ].join(" ")}
        title={`Agent ${index}`}
      >
        @{index}
      </span>

      {/* Model picker — compact */}
      <select
        value={slot.modelId}
        onChange={(e) => onChange({ modelId: e.target.value })}
        className={[
          "shrink-0 w-[120px] bg-[#0f0f0f] border border-white/10 rounded-md px-2 py-1.5 text-[11.5px] outline-none focus:border-white/30 transition-colors",
          active ? "text-white/85" : "text-white/55",
        ].join(" ")}
        title="Model for this agent"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id} className="bg-[#0f0f0f] text-white">
            {m.label}
          </option>
        ))}
      </select>

      {/* Task input */}
      <input
        type="text"
        value={slot.task}
        onChange={(e) => onChange({ task: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={`Sub-task for agent ${index}`}
        className="flex-1 min-w-0 bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white/95 placeholder:text-white/25 outline-none focus:border-white/30 transition-colors"
      />
    </div>
  );
}
