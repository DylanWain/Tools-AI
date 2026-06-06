"use client";

/**
 * Prompt input — multi-line textarea + send + attachments.
 *
 * Layout:
 *   ┌── card (drop target) ───────────────────────────────────┐
 *   │ [chip] [chip] [chip] …          ← attachment strip      │
 *   │                                                          │
 *   │  textarea …                                              │
 *   │                                                          │
 *   │ [+] [models]              ⌘+Enter   [Send]              │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Enter        → send
 * Shift+Enter  → newline
 * ⌘/Ctrl+Enter → send (kept for muscle memory)
 *
 * Drag-drop or paste files anywhere on the card to attach.
 */

import { useEffect, useRef, useState } from "react";
import { MODELS } from "@/lib/compare/models";
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
  onSubmit: (prompt: string, attachments: Attachment[]) => void;
  onCancel: () => void;
  selected: Set<string>;
  onOpenPicker: () => void;
  autoFocus?: boolean;
  placeholder?: string;
};

export function PromptBar({
  busy, onSubmit, onCancel, selected, onOpenPicker, autoFocus, placeholder,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const ingest = useIngestFiles({ attachments, onChange: setAttachments });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const anyPending = attachments.some((a) => a.pending);
  const selectedCount = MODELS.filter((m) => selected.has(m.id)).length;

  function handleSubmit() {
    const t = text.trim();
    if (busy || selectedCount === 0 || anyPending) return;
    if (!t && attachments.length === 0) return;
    onSubmit(t, attachments);
    setText("");
    // Don't revoke blob URLs here — CompareChat needs them to keep
    // rendering the user's chips in the "You asked" banner / project
    // view. Parent owns blob lifecycle from this point.
    setAttachments([]);
  }

  return (
    <AttachmentDropTarget onFiles={ingest} disabled={busy}>
      <div className="border border-white/10 bg-[#161616] rounded-2xl focus-within:border-white/25 transition-colors shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <AttachmentChips attachments={attachments} onChange={(next) => {
          // Caller may have just removed an item — revoke its blob URL.
          const removedIds = attachments
            .filter((a) => !next.some((n) => n.id === a.id))
            .map((a) => { revokeAttachment(a); return a.id; });
          if (removedIds.length === 0 && next === attachments) return;
          setAttachments(next);
        }} />

        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
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
          placeholder={
            placeholder ?? (
              selectedCount === 0
                ? "Pick models below, then ask anything…"
                : "Ask anything — Enter sends, Shift+Enter for newline"
            )
          }
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
              <ModelsIcon />
              <span>
                {selectedCount === 0
                  ? "Choose models"
                  : `${selectedCount} model${selectedCount === 1 ? "" : "s"}`}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {anyPending && (
              <span className="text-[11px] text-white/40 font-mono">
                preparing…
              </span>
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
                onClick={handleSubmit}
                disabled={
                  (!text.trim() && attachments.length === 0) ||
                  selectedCount === 0 ||
                  anyPending
                }
                className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </AttachmentDropTarget>
  );
}

function ModelsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="4" cy="4" r="1.8" />
      <circle cx="12" cy="4" r="1.8" />
      <circle cx="4" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
    </svg>
  );
}
