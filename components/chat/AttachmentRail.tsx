"use client";

/**
 * Attachment rail — the plus button + chip strip used by both
 * PromptBar (compare mode) and MultiAgentBar (multi-agent mode).
 *
 * Layout when rendered:
 *
 *   ┌─ AttachmentChips (only if attachments.length > 0) ────────┐
 *   │ [📄 file.ts 1.2KB ×] [🖼 thumb screenshot.png 240KB ×]    │
 *   └───────────────────────────────────────────────────────────┘
 *
 *   ┌─ Composer (parent renders) ──────────────────────────────┐
 *   │ [+] What should the team build?                          │
 *   │                                                          │
 *   │      [👥 agents]  [</> code]      ⌘+Enter  [Send all]   │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ↑ The [+] is rendered by <PlusButton/> here; parents include
 *     it in their footer-left flex group. Chips render above.
 */

import { useCallback, useRef } from "react";
import {
  type Attachment,
  finishIngest,
  formatBytes,
  newAttachmentShell,
  revokeAttachment,
} from "@/lib/compare/attachments";

export type AttachmentRailProps = {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  disabled?: boolean;
};

/** Drop-target wrapper. Parents wrap their composer card in this so
 *  dragging a file anywhere over the composer triggers ingest. */
export function AttachmentDropTarget({
  onFiles, disabled, children, className,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={className}
    >
      {children}
    </div>
  );
}

/** Shared ingest helper — wires shell creation + async finish into
 *  the parent's setAttachments. Parents call this from their picker,
 *  paste, and drop handlers so the three entry points stay in sync. */
export function useIngestFiles({
  attachments, onChange,
}: { attachments: Attachment[]; onChange: (next: Attachment[]) => void }) {
  // Track latest attachments in a ref so async finishIngest patches
  // don't race with multiple parallel ingests.
  const ref = useRef(attachments);
  ref.current = attachments;

  return useCallback(async (files: File[]) => {
    const shells = files.map(newAttachmentShell);
    // Patch a LOCAL working copy synchronously as each file resolves.
    // Reading ref.current inside the loop raced: with several files
    // finishing in the same tick, each onChange saw the SAME stale ref
    // (it only updates on re-render) and clobbered the others' patches,
    // leaving images stuck on "preparing…" forever with Send disabled.
    let working = [...ref.current, ...shells];
    onChange(working);
    await Promise.all(
      shells.map(async (shell, i) => {
        const filled = await finishIngest(files[i], shell);
        working = working.map((a) => (a.id === shell.id ? filled : a));
        onChange(working);
      }),
    );
  }, [onChange]);
}

/** Left-edge plus button. Custom SVG (no emoji). Triggers the hidden
 *  multi-file picker. Same shape as the Veronum overlay's attach
 *  button so the visual stays familiar across surfaces. */
export function PlusButton({
  onFiles, disabled,
}: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Attach files or images — drag-drop and paste also work"
        aria-label="Attach files"
        className={[
          "w-9 h-9 inline-flex items-center justify-center rounded-full border transition-colors shrink-0",
          disabled
            ? "border-white/5 text-white/25 cursor-not-allowed"
            : "border-white/10 hover:border-white/25 hover:bg-white/[0.04] text-white/70 hover:text-white",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="8" y1="4" x2="8" y2="12" />
          <line x1="4" y1="8" x2="12" y2="8" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** Strip of attachment chips. Renders above the composer textarea. */
export function AttachmentChips({ attachments, onChange }: AttachmentRailProps) {
  if (attachments.length === 0) return null;
  function remove(id: string) {
    const target = attachments.find((a) => a.id === id);
    if (target) revokeAttachment(target);
    onChange(attachments.filter((a) => a.id !== id));
  }
  return (
    <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
      {attachments.map((a) => (
        <AttachmentChip key={a.id} a={a} onRemove={() => remove(a.id)} />
      ))}
    </div>
  );
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1f1f1f] border border-white/10 max-w-[280px]">
      {a.isImage && a.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.imageUrl}
          alt={a.name}
          className="w-5 h-5 object-cover rounded shrink-0"
        />
      ) : (
        <FileGlyph isPdf={a.isPdf} />
      )}
      <span className="text-[11.5px] text-white/85 truncate min-w-0">
        {a.name}
      </span>
      <span className="text-[10px] text-white/40 font-mono shrink-0">
        {a.pending ? "…" : formatBytes(a.bytes)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="w-4 h-4 inline-flex items-center justify-center text-white/40 hover:text-white shrink-0"
        aria-label={`Remove ${a.name}`}
      >
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}

function FileGlyph({ isPdf }: { isPdf: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/55 shrink-0"
      aria-hidden
    >
      <path d="M3.5 2h6L13 5.5V14H3.5z" />
      <path d="M9.5 2v3.5H13" />
      {isPdf && (
        <text x="5.5" y="11.5" fontSize="3" fill="currentColor" stroke="none">PDF</text>
      )}
    </svg>
  );
}
