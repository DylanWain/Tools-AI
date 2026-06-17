"use client";

import { useEffect, useRef, useState } from "react";
import { VeronumMark } from "../VeronumMark";
import { useToast } from "./Toast";
import { useMessages, usePresence } from "./hooks";
import { api } from "@/lib/api-client";

/**
 * VeronumOverlay — multiplayer shared chat thread for a project.
 *
 * Architecture:
 *   - Each Veronum project is a shared room. Messages flow through
 *     Supabase Realtime to every teammate's overlay within ~50ms.
 *   - The "bridge" user runs Claude Desktop with the Veronum MCP
 *     installed. Their Claude reads the team_log resource and posts
 *     replies back via the team_post tool. Other teammates can be on
 *     any app (Cursor, VS Code, ChatGPT, no Claude at all) and still
 *     participate via the overlay.
 *   - History / Connectors / Share tabs are LIVE — no mock data.
 */

type SecondaryView = null | "history" | "connections" | "share";

export function VeronumOverlay({
  projectId,
  projectName,
  projectColor,
  userId,
  onClose,
}: {
  projectId: string | null;
  projectName?: string;
  projectColor?: string;
  userId: string | null;
  onClose: () => void;
}) {
  const [secondaryView, setSecondaryView] = useState<SecondaryView>(null);
  const { push } = useToast();

  const { messages, loading, error, send } = useMessages(projectId, userId);
  const { presence } = usePresence(projectId, userId, { app: "Veronum" });

  // ─── empty state for non-shared chats ───
  if (!projectId || !userId) {
    return (
      <div
        className="absolute inset-0 z-40 flex flex-col bg-[#faf9f5] animate-[veronum-overlay-in_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
        style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] bg-[#faf9f5]">
          <div className="flex items-center gap-3">
            <VeronumMark className="w-7 h-7 rounded-md" />
            <div>
              <div className="text-[16px] font-medium leading-none" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
                Veronum
                <span className="text-[#7d7d76] font-normal italic">
                  {!userId ? " · setting up…" : " · no project selected"}
                </span>
              </div>
              <div className="text-[10.5px] text-[#9a9a93] font-mono uppercase tracking-[0.10em] mt-0.5">
                {!userId ? "registering install with backend" : "create or join a project to start"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-black/[0.05] flex items-center justify-center text-[#5a5a55]">
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div className="max-w-[440px]">
            <VeronumMark className="w-12 h-12 rounded-xl mx-auto mb-4" />
            <h3 className="text-[20px] font-medium text-[#1a1a18] leading-tight mb-2" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
              {!userId ? "Setting up Veronum…" : "Ready to start collaborating"}
            </h3>
            <p className="text-[13.5px] text-[#5a5a55] leading-relaxed mb-5">
              {!userId
                ? "Registering this install with the Veronum backend. Takes about a second."
                : "Click + New project at the top to create your first shared chat, or open an invite link from a teammate."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── live chat view ───
  const teammates = Object.values(presence).filter((p) => p.user_id !== userId);
  const onlineCount = teammates.filter((p) => {
    const ageSeconds = (Date.now() - new Date(p.last_seen).getTime()) / 1000;
    return ageSeconds < 30;
  }).length + 1; // +1 for self


  async function copyShareLink() {
    if (!projectId || !userId) return;
    try {
      const invite = await api.createInvite(projectId, userId, { role: "participant" });
      // In overlay-preview, replace localhost with actual origin so the link
      // is shareable beyond this dev machine.
      const url = invite.url.replace(/^https?:\/\/localhost:\d+/, window.location.origin);

      // Try the standard browser clipboard API first; fall back to Electron's
      // native clipboard via preload IPC if the browser API throws or isn't
      // available (e.g. some frameless-window Electron edge cases).
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
      if (!copied) {
        type VeronumWindow = Window & {
          veronum?: { copyText?: (t: string) => Promise<boolean> };
        };
        const w = window as VeronumWindow;
        if (w.veronum?.copyText) {
          copied = !!(await w.veronum.copyText(url));
        }
      }
      if (!copied) {
        // Last-resort: legacy execCommand path. Works in Electron content frames
        // even when the modern API is gated.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { copied = document.execCommand("copy"); } catch { copied = false; }
        document.body.removeChild(ta);
      }

      push({
        kind: copied ? "success" : "info",
        title: copied ? "Invite link copied" : "Invite link ready (copy manually)",
        detail: url,
      });
    } catch (e) {
      push({
        kind: "info",
        title: "Failed to generate invite",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-[#faf9f5] text-[#1a1a18] overflow-hidden animate-[veronum-overlay-in_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
      style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
    >
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] bg-[#faf9f5] flex-shrink-0">
        <div className="flex items-center gap-3">
          <VeronumMark className="w-7 h-7 rounded-md" />
          <div>
            <div className="text-[16px] font-medium leading-none" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
              Veronum
              <span className="text-[#7d7d76] font-normal italic"> on Claude</span>
            </div>
            <div className="text-[10.5px] text-[#9a9a93] font-mono uppercase tracking-[0.10em] mt-0.5">
              <span style={{ color: projectColor || "#cc785c" }}>●</span>{" "}
              {projectName || "shared chat"} · {onlineCount} online
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Secondary nav */}
          <div className="flex items-center gap-0.5 bg-black/[0.04] rounded-md p-0.5 mr-1">
            <SecondaryButton label="Chat" active={secondaryView === null} onClick={() => setSecondaryView(null)} />
            <SecondaryButton label="History" active={secondaryView === "history"} onClick={() => setSecondaryView("history")} />
            <SecondaryButton label="Connectors" active={secondaryView === "connections"} onClick={() => setSecondaryView("connections")} />
            <SecondaryButton label="Share" active={secondaryView === "share"} onClick={() => setSecondaryView("share")} />
          </div>

          {/* Online presence avatars */}
          <div className="flex items-center -space-x-1.5 mr-2">
            {teammates.slice(0, 3).map((p) => (
              <div
                key={p.user_id}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-medium text-white ring-2 ring-[#faf9f5] relative"
                style={{ background: stringToColor(p.user_id) }}
                title={`${p.app || "—"} · ${p.file || "—"}`}
              >
                {p.user_id.slice(0, 2).toUpperCase()}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#5cb27e] ring-2 ring-[#faf9f5]" />
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-black/[0.05] flex items-center justify-center text-[#5a5a55]"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 border-r border-black/[0.06]">
          {secondaryView === null ? (
            <>
              <ChatThread messages={messages} loading={loading} error={error} myUserId={userId} />
              <ChatComposer onSend={send} />
            </>
          ) : secondaryView === "history" ? (
            <HistoryView messages={messages} onBack={() => setSecondaryView(null)} />
          ) : secondaryView === "connections" ? (
            <ConnectorsView onBack={() => setSecondaryView(null)} />
          ) : (
            <ShareView projectId={projectId} onCopy={copyShareLink} onBack={() => setSecondaryView(null)} />
          )}
        </div>

        {/* Live presence sidebar */}
        <LivePresenceSidebar teammates={teammates} myUserId={userId} />
      </div>

      {/* ─── Footer ─── */}
      <footer className="px-5 py-2 border-t border-black/[0.06] bg-[#f4f3ed] flex items-center justify-between text-[10.5px] text-[#7d7d76] font-mono flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5cb27e]" />
            BRIDGE :39292 · LIVE
          </span>
          <span>·</span>
          <span>SUPABASE REALTIME · {error ? "ERROR" : "OK"}</span>
          <span>·</span>
          <span>{messages.length} msgs</span>
        </div>
        <div className="flex items-center gap-3">
          <span>v1.0.7 (live)</span>
          <span>·</span>
          <span>⌘⇧V to toggle · ESC to close</span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Helpers ─── */

function SecondaryButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11.5px] font-medium transition-colors ${
        active ? "bg-white text-[#1a1a18] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#5a5a55] hover:text-[#1a1a18]"
      }`}
    >
      {label}
    </button>
  );
}

/** Stable hash → color so each user gets a consistent avatar color */
function stringToColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const palette = ["#cc785c", "#5b8c7a", "#8a6dc4", "#d4a548", "#3a8bd0", "#c46686", "#5cb27e"];
  return palette[Math.abs(h) % palette.length];
}

/* ─── Chat Thread ─── */

import type { VeronumMessage } from "@/lib/api-client";

function ChatThread({
  messages,
  loading,
  error,
  myUserId,
}: {
  messages: VeronumMessage[];
  loading: boolean;
  error: string | null;
  myUserId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
      {loading && (
        <div className="text-center text-[12.5px] text-[#9a9a93] py-8">
          loading messages…
        </div>
      )}
      {error && (
        <div className="text-center text-[12.5px] text-[#c44] py-8 font-mono">
          {error}
        </div>
      )}
      {!loading && !error && messages.length === 0 && (
        <div className="text-center py-12">
          <div className="text-[14px] text-[#1a1a18] mb-1" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
            No messages yet.
          </div>
          <div className="text-[11.5px] text-[#9a9a93]">
            Send the first message to your team — or use{" "}
            <span className="font-mono text-[#cc785c]">@claude</span> to ask Claude.
          </div>
        </div>
      )}
      {messages.map((m) => (
        <MessageBlock key={m.id} message={m} isYou={m.author_id === myUserId} />
      ))}
    </div>
  );
}

function MessageBlock({ message, isYou }: { message: VeronumMessage; isYou: boolean }) {
  if (message.kind === "system") {
    return (
      <div className="flex items-center gap-2 py-1 px-3">
        <span className="w-1 h-1 rounded-full bg-[#9a9a93]" />
        <span className="text-[11px] text-[#7d7d76] italic flex-1">{message.body}</span>
        <span className="text-[10px] text-[#9a9a93] font-mono">{formatTime(message.created_at)}</span>
      </div>
    );
  }

  const isAI = message.kind === "ai";

  return (
    <div className="flex gap-3 group">
      {isAI ? (
        <div className="w-8 h-8 rounded-md bg-[#1a1a18] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#cc785c]" fill="currentColor">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
          </svg>
        </div>
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium text-white flex-shrink-0"
          style={{ background: message.author_color }}
        >
          {message.author_name[0]}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <span className={`text-[12.5px] font-medium ${isYou ? "text-[#cc785c]" : "text-[#1a1a18]"}`}>
            {isYou ? "You" : message.author_name}
          </span>
          {message.app && (
            <span className="text-[10px] text-[#9a9a93] font-mono">via {message.app}</span>
          )}
          {isAI && message.model && (
            <span className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-[#7d7d76] bg-black/[0.04] px-1.5 py-0.5 rounded">
              {message.model}
            </span>
          )}
          <span className="text-[10px] text-[#9a9a93] ml-auto">{formatTime(message.created_at)}</span>
        </div>
        <div
          className="text-[14px] leading-[1.55] text-[#1a1a18]"
          style={{ fontFamily: isAI ? '"Newsreader", Georgia, serif' : '"Inter", system-ui, sans-serif' }}
        >
          {renderBodyWithCodeBlocks(message.body)}
        </div>
      </div>
    </div>
  );
}

function renderWithMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="text-[#cc785c] font-medium">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/**
 * Render a message body, splitting out fenced code blocks (```lang ... ```)
 * into styled <pre> elements and treating the rest as paragraphs with
 * @mention highlighting. This makes pasted code from claude.ai / IDEs
 * render properly instead of as a wall of preformatted text.
 */
function renderBodyWithCodeBlocks(text: string) {
  // Split on fenced code blocks while keeping the delimiters in the result.
  // Pattern matches: ```optional-lang\n…\n```
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    const before = text.slice(lastIdx, match.index);
    if (before) {
      out.push(
        <p key={`t-${key++}`} className="whitespace-pre-wrap break-words">
          {renderWithMentions(before)}
        </p>
      );
    }
    const lang = match[1] || "";
    const code = match[2];
    out.push(
      <pre
        key={`c-${key++}`}
        className="my-2 bg-[#1a1a18] text-[#e8e6dc] rounded-md px-3 py-2.5 overflow-x-auto text-[12px] leading-[1.5]"
        style={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' }}
      >
        {lang && (
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#7d7d76] mb-1.5">{lang}</div>
        )}
        <code>{code}</code>
      </pre>
    );
    lastIdx = match.index + match[0].length;
  }
  const tail = text.slice(lastIdx);
  if (tail) {
    out.push(
      <p key={`t-${key++}`} className="whitespace-pre-wrap break-words">
        {renderWithMentions(tail)}
      </p>
    );
  }
  return out.length > 0 ? out : <p className="whitespace-pre-wrap break-words">{renderWithMentions(text)}</p>;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

/* ─── Composer ─── */

function ChatComposer({
  onSend,
}: {
  onSend: (text: string, opts?: { kind?: "human" | "ai" | "system"; app?: string; model?: string }) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    try {
      await onSend(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-black/[0.06] bg-[#faf9f5]">
      <div className="bg-white border border-black/[0.10] rounded-2xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] px-4 pt-3 pb-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Message the team — visible to everyone in this project, in real time"
          className="w-full bg-transparent outline-none text-[14px] text-[#1a1a18] placeholder:text-[#9a9a93] resize-none leading-relaxed"
          style={{ fontFamily: '"Newsreader", Georgia, serif' }}
        />
        <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-black/[0.05]">
          <span className="text-[10.5px] font-mono text-[#9a9a93]">⌘↩ to send</span>
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              draft.trim() && !sending
                ? "bg-[#cc785c] text-white hover:bg-[#bb6a4f]"
                : "bg-black/[0.05] text-[#9a9a93] cursor-not-allowed"
            }`}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Live Presence Sidebar ─── */

type PresenceRow = {
  user_id: string;
  app: string | null;
  file: string | null;
  line: number | null;
  typing: boolean;
  recent_snippet: string | null;
  last_seen: string;
};

function LivePresenceSidebar({ teammates, myUserId: _myUserId }: { teammates: PresenceRow[]; myUserId: string }) {
  return (
    <aside className="w-[300px] flex-shrink-0 bg-[#f4f3ed] flex flex-col overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <div className="text-[10.5px] uppercase tracking-[0.10em] text-[#9a9a93] font-mono mb-2.5">
          Live · what everyone's doing
        </div>
        <div className="space-y-3">
          {/* Self */}
          <TeammateLive
            initials="ME"
            color="#cc785c"
            name="You"
            online
            app="Claude (overlay)"
            file={null}
            line={null}
            typing={false}
            snippet={null}
          />
          {/* Others */}
          {teammates.map((p) => {
            const ageSeconds = (Date.now() - new Date(p.last_seen).getTime()) / 1000;
            const online = ageSeconds < 30;
            return (
              <TeammateLive
                key={p.user_id}
                initials={p.user_id.slice(0, 2).toUpperCase()}
                color={stringToColor(p.user_id)}
                name={p.user_id.slice(0, 8)}
                online={online}
                app={p.app}
                file={p.file}
                line={p.line}
                typing={p.typing}
                snippet={p.recent_snippet}
              />
            );
          })}
          {teammates.length === 0 && (
            <div className="text-[11px] text-[#9a9a93] italic px-2 py-3 text-center">
              No teammates online yet.
              <br />
              Generate an invite link to add one.
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 pb-4 border-t border-black/[0.05] mt-auto">
        <div className="text-[10.5px] uppercase tracking-[0.10em] text-[#9a9a93] font-mono mb-2">
          Dispatch
        </div>
        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-black/[0.08] rounded-lg text-[12px] text-[#1a1a18] hover:bg-[#fafaf7] transition-colors">
          <span style={{ color: "#cc785c" }}>⚡</span>
          <span>@agents fleet</span>
          <span className="ml-auto text-[10px] text-[#7d7d76] font-mono">⌘⇧A</span>
        </button>
      </div>
    </aside>
  );
}

function TeammateLive({ initials, color, name, online, app, file, line, typing, snippet }: {
  initials: string;
  color: string;
  name: string;
  online: boolean;
  app: string | null;
  file: string | null;
  line: number | null;
  typing: boolean;
  snippet: string | null;
}) {
  return (
    <div className={online ? "" : "opacity-40"}>
      <div className="flex items-center gap-2 mb-1">
        <div className="relative">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-medium text-white"
            style={{ background: color }}
          >
            {initials}
          </div>
          {online && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#5cb27e] ring-2 ring-[#f4f3ed]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-[#1a1a18] truncate flex items-center gap-1.5">
            {name}
            {typing && <span className="text-[9.5px] text-[#cc785c] font-mono italic">typing…</span>}
          </div>
          {online && app && (
            <div className="text-[10px] text-[#7d7d76] truncate">
              {app} {file && `· ${file}${line ? `:${line}` : ""}`}
            </div>
          )}
          {!online && <div className="text-[10px] text-[#9a9a93] italic">offline</div>}
        </div>
      </div>
      {snippet && (
        <pre className="ml-9 mt-1 text-[10.5px] font-mono leading-[1.45] bg-[#1a1a18] text-[#e8e6dc] rounded-md px-2.5 py-2 overflow-hidden whitespace-pre-wrap max-h-[88px]">
{snippet}
        </pre>
      )}
    </div>
  );
}

/* ─── History view — real conversation history from the shared room ─── */

function HistoryView({ messages, onBack }: { messages: VeronumMessage[]; onBack: () => void }) {
  // Real history is the shared message log itself, indexed by author + time.
  // No mock commits, no fake "Mike (Claude Code)" rows. If there are no
  // messages yet, we say so.
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-[760px] mx-auto">
        <button onClick={onBack} className="text-[11.5px] text-[#7d7d76] hover:text-[#1a1a18] mb-3 flex items-center gap-1">
          ← Back to chat
        </button>
        <h3 className="text-[18px] font-medium text-[#1a1a18] leading-none mb-1" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
          Conversation history
        </h3>
        <p className="text-[12.5px] text-[#5a5a55] mb-5">
          Every turn in this project's shared chat. Lives in Supabase; survives across sessions.
        </p>
        {messages.length === 0 ? (
          <div className="bg-white border border-black/[0.06] rounded-xl px-5 py-8 text-center text-[12.5px] text-[#7d7d76]">
            No messages yet. Send the first one from the Chat tab.
          </div>
        ) : (
          <div className="bg-white border border-black/[0.06] rounded-xl overflow-hidden">
            {messages.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-start gap-3 px-4 py-3 ${i !== messages.length - 1 ? "border-b border-black/[0.04]" : ""}`}
              >
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.10em] w-16 mt-0.5 text-[#9a9a93]"
                >
                  {m.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[#5a5a55] mb-0.5">
                    <span style={{ color: m.author_color }}>● </span>
                    {m.author_name}
                    {m.app ? ` · ${m.app}` : ""}
                    {m.model ? ` · ${m.model}` : ""}
                    <span className="text-[#9a9a93]"> · {formatTime(m.created_at)}</span>
                  </div>
                  <div className="text-[13px] text-[#1a1a18] whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Connectors view — honest status, no mocks ─── */

function ConnectorsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-[760px] mx-auto">
        <button onClick={onBack} className="text-[11.5px] text-[#7d7d76] hover:text-[#1a1a18] mb-3 flex items-center gap-1">
          ← Back to chat
        </button>
        <h3 className="text-[18px] font-medium text-[#1a1a18] leading-none mb-1" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
          Connectors
        </h3>
        <p className="text-[12.5px] text-[#5a5a55] mb-5">
          Connect this Veronum room to outside services. Each teammate authorizes their own connectors; the team sees the union of what's connected.
        </p>
        <div className="bg-white border border-black/[0.06] rounded-xl px-5 py-8 text-center">
          <p className="text-[13px] text-[#1a1a18] mb-1">No connectors yet.</p>
          <p className="text-[11.5px] text-[#7d7d76]">
            OAuth flows for Stripe / Supabase / Slack / Linear ship in the next pass. The Veronum DMG already has these wired — pulling them into the overlay next.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Share view (live invite generation) ─── */

function ShareView({ projectId, onCopy, onBack }: { projectId: string; onCopy: () => void; onBack: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-[600px] mx-auto">
        <button onClick={onBack} className="text-[11.5px] text-[#7d7d76] hover:text-[#1a1a18] mb-3 flex items-center gap-1">
          ← Back to chat
        </button>
        <h3 className="text-[18px] font-medium text-[#1a1a18] mb-1 leading-none" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
          Share this project
        </h3>
        <p className="text-[12.5px] text-[#5a5a55] mb-5">
          Generates a real invite link via /api/v1/projects/{projectId.slice(0, 8)}…/invite. Anyone with the link joins this project's shared chat.
        </p>
        <div className="bg-white border border-black/[0.06] rounded-xl p-5">
          <button onClick={onCopy} className="px-4 py-2.5 rounded-lg bg-[#cc785c] text-white text-[13px] font-medium hover:bg-[#bb6a4f] transition-colors">
            Generate + copy invite link
          </button>
          <p className="text-[11px] text-[#7d7d76] mt-3">
            Real clipboard copy. Open it in another browser tab (or another Mac) to test the multi-user join flow.
          </p>
        </div>
      </div>
    </div>
  );
}

