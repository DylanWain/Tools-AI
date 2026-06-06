"use client";

/**
 * Multi-agent composer — Grok-style. ONE textarea for the master
 * goal, agents tucked behind a chip, attachments tucked behind a [+]
 * button on the LEFT (matches Veronum overlay's Composer pattern).
 *
 *   ┌── card (drop target) ───────────────────────────────────┐
 *   │ [chip] [chip] …                ← attachment strip       │
 *   │ What should the team build?                              │
 *   │                                                          │
 *   │ [+] [👥 3 agents]  [</> Code]    Enter   [Send all]     │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Enter sends, Shift+Enter newline. Drag-drop, paste, click [+]
 * all attach files.
 */

import { useEffect, useRef, useState } from "react";
import type { AgentSlot } from "@/lib/compare/sessions";
import type { Attachment } from "@/lib/compare/attachments";
import { revokeAttachment } from "@/lib/compare/attachments";
import {
  AttachmentChips,
  AttachmentDropTarget,
  PlusButton,
  useIngestFiles,
} from "./AttachmentRail";

type Props = {
  busy: boolean;
  goal: string;
  onGoalChange: (next: string) => void;
  agents: AgentSlot[];
  onOpenPicker: () => void;
  codeMode: boolean;
  onCodeModeChange: (next: boolean) => void;
  onSubmit: (attachments: Attachment[]) => void;
  onCancel: () => void;
  autoFocus?: boolean;
};

export function MultiAgentBar({
  busy, goal, onGoalChange, agents, onOpenPicker,
  codeMode, onCodeModeChange, onSubmit, onCancel, autoFocus,
}: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [hint, setHint] = useState(false);
  const ingest = useIngestFiles({ attachments, onChange: setAttachments });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [goal]);

  const anyPending = attachments.some((a) => a.pending);
  const missingFiles =
    codeMode && agents.length > 0 &&
    agents.some((a) => !(a.files ?? []).some((f) => f.trim()));

  const canSubmit =
    !busy &&
    goal.trim().length > 0 &&
    agents.length > 0 &&
    agents.every((a) => a.task.trim().length > 0) &&
    !missingFiles &&
    !anyPending;

  function handleSubmit() {
    if (!canSubmit) {
      setHint(true);
      setTimeout(() => setHint(false), 2000);
      return;
    }
    onSubmit(attachments);
    setAttachments([]);
  }

  return (
    <AttachmentDropTarget onFiles={ingest} disabled={busy}>
      <div className="border border-white/10 bg-[#161616] rounded-2xl focus-within:border-white/25 transition-colors shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <AttachmentChips
          attachments={attachments}
          onChange={(next) => {
            attachments
              .filter((a) => !next.some((n) => n.id === a.id))
              .forEach(revokeAttachment);
            setAttachments(next);
          }}
        />

        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
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
          placeholder="What should the team build? Enter sends, Shift+Enter for newline"
          rows={1}
          className="w-full bg-transparent text-white/95 placeholder:text-white/30 resize-none outline-none px-4 pt-3 pb-1 text-[15px] leading-[1.5]"
        />

        <div className="flex items-center justify-between mt-1 pl-2 pr-2 pb-2 gap-3">
          <div className="flex items-center gap-2">
            <PlusButton onFiles={ingest} disabled={busy} />
            <button
              type="button"
              onClick={onOpenPicker}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.04] text-white/80 hover:text-white text-[12px] font-medium transition-colors"
            >
              <AgentsIcon />
              <span>
                {agents.length === 0
                  ? "Add agents"
                  : `${agents.length} agent${agents.length === 1 ? "" : "s"}`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onCodeModeChange(!codeMode)}
              title={codeMode
                ? "Code mode ON — agents output ```lang:path blocks routed to the project tree"
                : "Code mode OFF — agents reply with free-form prose"}
              className={[
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors",
                codeMode
                  ? "border-[#d97757] text-white bg-[#d97757]/15"
                  : "border-white/10 text-white/60 hover:text-white hover:border-white/25 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <CodeIcon />
              <span>Code</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {hint && (
              <span className="text-[11px] text-amber-300/90 font-mono">
                {agents.length === 0
                  ? "Add at least one agent"
                  : missingFiles
                    ? "Each agent needs at least one owned file in code mode"
                    : "Add a master goal + task per agent"}
              </span>
            )}
            {!hint && anyPending && (
              <span className="text-[11px] text-white/40 font-mono">preparing…</span>
            )}
            {!hint && !anyPending && (
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-white/40 font-mono">
                Enter
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
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send all
              </button>
            )}
          </div>
        </div>
      </div>
    </AttachmentDropTarget>
  );
}

function AgentsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="8" cy="3.5" r="1.8" />
      <circle cx="3.5" cy="12" r="1.8" />
      <circle cx="12.5" cy="12" r="1.8" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5.5 4 L2 8 L5.5 12" />
      <path d="M10.5 4 L14 8 L10.5 12" />
    </svg>
  );
}
