"use client";

/**
 * Fullscreen modal for reading a single response in full. Esc or
 * click-outside closes. Uses position:fixed instead of <dialog> so we
 * stay framework-agnostic and skip the hydration-flash that <dialog>
 * causes when client-rendered.
 */

import { useEffect } from "react";
import type { CompareModel } from "@/lib/compare/models";
import type { RunState } from "./useCompareStream";

type Props = {
  model: CompareModel;
  run: RunState;
  onClose: () => void;
};

export function ExpandedModal({ model, run, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Expanded response from ${model.label}`}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[920px] max-h-[100vh] sm:max-h-[90vh] bg-[#161616] sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-[#161616]">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-white text-[15px] font-medium truncate">{model.label}</h2>
            {run.startedAt && run.finishedAt && (
              <span className="text-[11px] text-white/40 font-mono">
                · {((run.finishedAt - run.startedAt) / 1000).toFixed(2)}s
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-[20px] leading-none w-8 h-8 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 text-white/95 text-[15.5px] leading-[1.65] whitespace-pre-wrap">
          {run.status === "error" ? (
            <div className="text-red-300">⚠ {run.error || "Failed"}</div>
          ) : run.text ? (
            run.text
          ) : (
            <span className="text-white/30">No content yet…</span>
          )}
        </div>
      </div>
    </div>
  );
}
