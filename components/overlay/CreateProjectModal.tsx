"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#cc785c", "#5b8c7a", "#8a6dc4",
  "#d4a548", "#3a8bd0", "#c46686",
];

export function CreateProjectModal({
  onCreate,
  onCancel,
}: {
  onCreate: (input: { name: string; color: string }) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#cc785c");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  async function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), color });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-[3px] animate-[veronum-modal-fade_160ms_ease-out_forwards]"
      onClick={onCancel}
    >
      <div
        className="bg-[#faf9f5] w-[420px] max-w-[90vw] rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-black/[0.08] overflow-hidden animate-[veronum-modal-pop_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: '"Inter", system-ui, sans-serif' }}
      >
        <header className="px-5 py-4 border-b border-black/[0.06]">
          <h2
            className="text-[18px] font-medium text-[#1a1a18] leading-none"
            style={{ fontFamily: '"Newsreader", Georgia, serif' }}
          >
            New project
          </h2>
          <p className="text-[12px] text-[#7d7d76] mt-1">
            Creates a shared chat your team can join via invite link.
          </p>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.10em] text-[#9a9a93] font-mono block mb-1.5">
              Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Test team"
              className="w-full bg-white border border-black/[0.10] rounded-lg px-3 py-2 text-[14px] text-[#1a1a18] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-[0.10em] text-[#9a9a93] font-mono block mb-1.5">
              Color
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? "scale-110 ring-2 ring-offset-2 ring-[#1a1a18]/20" : "hover:scale-105"
                  }`}
                  style={{ background: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-black/[0.06] bg-[#f4f3ed] flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[12.5px] text-[#5a5a55] hover:bg-black/[0.04]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || submitting}
            className={`px-4 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${
              name.trim() && !submitting
                ? "bg-[#cc785c] text-white hover:bg-[#bb6a4f]"
                : "bg-black/[0.06] text-[#9a9a93] cursor-not-allowed"
            }`}
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </footer>

        <style jsx global>{`
          @keyframes veronum-modal-fade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes veronum-modal-pop {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
