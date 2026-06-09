"use client";

/**
 * ProjectRulesModal — the web-app equivalent of editing CLAUDE.md.
 *
 * User types their project rules (stack, code style, what to focus on
 * in reviews, anything they'd put in a CLAUDE.md). On Save the text is
 * persisted to localStorage via lib/compare/projectRules, and every
 * subsequent /compare send appends it to the system prompt so every
 * model in the grid follows the same project conventions.
 *
 * Pattern matches ExpandedModal: fixed inset-0 backdrop, click-outside
 * + Esc close, scroll lock while open.
 */

import { useEffect, useState } from "react";
import {
  loadProjectRules,
  saveProjectRules,
  PROJECT_RULES_MAX_CHARS,
} from "@/lib/compare/projectRules";

type Props = {
  onClose: () => void;
  /** Notify parent so it can re-read the rules for the next send and
   *  update any "Rules on/off" indicator in the chat header. */
  onSaved?: () => void;
};

export function ProjectRulesModal({ onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  // Load existing rules on open. localStorage read is sync but we use
  // useEffect to keep the component SSR-safe — loadProjectRules already
  // guards on `typeof window`, but doing it post-mount avoids the
  // hydration warning if the modal is ever rendered in a Server Component.
  useEffect(() => {
    setDraft(loadProjectRules());
  }, []);

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

  function onSave() {
    saveProjectRules(draft);
    setDirty(false);
    onSaved?.();
    onClose();
  }

  function onClear() {
    setDraft("");
    setDirty(true);
  }

  const remaining = PROJECT_RULES_MAX_CHARS - draft.length;
  const overLimit = remaining < 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project rules"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[760px] max-h-[100vh] sm:max-h-[88vh] bg-[#161616] sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col"
      >
        <header className="flex items-start justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white text-[16px] font-medium">Project rules</h2>
            <p className="text-white/50 text-[12.5px] mt-1 leading-[1.45]">
              Your CLAUDE.md. Paste your stack, conventions, what to focus on. Every model in the grid will follow these on every send.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-[20px] leading-none w-8 h-8 rounded-full hover:bg-white/10 transition shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 min-h-0 p-6 flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            spellCheck={false}
            placeholder={[
              "# Project rules",
              "",
              "Stack: Next.js 16 (App Router), TypeScript, Tailwind, Supabase.",
              "Style: small files (<150 LOC), no comments unless WHY is non-obvious.",
              "Focus: type safety, error handling at boundaries only.",
              "",
              "When proposing edits, cite file_path:line_number.",
            ].join("\n")}
            className="flex-1 min-h-[280px] w-full bg-[#0e0e0e] text-white/90 text-[13px] leading-[1.55] font-mono p-4 rounded-lg border border-white/10 focus:border-[#d97757]/60 outline-none resize-none"
          />
          <div className="flex items-center justify-between text-[11.5px] font-mono">
            <span className="text-white/40">
              {draft.length.toLocaleString()} chars
              {draft.length > 0 && (
                <> · ≈{Math.ceil(draft.length / 4).toLocaleString()} tokens added per send</>
              )}
            </span>
            <span className={overLimit ? "text-red-300/80" : "text-white/40"}>
              {overLimit ? `${(-remaining).toLocaleString()} over limit` : `${remaining.toLocaleString()} remaining`}
            </span>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-white/10 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={draft.length === 0}
            className="text-[12.5px] text-white/55 hover:text-red-300 transition disabled:opacity-30 disabled:hover:text-white/55"
          >
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition"
            >
              {dirty ? "Cancel" : "Close"}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={overLimit}
              className="px-4 py-2 text-[13px] bg-[#d97757] hover:bg-[#c66645] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white rounded-lg transition font-medium"
            >
              Save rules
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
