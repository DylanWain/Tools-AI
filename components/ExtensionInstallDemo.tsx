"use client";

/**
 * ExtensionInstallDemo — autoplaying loop that recreates the user's
 * first moment with the extension. Same state-machine pattern as the
 * homepage demos (MultiAgentDemo, SharedSessionDemo): pure CSS +
 * useState, no animation library, ~6-second loop.
 *
 * Phases:
 *   1. idle           — fake ChatGPT chat visible, V button entering   (0.6 s)
 *   2. hoverV         — V button pulses                                  (0.8 s)
 *   3. menuOpen       — action menu fades up                             (0.4 s)
 *   4. clickShare     — "Share this chat live" highlights                (0.5 s)
 *   5. toast          — "Link copied" toast slides in                    (1.2 s)
 *   6. reset          — toast fades, menu collapses, loop restarts       (0.5 s)
 *
 * The conversation content is static, lifted from a plausible "I need
 * to refactor this auth flow" prompt so viewers immediately understand
 * what was being shared.
 */

import { useEffect, useState } from "react";

type Phase = "idle" | "hoverV" | "menuOpen" | "clickShare" | "toast" | "reset";

const PHASE_DURATIONS_MS: Record<Phase, number> = {
  idle: 600,
  hoverV: 800,
  menuOpen: 400,
  clickShare: 500,
  toast: 1200,
  reset: 500,
};

const PHASE_ORDER: Phase[] = [
  "idle",
  "hoverV",
  "menuOpen",
  "clickShare",
  "toast",
  "reset",
];

export function ExtensionInstallDemo() {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    const t = setTimeout(() => setPhase(next), PHASE_DURATIONS_MS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const vVisible = phase !== "reset";
  const vPulse = phase === "hoverV";
  const menuVisible =
    phase === "menuOpen" || phase === "clickShare" || phase === "toast";
  const shareHighlight = phase === "clickShare" || phase === "toast";
  const toastVisible = phase === "toast";

  return (
    <div className="relative w-full max-w-[820px] mx-auto">
      {/* Fake browser frame */}
      <div className="relative rounded-2xl overflow-hidden border border-ink/10 shadow-[0_24px_72px_-20px_rgba(20,20,19,0.18)] bg-white">
        {/* Traffic-light bar */}
        <div className="h-9 bg-ivory border-b border-ink/[0.08] flex items-center px-4 gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-1 rounded-md bg-white/80 border border-ink/[0.06] text-[11px] font-mono text-ink-faded">
              chatgpt.com
            </div>
          </div>
        </div>

        {/* Fake conversation */}
        <div className="px-6 sm:px-10 py-7 sm:py-9 bg-white min-h-[280px]">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-ink-faded mb-2">
            You
          </div>
          <div className="text-[14px] text-ink leading-[1.55] mb-6 max-w-[58ch]">
            Help me refactor this auth flow — the session refresh logic is
            duplicated across three middleware files. Should I extract it?
          </div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-ink-faded mb-2">
            ChatGPT
          </div>
          <div className="text-[14px] text-ink leading-[1.55] max-w-[58ch]">
            Yes — extract <code className="font-mono text-[12.5px] bg-ivory px-1.5 py-0.5 rounded">refreshSession()</code> into{" "}
            <code className="font-mono text-[12.5px] bg-ivory px-1.5 py-0.5 rounded">lib/auth/refresh.ts</code> and import it from
            each middleware. The three copies have drifted; this consolidates
            error handling in one place.
          </div>
        </div>

        {/* Floating V button — bottom-right of the fake browser */}
        <div
          className="absolute right-5 bottom-5 transition-all duration-300"
          style={{
            opacity: vVisible ? 1 : 0,
            transform: vVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="relative w-11 h-11 rounded-full bg-slate-dark text-ivory-light flex items-center justify-center shadow-[0_2px_10px_rgba(20,20,19,0.18)]"
            style={{
              transform: vPulse ? "scale(1.08)" : "scale(1)",
              transition: "transform 0.25s ease-out",
            }}
          >
            <span
              className="font-serif text-[18px] leading-none"
              style={{ marginTop: "-1px" }}
            >
              V
            </span>
            {vPulse && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-slate-dark animate-veronum-pulse"
              />
            )}
          </button>
        </div>

        {/* Action menu — appears above the V button */}
        <div
          className="absolute right-5 bottom-[72px] w-[260px] rounded-xl border border-ink/10 bg-ivory-light shadow-[0_12px_36px_rgba(20,20,19,0.16)] overflow-hidden transition-all duration-300 origin-bottom-right"
          style={{
            opacity: menuVisible ? 1 : 0,
            transform: menuVisible
              ? "translateY(0) scale(1)"
              : "translateY(8px) scale(0.96)",
            pointerEvents: "none",
          }}
        >
          <div className="px-3 py-2 border-b border-ink/[0.06] flex items-center gap-2">
            <span className="font-serif text-[14px] leading-none text-ink">V</span>
            <span className="text-[12px] font-medium text-ink">Veronum</span>
          </div>
          <MenuRow label="Run as 10 agents" pill="Pro" />
          <MenuRow
            label="Share this chat live"
            arrow="↗"
            highlight={shareHighlight}
          />
          <MenuRow label="Save to version history" arrow="↗" />
          <MenuRow label="Undo last AI edit" arrow="⌘Z" />
          <div className="bg-slate-dark text-ivory text-[12px] font-medium px-3 py-2.5 text-center">
            Get Veronum Desktop →
          </div>
        </div>

        {/* Toast — "Link copied" */}
        <div
          className="absolute right-5 bottom-[72px] bg-slate-dark text-ivory-light text-[12.5px] font-medium px-3.5 py-2 rounded-md shadow-[0_4px_14px_rgba(20,20,19,0.18)] transition-all duration-300"
          style={{
            opacity: toastVisible ? 1 : 0,
            transform: toastVisible
              ? "translateY(0)"
              : "translateY(8px)",
            pointerEvents: "none",
          }}
        >
          Shared — link copied
        </div>
      </div>

      {/* Caption underneath */}
      <p className="mt-6 text-center text-[13px] text-ink-faded font-mono">
        Click the <span className="font-serif text-ink">V</span> on any AI
        conversation → share, save, undo, or run as 10 agents in Veronum.
      </p>

      {/* Pulse keyframes — kept inline so the demo is self-contained */}
      <style>{`
        @keyframes veronum-pulse {
          0%   { opacity: 0.7; transform: scale(1); }
          70%  { opacity: 0;   transform: scale(1.45); }
          100% { opacity: 0;   transform: scale(1.5); }
        }
        .animate-veronum-pulse {
          animation: veronum-pulse 0.9s ease-out infinite;
        }
      `}</style>
    </div>
  );
}

function MenuRow({
  label,
  arrow,
  pill,
  highlight = false,
}: {
  label: string;
  arrow?: string;
  pill?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="px-3 py-2 flex items-center justify-between text-[13px] text-ink transition-colors"
      style={{
        background: highlight ? "var(--color-oat)" : "transparent",
      }}
    >
      <span className="flex items-center gap-2">
        {label}
        {pill && (
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.05em] bg-slate-dark text-ivory-light px-1.5 py-[1px] rounded">
            {pill}
          </span>
        )}
      </span>
      {arrow && (
        <span className="font-mono text-[11px] text-ink-faded">{arrow}</span>
      )}
    </div>
  );
}
