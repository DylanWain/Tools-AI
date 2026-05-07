/**
 * DemoHeader — exact recreation of the conversation header inside
 * ConversationScreen (renderer/src/App.tsx around line 940-1100).
 *
 * Order of right-side action buttons (matches the running app):
 *   MemberPresence avatars · UndoRedo · History · Share · Docs · Chat
 *
 * Plus the "X turns · mirroring · bound to <cwd>" status line below
 * (only shown for shared sessions).
 *
 * Then the tab pills row: Chat | Activity | Files (always visible
 * in v0.1.47 — see App.tsx line 1098).
 */

import type { ReactNode } from "react";

type Tab = "chat" | "activity" | "files";

type Props = {
  /** Big H2 — the session title */
  title: string;
  /** Whether the session is bound (Shared badge + status) */
  shared?: boolean;
  /** Number of turns to show in the status line */
  turnCount: number;
  /** Project bound-to path */
  cwd: string;
  /** Currently selected tab pill */
  activeTab: Tab;
  /** Optional pulse on a specific header button (for animation cues) */
  pulse?: "undo" | "redo" | "history" | "chat" | "share" | null;
  /** Show member presence avatars (shared sessions) */
  presence?: Array<{ name: string; color: string }>;
  /** Optional override children below the tabs (e.g. extra demo CTA) */
  belowTabs?: ReactNode;
};

export function DemoHeader({
  title,
  shared,
  turnCount,
  cwd,
  activeTab,
  pulse,
  presence,
  belowTabs,
}: Props) {
  return (
    <div className="px-7">
      {/* Title + right-side action buttons */}
      <div className="flex items-end justify-between gap-3 pt-1 pb-2.5">
        <h2
          className="font-serif text-ink leading-[1.1] truncate"
          style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-[2px] flex-shrink-0">
          {shared && presence && presence.length > 0 && (
            <div className="flex -space-x-1.5 mr-1">
              {presence.map((p, i) => (
                <span
                  key={i}
                  className="w-[20px] h-[20px] rounded-full flex items-center justify-center text-[9px] font-semibold text-white border-[1.5px] border-white"
                  style={{ background: p.color, zIndex: 10 - i }}
                  title={p.name}
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          {/* Undo/Redo */}
          <ActionPill pulse={pulse === "undo"} title="Undo last edit">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5v3h3" />
              <path d="M11 12a4 4 0 0 0-7-2.6L3 11" />
            </svg>
          </ActionPill>
          <ActionPill pulse={pulse === "redo"} title="Redo last edit">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 5v3h-3" />
              <path d="M5 12a4 4 0 0 1 7-2.6L13 11" />
            </svg>
          </ActionPill>
          {/* History */}
          <LabeledAction pulse={pulse === "history"} label="History">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4v4l2.5 2.5 M2 8a6 6 0 1 0 6-6 M2 4v3h3" />
            </svg>
          </LabeledAction>
          {/* Share */}
          <LabeledAction
            pulse={pulse === "share"}
            label={shared ? "Shared" : "Share"}
            variant={shared ? "ghost" : "solid"}
          >
            {shared ? (
              <span
                aria-hidden
                className="inline-block w-[6px] h-[6px] rounded-full"
                style={{ background: "#28c840" }}
              />
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v8M4 6l4-4 4 4M3 12v2h10v-2" />
              </svg>
            )}
          </LabeledAction>
          {/* Docs */}
          <LabeledAction label="Docs">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2h6l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM9 2v4h4" />
            </svg>
          </LabeledAction>
          {/* Team Chat */}
          <LabeledAction pulse={pulse === "chat"} label="Chat">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 4.5C2.5 3.948 2.948 3.5 3.5 3.5H12.5C13.052 3.5 13.5 3.948 13.5 4.5V10C13.5 10.552 13.052 11 12.5 11H6L3 13.5V11H3.5C2.948 11 2.5 10.552 2.5 10V4.5Z" />
            </svg>
          </LabeledAction>
        </div>
      </div>

      {/* Status line — turns · mirroring · bound */}
      <div
        className="text-[11px] mb-2 font-mono"
        style={{ color: "#8a8a82" }}
      >
        <span>
          {turnCount} turn{turnCount === 1 ? "" : "s"}
        </span>
        {shared && (
          <>
            <span className="ml-2" style={{ color: "#1f8c46" }}>
              · mirroring
            </span>
            <span className="ml-2">· bound to {cwd}</span>
          </>
        )}
      </div>

      {/* Tab pills */}
      <div className="flex items-center gap-[2px] mb-2">
        {(["chat", "activity", "files"] as const).map((t) => {
          const label = t === "chat" ? "Chat" : t === "activity" ? "Activity" : "Files";
          const active = activeTab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              className={`flex items-center h-[26px] px-2 rounded-md text-[13px] transition-colors ${
                active
                  ? "text-ink bg-ivory"
                  : "text-ink-faded hover:bg-ink/[0.04]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {belowTabs}
    </div>
  );
}

function ActionPill({
  children,
  pulse,
  title,
}: {
  children: ReactNode;
  pulse?: boolean;
  title?: string;
}) {
  return (
    <button
      title={title}
      className="flex items-center justify-center rounded-md transition-all"
      style={{
        width: 22,
        height: 22,
        color: pulse ? "#1a1a18" : "#5e5d59",
        background: pulse ? "rgba(20,20,19,0.06)" : "transparent",
        boxShadow: pulse ? "0 0 0 3px rgba(20,20,19,0.06)" : undefined,
      }}
    >
      <span className="block w-[13px] h-[13px]">{children}</span>
    </button>
  );
}

function LabeledAction({
  children,
  label,
  pulse,
  variant = "ghost",
}: {
  children: ReactNode;
  label: string;
  pulse?: boolean;
  variant?: "solid" | "ghost";
}) {
  const solid = variant === "solid";
  return (
    <button
      className="inline-flex items-center gap-1 h-[26px] px-2 rounded-md text-[12px] font-medium transition-all"
      style={{
        color: solid ? "#ffffff" : pulse ? "#1a1a18" : "#3d3d3a",
        background: solid
          ? "#1a1a18"
          : pulse
            ? "rgba(20,20,19,0.06)"
            : "transparent",
        boxShadow: pulse ? "0 0 0 3px rgba(20,20,19,0.06)" : undefined,
      }}
    >
      <span className="block w-[12px] h-[12px]">{children}</span>
      <span>{label}</span>
    </button>
  );
}
