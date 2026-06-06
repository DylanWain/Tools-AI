"use client";

/**
 * Code editor pane — Veronum dark theme. The body uses a darker
 * surface (#1f1e1c) than the file tree so the editor reads as the
 * "focus" of the workspace, with the chrome above (#2a2826) one
 * step lighter for hierarchy. No card borders — the editor is the
 * pane.
 */

import { useEffect, useRef, useState } from "react";
import type { ProjectFile } from "@/lib/compare/sessions";

type Props = {
  file: ProjectFile | undefined;
  onChange: (content: string) => void;
  /** Undo/redo wired from CompareChat against the edit log. When
   *  either is null the corresponding button is disabled. Tooltips
   *  describe what would be reverted/re-applied next. */
  canUndo: boolean;
  canRedo: boolean;
  undoTooltip: string;
  redoTooltip: string;
  onUndo: () => void;
  onRedo: () => void;
  onOpenVersionHistory: () => void;
};

export function CodeEditor({
  file, onChange,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory,
}: Props) {
  const [draft, setDraft] = useState<string>(file?.content ?? "");
  const editedRef = useRef(false);
  const lastPathRef = useRef<string | null>(file?.path ?? null);

  useEffect(() => {
    if (file?.path !== lastPathRef.current) {
      setDraft(file?.content ?? "");
      editedRef.current = false;
      lastPathRef.current = file?.path ?? null;
      return;
    }
    if (!editedRef.current && file && draft !== file.content) {
      setDraft(file.content);
    }
  }, [file, draft]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    editedRef.current = true;
    setDraft(v);
    onChange(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const v = draft.slice(0, start) + "  " + draft.slice(end);
      setDraft(v);
      editedRef.current = true;
      onChange(v);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col"
      style={{ background: "#000" }}
    >
      <header
        className="flex items-center justify-between px-3 h-9 shrink-0 gap-2"
        style={{
          background: "#000",
          borderBottom: "1px solid #1a1918",
        }}
      >
        <div
          className="truncate min-w-0"
          style={{
            fontSize: 12,
            color: file ? "#c3bdac" : "#7a766c",
            fontFamily: "var(--font-mono)",
          }}
        >
          {file ? file.path : "No file selected"}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Action buttons — always present so users can save / undo
              even when no file is open in the textarea. */}
          <ActionButton
            onClick={onUndo}
            disabled={!canUndo}
            title={undoTooltip}
            label="Undo"
            ariaLabel="Undo last edit"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 8 L2 5 L5 2" />
              <path d="M2 5 H10 a4 4 0 0 1 0 8 H7" />
            </svg>
          </ActionButton>
          <ActionButton
            onClick={onRedo}
            disabled={!canRedo}
            title={redoTooltip}
            label="Redo"
            ariaLabel="Redo last undo"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 8 L14 5 L11 2" />
              <path d="M14 5 H6 a4 4 0 0 0 0 8 H9" />
            </svg>
          </ActionButton>
          <ActionButton
            onClick={onOpenVersionHistory}
            disabled={false}
            title="Save / open version history"
            label="Versions"
            ariaLabel="Open version history"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4 V8 L10.5 9.5" />
            </svg>
          </ActionButton>

          {file && (
            <span aria-hidden style={{ width: 1, height: 14, background: "#1a1918", margin: "0 4px" }} />
          )}
          {file && !file.complete && (
            <span
              className="text-[10px] uppercase tracking-wider font-mono"
              style={{ color: "#d6b15b" }}
            >
              streaming
            </span>
          )}
          {file && (file.conflictingSlotIds ?? []).length > 0 && (
            <span
              className="text-[10px] uppercase tracking-wider font-mono"
              style={{ color: "#dd8265" }}
            >
              conflict
            </span>
          )}
          {file?.language && (
            <span
              className="text-[10px] uppercase tracking-wider font-mono"
              style={{ color: "#7a766c" }}
            >
              {file.language}
            </span>
          )}
        </div>
      </header>

      {!file ? (
        <div
          className="flex-1 min-h-0 flex items-center justify-center"
          style={{
            color: "#7a766c",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
          }}
        >
          Pick a file from the tree.
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
          className="flex-1 min-h-0 w-full outline-none resize-none whitespace-pre"
          style={{
            background: "#000",
            color: "#f0eee6",
            fontFamily: "var(--font-mono), 'SF Mono', ui-monospace, monospace",
            fontSize: 12.5,
            lineHeight: 1.55,
            padding: "12px 16px",
            tabSize: 2,
          }}
        />
      )}
    </div>
  );
}

function ActionButton({
  children, onClick, disabled, title, label, ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors"
      style={{
        fontSize: 11,
        color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-sans)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = "#fff";
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = "rgba(255,255,255,0.65)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
