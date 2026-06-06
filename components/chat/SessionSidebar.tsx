"use client";

/**
 * Left sidebar — Grok-styled. Pure-black surface that bleeds into the
 * main pane (no dividing border), with subtle rounded-pill highlights
 * for the active session.
 *
 * Layout:
 *   ┌──────────────────────────┐
 *   │ [V mark]            [«]  │  collapse toggle
 *   ├──────────────────────────┤
 *   │ [edit-pencil] New chat   │
 *   ├──────────────────────────┤
 *   │ history ⌄                │
 *   │   today                  │
 *   │   • session a            │
 *   │   • session b            │
 *   │   earlier                │
 *   │   • session c            │
 *   └──────────────────────────┘
 *
 * Hidden on screens smaller than lg so the chat surface stays usable
 * on phones.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CompareSession } from "@/lib/compare/sessions";
import { VeronumMark } from "@/components/VeronumMark";

type Props = {
  sessions: CompareSession[];
  currentId: string | null;
  onNewChat: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
};

export function SessionSidebar({ sessions, currentId, onNewChat, onLoad, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const buckets = useMemo(() => bucketByRecency(sessions), [sessions]);

  if (collapsed) {
    return (
      <aside className="hidden lg:flex w-[56px] shrink-0 flex-col bg-black items-center pt-3 gap-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-9 h-9 inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] rounded-lg transition"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRight />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="w-9 h-9 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06] rounded-lg transition"
          aria-label="New chat"
          title="New chat"
        >
          <EditIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col bg-black">
      {/* Brand row + collapse */}
      <div className="h-14 px-3 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2 text-white/95 hover:text-white">
          <VeronumMark className="h-7 w-7 rounded-md" />
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 inline-flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] rounded-md transition"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeftDouble />
        </button>
      </div>

      {/* New chat — full-width row */}
      <div className="px-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-white/90 hover:text-white text-[14px] font-medium transition-colors"
        >
          <EditIcon />
          New chat
        </button>
      </div>

      {/* History section */}
      <div className="flex-1 overflow-y-auto px-2 mt-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center gap-1 px-3 py-1.5 text-white/70 hover:text-white text-[13px] font-medium transition-colors"
        >
          <span>History</span>
          <Caret open={historyOpen} />
        </button>

        {historyOpen && (
          <div className="mt-1">
            {sessions.length === 0 ? (
              <p className="text-[12px] text-white/30 px-3 py-2 leading-[1.5]">
                Nothing yet. Send a prompt to create your first session.
              </p>
            ) : (
              <>
                {buckets.map(({ label, items }) =>
                  items.length === 0 ? null : (
                    <section key={label} className="mt-2">
                      <div className="text-[11px] text-white/35 px-3 mb-1 lowercase">
                        {label}
                      </div>
                      <ul className="space-y-0.5">
                        {items.map((s) => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            active={s.id === currentId}
                            onLoad={() => onLoad(s.id)}
                            onDelete={() => onDelete(s.id)}
                          />
                        ))}
                      </ul>
                    </section>
                  ),
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function SessionRow({
  session, active, onLoad, onDelete,
}: {
  session: CompareSession;
  active: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={[
        "group relative rounded-lg",
        active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onLoad}
        className="w-full text-left px-3 py-1.5 pr-9 block"
        title={session.title}
      >
        <div
          className={[
            "text-[13.5px] leading-[1.35] truncate",
            active ? "text-white" : "text-white/80",
          ].join(" ")}
        >
          {session.title}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this session?")) onDelete();
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete session"
        title="Delete"
      >
        ×
      </button>
    </li>
  );
}

// ── Time bucketing — Today / Yesterday / Earlier this week / Older ──
function bucketByRecency(sessions: CompareSession[]) {
  const now = Date.now();
  const day = 86_400_000;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const today: CompareSession[] = [];
  const yesterday: CompareSession[] = [];
  const week: CompareSession[] = [];
  const older: CompareSession[] = [];

  for (const s of sessions) {
    if (s.createdAt >= todayMs) today.push(s);
    else if (s.createdAt >= todayMs - day) yesterday.push(s);
    else if (s.createdAt >= now - 7 * day) week.push(s);
    else older.push(s);
  }
  return [
    { label: "today", items: today },
    { label: "yesterday", items: yesterday },
    { label: "earlier this week", items: week },
    { label: "older", items: older },
  ];
}

// ── Icons (no extra deps) ────────────────────────────────────────────
function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms ease" }}
    >
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  );
}

function ChevronLeftDouble() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4 L5 8 L9 12" />
      <path d="M13 4 L9 8 L13 12" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4 L10 8 L6 12" />
    </svg>
  );
}
