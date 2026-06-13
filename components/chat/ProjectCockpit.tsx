"use client";

/**
 * Project cockpit — the parallel/Compare page, reused for a whole
 * project. Same two-column shape (a grid of chat columns on the left, a
 * resizable code workspace on the right), with the mode toggle removed
 * and two additions per the spec: each column gets a TITLE bar and its
 * OWN composer, so you drive each chat independently and watch them
 * side by side.
 *
 * Presentational: it calls back to CompareChat for actions (onSend,
 * onOpenSession, onBack) and never runs anything itself.
 */

import { useRef, useState } from "react";
import type { CompareSession, Project, ProjectFile } from "@/lib/compare/sessions";
import type { AgentEvent } from "@/lib/agent/loop";
import { AgentEventRow } from "./AgentRunner";
import { SplitWorkspace } from "./SplitWorkspace";

export function ProjectCockpit({
  project, sessions, onBack, onOpenSession, onSend,
}: {
  project: Project;
  sessions: CompareSession[];
  onBack: () => void;
  onOpenSession: (id: string) => void;
  onSend: (sessionId: string, prompt: string) => void;
}) {
  const [chatPct, setChatPct] = useState(56);
  const [codeTab, setCodeTab] = useState<string>(sessions[0]?.id ?? "");
  const rowRef = useRef<HTMLDivElement | null>(null);

  const codeSession = sessions.find((s) => s.id === codeTab) ?? sessions[0];
  const codeProject: Record<string, ProjectFile> = codeSession?.project ?? {};

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-6 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          title="Back to chats"
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] transition"
        >
          <BackIcon />
        </button>
        <span className="text-white/90 text-[15px] font-medium truncate">{project.name}</span>
        <span className="text-white/35 text-[12px] shrink-0">
          {sessions.length} chat{sessions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div ref={rowRef} className="flex-1 min-h-0 flex gap-0">
        <div
          className="min-w-0 overflow-y-auto pr-3"
          style={{ flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }}
        >
          {sessions.length === 0 ? (
            <p className="text-white/40 text-[13px] px-2 py-6 leading-[1.6]">
              This project has no chats yet — move chats into it from the sidebar (hover a chat → folder icon).
            </p>
          ) : (
            <div className={gridCols(sessions.length)}>
              {sessions.map((s) => (
                <ChatColumn
                  key={s.id}
                  session={s}
                  onOpen={() => onOpenSession(s.id)}
                  onSend={(t) => onSend(s.id, t)}
                />
              ))}
            </div>
          )}
        </div>

        <OuterSplitter
          onDrag={(clientX) => {
            const rect = rowRef.current?.getBoundingClientRect();
            if (!rect) return;
            const pct = ((clientX - rect.left) / rect.width) * 100;
            setChatPct(Math.min(80, Math.max(25, pct)));
          }}
        />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {sessions.length > 1 && (
            <div className="flex items-center gap-1 px-1 pb-1.5 shrink-0 overflow-x-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCodeTab(s.id)}
                  className={[
                    "px-3 py-1 rounded-md text-[12px] whitespace-nowrap transition-colors shrink-0",
                    codeTab === s.id
                      ? "bg-white/[0.09] text-white/90"
                      : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]",
                  ].join(" ")}
                  title={s.title}
                >
                  {shortTitle(s.title)}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0">
            <SplitWorkspace
              project={codeProject}
              slotLabels={{}}
              onFileEdit={() => {}}
              canUndo={false}
              canRedo={false}
              undoTooltip=""
              redoTooltip=""
              onUndo={() => {}}
              onRedo={() => {}}
              onOpenVersionHistory={() => {}}
              canPreview={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatColumn({
  session, onOpen, onSend,
}: {
  session: CompareSession;
  onOpen: () => void;
  onSend: (prompt: string) => void;
}) {
  const [text, setText] = useState("");
  const log = Array.isArray(session.agentLog) ? (session.agentLog as AgentEvent[]) : [];

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div
      onDoubleClick={onOpen}
      className="flex flex-col rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/15 transition-all min-h-[300px] max-h-[560px]"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
        <span className="flex-1 truncate text-white/85 text-[13px] font-medium" title={session.title}>
          {session.title}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          title="Open full screen"
          aria-label="Open full screen"
          className="text-white/35 hover:text-white transition shrink-0"
        >
          <ExpandIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-2.5 min-h-0">
        {log.length ? (
          log.map((e, i) => <AgentEventRow key={i} event={e} />)
        ) : (
          <div className="text-white/40 text-[12.5px] leading-[1.5]">
            {session.prompt ?? "No messages yet — type below to start."}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-white/[0.06] shrink-0">
        <div className="rounded-lg border border-white/10 bg-[#1c1c1c] focus-within:border-white/25 transition-colors flex items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={1}
            placeholder={`Ask ${shortTitle(session.title)}…`}
            className="flex-1 bg-transparent resize-none outline-none text-white/90 placeholder:text-white/30 text-[13px] px-3 py-2 max-h-24"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); submit(); }}
            disabled={!text.trim()}
            className="m-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Responsive column grid — same breakpoints as the parallel page.
function gridCols(n: number) {
  if (n <= 1) return "grid grid-cols-1 gap-4";
  if (n === 2) return "grid grid-cols-1 md:grid-cols-2 gap-4";
  if (n === 3) return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";
  return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4";
}

// Draggable divider between the chat columns and the code workspace —
// same behavior as the parallel page's OuterSplitter.
function OuterSplitter({ onDrag }: { onDrag: (clientX: number) => void }) {
  const draggingRef = useRef(false);
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    function handleMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      onDrag(ev.clientX);
    }
    function handleUp() {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="group shrink-0 w-[5px] cursor-col-resize relative"
      style={{ background: "#1a1918" }}
    >
      <div aria-hidden className="absolute left-[2px] top-0 bottom-0 w-px" style={{ background: "#000" }} />
    </div>
  );
}

function shortTitle(t: string) {
  return t.length > 18 ? t.slice(0, 17) + "…" : t;
}

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 4 L6 8 L10 12" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2.5H3.5V5M10 2.5h2.5V5M6 13.5H3.5V11M10 13.5h2.5V11" />
    </svg>
  );
}
