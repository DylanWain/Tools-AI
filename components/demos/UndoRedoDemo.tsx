"use client";

/**
 * UndoRedoDemo — auto-playing recreation of Veronum's Undo/Redo +
 * Version History flow. Single window. Shows Claude making an edit,
 * the user undoing it, redoing it, then opening the History modal
 * to revert to a deeper snapshot.
 *
 * Visual references (verified against veronum-overlay@v0.1.47):
 *   - Header buttons: UndoRedoButtons.tsx + HistoryModal entry-point
 *     (App.tsx 956-984)
 *   - HistoryModal layout (renderer/src/components/HistoryModal.tsx)
 *   - Activity-row diff styling (ActivityTab inline expand)
 *
 * Phase machine:
 *   1. idle         — chat thread visible (1.4 s)
 *   2. claudeEdits  — Claude assistant turn with "Edited 1 file"
 *                     diff card, edit-stack indicator pulses (3 s)
 *   3. clickUndo    — Undo button pulses (0.4 s)
 *   4. reverted     — diff flips to "Reverted" state (1.6 s)
 *   5. clickRedo    — Redo button pulses (0.4 s)
 *   6. redone       — diff re-applies (1.6 s)
 *   7. clickHistory — History button pulses (0.4 s)
 *   8. historyOpen  — HistoryModal portal slides up + snapshots
 *                     populate (4 s)
 *   9. historyHover — user hovers a snapshot, "Revert" CTA highlights
 *                     (1.4 s)
 *  10. historyClose — modal fades, no actual revert (0.5 s)
 *  11. reset        — fade everything (1 s) → loop
 */

import { useEffect, useState } from "react";
import { DemoShell } from "./DemoShell";
import { DemoHeader } from "./DemoHeader";
import { DemoComposer } from "./DemoComposer";
import { DemoMessage } from "./DemoMessage";

type Phase =
  | "idle"
  | "claudeEdits"
  | "clickUndo"
  | "reverted"
  | "clickRedo"
  | "redone"
  | "clickHistory"
  | "historyOpen"
  | "historyHover"
  | "historyClose"
  | "reset";

const SNAPSHOTS = [
  { sha: "f4e8a21", message: "session middleware: drop legacy cookie path", whenLabel: "now", files: 3 },
  { sha: "3b91f0c", message: "auth: rename getSessionFromCookie → resolveSession", whenLabel: "1m ago", files: 2 },
  { sha: "1d9e240", message: "feat: add request-bound user context", whenLabel: "5m ago", files: 5 },
  { sha: "8217afe", message: "fix: stop sending session cookie on cross-origin", whenLabel: "12m ago", files: 1 },
  { sha: "a6c0e3d", message: "wip: scaffold new auth middleware", whenLabel: "32m ago", files: 8 },
  { sha: "0b51294", message: "chore: bump session crypto deps to 4.x", whenLabel: "1h ago", files: 2 },
];

export function UndoRedoDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [hoverIdx, setHoverIdx] = useState(2);

  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("claudeEdits"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "claudeEdits") {
      const t = setTimeout(() => setPhase("clickUndo"), 3000);
      return () => clearTimeout(t);
    }
    if (phase === "clickUndo") {
      const t = setTimeout(() => setPhase("reverted"), 420);
      return () => clearTimeout(t);
    }
    if (phase === "reverted") {
      const t = setTimeout(() => setPhase("clickRedo"), 1600);
      return () => clearTimeout(t);
    }
    if (phase === "clickRedo") {
      const t = setTimeout(() => setPhase("redone"), 420);
      return () => clearTimeout(t);
    }
    if (phase === "redone") {
      const t = setTimeout(() => setPhase("clickHistory"), 1600);
      return () => clearTimeout(t);
    }
    if (phase === "clickHistory") {
      const t = setTimeout(() => setPhase("historyOpen"), 420);
      return () => clearTimeout(t);
    }
    if (phase === "historyOpen") {
      const t = setTimeout(() => setPhase("historyHover"), 3500);
      return () => clearTimeout(t);
    }
    if (phase === "historyHover") {
      let i = 1;
      const id = setInterval(() => {
        setHoverIdx(i);
        i = (i + 1) % SNAPSHOTS.length;
      }, 600);
      const t = setTimeout(() => {
        clearInterval(id);
        setPhase("historyClose");
      }, 2000);
      return () => {
        clearInterval(id);
        clearTimeout(t);
      };
    }
    if (phase === "historyClose") {
      const t = setTimeout(() => setPhase("reset"), 500);
      return () => clearTimeout(t);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setHoverIdx(2);
        setPhase("idle");
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const showEditCard =
    phase === "claudeEdits" ||
    phase === "clickUndo" ||
    phase === "reverted" ||
    phase === "clickRedo" ||
    phase === "redone" ||
    phase === "clickHistory" ||
    phase === "historyOpen" ||
    phase === "historyHover" ||
    phase === "historyClose";
  const isReverted = phase === "reverted" || phase === "clickRedo";
  const headerPulse =
    phase === "clickUndo"
      ? "undo"
      : phase === "clickRedo"
        ? "redo"
        : phase === "clickHistory"
          ? "history"
          : null;
  const modalOpen = phase === "historyOpen" || phase === "historyHover";
  const modalClosing = phase === "historyClose";

  return (
    <DemoShell
      cwd="T3 Tools"
      sessionTitle="Refactor session middleware"
      activeProjectName="T3 Tools"
      activeSessionTitle="Refactor session middleware"
      badge={
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faded">
          Pro · auto-snapshot every 5 s
        </span>
      }
    >
      <DemoHeader
        title="Refactor session middleware"
        shared
        turnCount={showEditCard ? 7 : 6}
        cwd="~/T3 Tools"
        activeTab="chat"
        pulse={headerPulse}
      />

      <div className="px-7 pb-2 overflow-hidden flex flex-col gap-4 h-[calc(100%-200px)]">
        <DemoMessage
          authorName="dylan"
          authorColor="#7d7d76"
          ts="3m ago"
          body="Drop the legacy cookie path in session middleware."
        />
        <DemoMessage
          isAi
          authorName="claude"
          ts="2m ago"
          body="On it — rewriting apps/server/src/middleware/session.ts to read from the bearer token only."
        />

        {showEditCard && (
          <DemoMessage
            isAi
            authorName="claude"
            ts="now"
            body={
              <div className="space-y-2">
                <div>
                  Updated session resolution to drop the cookie-fallback
                  path. Wrote the change to{" "}
                  <span className="font-mono text-[12px] text-ink/85">
                    apps/server/src/middleware/session.ts
                  </span>
                  .
                </div>
                <EditDiffCard reverted={isReverted} />
                {phase === "reverted" && (
                  <div
                    className="flex items-center gap-2 text-[11.5px] font-mono"
                    style={{ color: "#1f8c46" }}
                  >
                    <span aria-hidden>↶</span>
                    <span>
                      Reverted via Undo · file restored from auto-snapshot
                      5 s ago
                    </span>
                  </div>
                )}
                {phase === "redone" && (
                  <div
                    className="flex items-center gap-2 text-[11.5px] font-mono"
                    style={{ color: "#1a1a18" }}
                  >
                    <span aria-hidden>↷</span>
                    <span>Redo applied · diff is back</span>
                  </div>
                )}
              </div>
            }
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-7 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
        <DemoComposer value="" cursor={false} />
      </div>

      {/* History modal slide-up */}
      {modalOpen && (
        <HistoryModalOverlay
          closing={modalClosing}
          hoverIdx={hoverIdx}
          phase={phase}
        />
      )}
      {modalClosing && (
        <HistoryModalOverlay
          closing
          hoverIdx={hoverIdx}
          phase={phase}
        />
      )}
    </DemoShell>
  );
}

/**
 * Inline diff preview card — mirrors how the Activity tab inline-
 * expands a file change into a unified diff (FilesTab + ActivityTab
 * both use this rendering style).
 */
function EditDiffCard({ reverted }: { reverted: boolean }) {
  return (
    <div
      className="rounded-md border border-ink/[0.10] overflow-hidden font-mono text-[11.5px]"
      style={{
        background: reverted ? "rgba(255,251,247,1)" : "#fafaf6",
        opacity: reverted ? 0.55 : 1,
      }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink/[0.03] border-b border-ink/[0.06]">
        <span className="text-[11px] uppercase tracking-[0.06em] text-ink-faded">
          apps/server/src/middleware/session.ts
        </span>
        <span className="text-[10.5px] text-ink-faded">+8 / -12</span>
      </div>
      <pre className="m-0 px-3 py-2 leading-[1.55] whitespace-pre overflow-x-auto">
        <DiffLine sign="-" reverted={reverted}>
          export async function getSession(req) {"{"}
        </DiffLine>
        <DiffLine sign="-" reverted={reverted}>
          {"  "}const cookie = req.headers.cookie?.match(/sid=([^;]+)/);
        </DiffLine>
        <DiffLine sign="-" reverted={reverted}>
          {"  "}if (cookie) return resolveLegacy(cookie[1]);
        </DiffLine>
        <DiffLine sign="+" reverted={reverted}>
          export async function resolveSession(req) {"{"}
        </DiffLine>
        <DiffLine sign="+" reverted={reverted}>
          {"  "}const bearer = req.headers.authorization?.slice(7);
        </DiffLine>
        <DiffLine sign="+" reverted={reverted}>
          {"  "}if (!bearer) throw new HttpError(401, &quot;missing bearer&quot;);
        </DiffLine>
        <DiffLine sign="+" reverted={reverted}>
          {"  "}return store.lookup(bearer);
        </DiffLine>
        <DiffLine sign=" " reverted={reverted}>
          {"}"}
        </DiffLine>
      </pre>
    </div>
  );
}

function DiffLine({
  sign,
  reverted,
  children,
}: {
  sign: "+" | "-" | " ";
  reverted: boolean;
  children: React.ReactNode;
}) {
  const bg =
    sign === "+" && !reverted
      ? "rgba(31,140,70,0.10)"
      : sign === "-" && !reverted
        ? "rgba(204,86,86,0.10)"
        : "transparent";
  const color =
    sign === "+" && !reverted
      ? "#1f8c46"
      : sign === "-" && !reverted
        ? "#a04141"
        : "#3d3d3a";
  return (
    <div
      className="flex"
      style={{ background: bg, color }}
    >
      <span className="w-5 text-center select-none flex-shrink-0">{sign}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

/** Mirrors HistoryModal.tsx layout — centered card, snapshot list. */
function HistoryModalOverlay({
  closing,
  hoverIdx,
  phase,
}: {
  closing: boolean;
  hoverIdx: number;
  phase: Phase;
}) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center px-6 pb-16 pt-8 transition-all duration-200"
      style={{
        background: closing ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.30)",
        backdropFilter: closing ? "blur(0)" : "blur(2px)",
        opacity: closing ? 0 : 1,
        pointerEvents: closing ? "none" : "auto",
      }}
    >
      <div
        className="bg-white border border-ink/[0.10] rounded-[10px] flex flex-col overflow-hidden animate-[demoPopIn_0.2s_cubic-bezier(0.32,0.72,0,1)_forwards]"
        style={{
          width: "min(620px, 100%)",
          maxHeight: "82%",
          boxShadow:
            "0 0 0 0.5px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.10)",
        }}
      >
        {/* Header */}
        <div className="flex items-baseline gap-3 px-4 py-3.5 border-b border-ink/[0.08]">
          <span
            className="font-serif text-ink"
            style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.018em" }}
          >
            Version history
          </span>
          <span className="font-mono text-[11px] text-ink-faded">
            {SNAPSHOTS.length} snapshots · ~/T3 Tools
          </span>
          <button className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-ink/85 hover:bg-ink/[0.04]">
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v5h4M8 13a5 5 0 1 0-3.5-1.5" />
            </svg>
            Save snapshot now
          </button>
          <button
            aria-label="Close"
            className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-ink-faded hover:bg-ink/[0.04]"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              width={13}
              height={13}
            >
              <path d="M4 4l8 8M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Snapshot list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {SNAPSHOTS.map((s, i) => {
            const hover = i === hoverIdx && phase === "historyHover";
            const isHead = i === 0;
            return (
              <div
                key={s.sha}
                className="rounded-md border transition-colors"
                style={{
                  background: hover ? "rgba(20,20,19,0.04)" : "transparent",
                  borderColor: hover
                    ? "rgba(20,20,19,0.10)"
                    : "transparent",
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span
                    className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                    style={{
                      background: isHead ? "#1f8c46" : "#b0aea5",
                    }}
                  />
                  <span className="font-mono text-[11.5px] text-ink-faded tabular-nums w-[58px] flex-shrink-0">
                    {s.sha}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-ink leading-tight truncate">
                      {s.message}
                    </div>
                    <div className="font-mono text-[10.5px] text-ink-faded mt-0.5">
                      {s.whenLabel} · {s.files} file{s.files === 1 ? "" : "s"}
                      {isHead && " · current"}
                    </div>
                  </div>
                  {hover && (
                    <button
                      className="px-2.5 py-1 rounded-md bg-ink text-white text-[11.5px] font-medium animate-[demoPopIn_0.15s_cubic-bezier(0.32,0.72,0,1)_forwards]"
                    >
                      Revert
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-4 py-2.5 border-t border-ink/[0.08] font-mono text-[10.5px] text-ink-faded">
          Snapshots live in ~/Library/Application Support/Veronum/history/.
          Revert runs <span>git checkout &lt;sha&gt; -- .</span> in the bound cwd.
        </div>
      </div>
    </div>
  );
}
