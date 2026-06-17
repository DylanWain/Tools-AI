"use client";

/**
 * /overlay-preview — V overlay content (loaded by Electron).
 *
 * Bare-minimum viewer for your Claude CODE history (the IDE / CLI you're
 * actually using right now). Reads JSONL session files from
 * ~/.claude/projects/ via Electron IPC. No claude.ai sign-in, no API,
 * no team chat in this view.
 *
 * Three screens:
 *   ProjectsScreen → list every Claude Code project (working directory)
 *   SessionsScreen → list every session/chat in that project
 *   ConversationScreen → full back-and-forth: your turns + Claude's
 *     (also folds in other-member turns via Supabase Realtime when
 *      the session is bound to a Veronum shared room)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { VeronumMessage, VeronumSharedFile } from "@/lib/api-client";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { ActivityTab } from "./ActivityTab";

type ClaudeWindow = Window & {
  veronum?: {
    overlayClose?: () => Promise<unknown>;
    copyText?: (text: string) => Promise<unknown>;
    /** Open an http(s) URL in the OS's default browser. Bypasses Chrome
     *  HSTS / address-bar quirks for localhost links. */
    openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>;
    /** Listen for veronum:// deep links delivered by the OS. */
    onProtocolJoin?: (
      callback: (payload: { url: string }) => void
    ) => () => void;
    claudeCode?: {
      listProjects: () => Promise<{ ok: boolean; projects?: Project[]; error?: string }>;
      listSessions: (
        projectId: string
      ) => Promise<{ ok: boolean; sessions?: Session[]; error?: string }>;
      getSession: (
        projectId: string,
        sessionId: string
      ) => Promise<{ ok: boolean; title?: string; messages?: Message[]; error?: string }>;
      // Continue a session by typing into Claude Code's CLI. Streams JSON
      // events back via onChunk; resolves when the child process exits.
      sendInSession: (
        input: { projectId: string; sessionId: string; prompt: string },
        onChunk: (payload: StreamPayload) => void
      ) => Promise<SendResult>;
      cancelSend: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
      // Share this session as a Veronum collaborative project. Returns
      // the magic link the host sends to a teammate.
      shareSession: (
        input: { projectId: string; sessionId: string; sessionTitle?: string }
      ) => Promise<ShareResult>;
      isShared: (
        sessionId: string
      ) => Promise<{ shared: boolean } & Partial<SharedRecord>>;
      // Phase 1B — claim a magic-link invite from another Veronum app.
      joinShared: (url: string) => Promise<JoinResult>;
      bindLocalToShared: (input: {
        veronumProjectId: string;
        sessionUuid: string;
        cwd: string;
      }) => Promise<BindResult>;
      // Phase 2A — apply a remote-authored file change to the local
      // bound cwd. Called from the renderer's Realtime subscription.
      applyRemoteFile: (input: {
        veronumProjectId: string;
        file_path: string;
        content: string | null;
        bytes_size: number;
      }) => Promise<{ ok: boolean; error?: string }>;
    };
  };
};

type JoinResult =
  | {
      ok: true;
      project: { id: string; name: string; color: string };
      role: string;
      projectIdHint?: string | null;
    }
  | { ok: false; error: string };

type BindResult =
  | { ok: true; veronumProjectId: string; sessionUuid: string; cwd: string }
  | { ok: false; error: string };

type SharedRecord = {
  veronumProjectId: string;
  sessionUuid: string;
  cwd: string;
  inviteToken: string;
  inviteUrl: string;
};

type ShareResult =
  | ({ ok: true; alreadyShared?: boolean } & SharedRecord)
  | { ok: false; error: string };

type Project = {
  id: string;
  name: string;
  fullPath: string;
  sessionCount: number;
  lastMtime: number;
};

type Session = {
  id: string;
  title: string;
  size: number;
  mtime: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string | null;
};

// One line of `claude --output-format stream-json --verbose`. Loosely
// typed because the CLI emits many event shapes (system/init, user echo,
// assistant message, result). We only care about the `assistant` shape;
// everything else is forwarded but ignored by the renderer.
type StreamChunk = {
  type?: string;
  message?: {
    role?: string;
    content?:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "tool_use"; name?: string }
          | { type: "tool_result"; content?: unknown }
        >;
  };
};

type StreamPayload =
  | { sessionId: string; chunk: StreamChunk }
  | {
      sessionId: string;
      done: true;
      exitCode?: number | null;
      signal?: string | null;
      stderrTail?: string;
      error?: string;
    };

type SendResult = {
  ok: boolean;
  exitCode?: number | null;
  signal?: string | null;
  stderrTail?: string;
  error?: string;
};

const SYNCED_KEY = "veronum_synced_claude_code_project_ids";

export default function OverlayPreviewPage() {
  // Hydration gate: server-render a stable skeleton, then swap to the
  // real client tree after mount. Avoids the "Hydration failed" error
  // when window.veronum exists on the client but not on the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Centered><Spinner /></Centered>;
  return <Viewer />;
}

function Viewer() {
  const cc = getClaudeCode();
  const [view, setView] = useState<
    | { kind: "projects" }
    | { kind: "sessions"; projectId: string; projectName: string }
    | { kind: "conversation"; projectId: string; projectName: string; sessionId: string; sessionTitle: string }
  >({ kind: "projects" });
  // Lifted: the Join Shared modal is reachable from any view, so the
  // Viewer (header) controls open/close. autoLink is set when the modal
  // was opened by an incoming veronum:// deep-link, so the modal can
  // skip the paste step and go straight to claiming the invite.
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinAutoLink, setJoinAutoLink] = useState<string>("");

  // Listen for veronum:// deep links from the OS. When received, open
  // the Join modal pre-filled with the URL — the user only has to pick
  // which local Claude session becomes their seat in the shared room.
  useEffect(() => {
    const w = (typeof window !== "undefined"
      ? (window as ClaudeWindow)
      : null)?.veronum;
    if (!w?.onProtocolJoin) return;
    const unsubscribe = w.onProtocolJoin((payload) => {
      if (!payload?.url) return;
      setJoinAutoLink(payload.url);
      setJoinModalOpen(true);
    });
    return unsubscribe;
  }, []);

  if (!cc) {
    return (
      <Centered>
        <p className="text-[14px] text-[#1a1a18] mb-2 font-medium">Veronum desktop only</p>
        <p className="text-[12.5px] text-[#7d7d76] max-w-[360px]">
          This viewer reads your local Claude Code sessions. Open the V
          overlay from Claude Desktop to use it (it needs Electron file
          access — a regular browser tab can&apos;t do it).
        </p>
      </Centered>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-[#faf9f5] overflow-hidden flex flex-col"
      style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
    >
      <Header
        view={view}
        onBack={() => {
          if (view.kind === "conversation") {
            setView({ kind: "sessions", projectId: view.projectId, projectName: view.projectName });
          } else if (view.kind === "sessions") {
            setView({ kind: "projects" });
          }
        }}
        onJoinClick={() => setJoinModalOpen(true)}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === "projects" && (
          <ProjectsScreen
            onOpenProject={(p) =>
              setView({ kind: "sessions", projectId: p.id, projectName: p.name })
            }
          />
        )}
        {view.kind === "sessions" && (
          <SessionsScreen
            projectId={view.projectId}
            projectName={view.projectName}
            onOpenSession={(s) =>
              setView({
                kind: "conversation",
                projectId: view.projectId,
                projectName: view.projectName,
                sessionId: s.id,
                sessionTitle: s.title,
              })
            }
          />
        )}
        {view.kind === "conversation" && (
          <ConversationScreen
            projectId={view.projectId}
            sessionId={view.sessionId}
            fallbackTitle={view.sessionTitle}
          />
        )}
      </div>
      {joinModalOpen && (
        <JoinSharedModal
          autoLink={joinAutoLink}
          onClose={() => {
            setJoinModalOpen(false);
            setJoinAutoLink("");
          }}
          onJoinedAndBound={(args) => {
            setJoinModalOpen(false);
            setJoinAutoLink("");
            // Navigate the viewer straight into the bound session so the
            // user immediately sees the shared room view.
            setView({
              kind: "conversation",
              projectId: args.cwd,
              projectName: args.cwd,
              sessionId: args.sessionUuid,
              sessionTitle: args.veronumProjectName,
            });
          }}
        />
      )}
    </div>
  );
}

function Header({
  view,
  onBack,
  onJoinClick,
}: {
  view: { kind: string };
  onBack: () => void;
  onJoinClick: () => void;
}) {
  const w = typeof window !== "undefined" ? (window as ClaudeWindow) : null;
  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-black/[0.06] flex-shrink-0">
      {view.kind !== "projects" && (
        <button
          onClick={onBack}
          className="text-[12px] text-[#7d7d76] hover:text-[#1a1a18]"
        >
          ← back
        </button>
      )}
      <div className="flex-1 text-[12px] font-mono uppercase tracking-[0.10em] text-[#7d7d76]">
        veronum · claude code · {view.kind}
      </div>
      <button
        onClick={onJoinClick}
        className="px-2.5 py-1 rounded-md bg-black/[0.05] hover:bg-black/[0.08] text-[#1a1a18] text-[11.5px] font-medium transition"
        title="Join a shared session via magic link"
      >
        Join
      </button>
      <button
        onClick={() => w?.veronum?.overlayClose?.()}
        className="w-7 h-7 rounded-md hover:bg-black/[0.05] flex items-center justify-center text-[#5a5a55]"
        aria-label="Close"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

/* ─── Projects screen ─────────────────────────────────────────────── */

function ProjectsScreen({ onOpenProject }: { onOpenProject: (p: Project) => void }) {
  // ── Hooks (always called, in the same order, every render) ──────────
  // Rule of Hooks: never put a hook after an early return. All useState /
  // useEffect / useMemo calls live up here, before any conditional UI.
  const cc = getClaudeCode();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState<Set<string>>(() => loadSynced());

  useEffect(() => {
    if (!cc) return;
    cc.listProjects()
      .then((r) => {
        if (!r.ok) setError(r.error || "list failed");
        else setProjects(r.projects || []);
      })
      .catch((e) => setError(e.message));
  }, [cc]);

  // Order: synced first, then most-recent. Computed every render, even
  // when projects is null — useMemo handles that with a safe fallback.
  const sorted = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      const aS = synced.has(a.id) ? 1 : 0;
      const bS = synced.has(b.id) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return b.lastMtime - a.lastMtime;
    });
  }, [projects, synced]);

  const toggleSync = (id: string) => {
    setSynced((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSynced(next);
      return next;
    });
  };

  // ── Render (early returns are fine here — no hooks below this line) ─
  if (error) {
    return (
      <Centered>
        <p className="text-[12.5px] text-[#c44] font-mono break-words max-w-[440px]">{error}</p>
      </Centered>
    );
  }
  if (!projects) return <Centered><Spinner /></Centered>;
  if (projects.length === 0) {
    return (
      <Centered>
        <p className="text-[14px] text-[#1a1a18]">No Claude Code projects found</p>
        <p className="text-[12px] text-[#7d7d76] mt-1">
          Use Claude Code in any directory once and a project will show up here.
        </p>
      </Centered>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-[14px] font-medium" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
          Your Claude Code projects
        </h2>
        <span className="text-[10.5px] text-[#9a9a93] font-mono">{projects.length} total</span>
      </div>
      <p className="text-[11.5px] text-[#7d7d76] mb-3">
        Tap to view sessions. Toggle the checkbox to sync a project.
      </p>
      <div className="space-y-0.5">
        {sorted.map((p) => {
          const isSynced = synced.has(p.id);
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-black/[0.03] ${
                isSynced ? "bg-[#cc785c]/[0.04]" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={isSynced}
                onChange={() => toggleSync(p.id)}
                onClick={(e) => e.stopPropagation()}
                className="accent-[#cc785c] cursor-pointer flex-shrink-0"
                title="Sync this project"
              />
              <button
                onClick={() => onOpenProject(p)}
                className="flex-1 min-w-0 text-left flex items-baseline gap-2 group"
              >
                <span className="text-[13px] text-[#1a1a18] truncate">{p.name}</span>
                <span className="text-[10px] text-[#9a9a93] font-mono truncate hidden group-hover:inline">
                  {p.fullPath}
                </span>
                <span className="text-[10px] text-[#9a9a93] ml-auto flex-shrink-0">
                  {p.sessionCount} · {formatTime(p.lastMtime)}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Sessions screen ─────────────────────────────────────────────── */

function SessionsScreen({
  projectId,
  projectName,
  onOpenSession,
}: {
  projectId: string;
  projectName: string;
  onOpenSession: (s: Session) => void;
}) {
  const cc = getClaudeCode();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cc) return;
    cc.listSessions(projectId)
      .then((r) => {
        if (!r.ok) setError(r.error || "list failed");
        else setSessions(r.sessions || []);
      })
      .catch((e) => setError(e.message));
  }, [cc, projectId]);

  if (error) {
    return (
      <Centered>
        <p className="text-[12.5px] text-[#c44] font-mono break-words max-w-[440px]">{error}</p>
      </Centered>
    );
  }
  if (!sessions) return <Centered><Spinner /></Centered>;

  return (
    <div className="px-4 py-3">
      <h2 className="text-[14px] font-medium mb-1" style={{ fontFamily: '"Newsreader", Georgia, serif' }}>
        {projectName}
      </h2>
      <p className="text-[10.5px] text-[#9a9a93] font-mono mb-3">
        {sessions.length} session{sessions.length === 1 ? "" : "s"}
      </p>
      {sessions.length === 0 ? (
        <p className="text-[12px] text-[#7d7d76]">No sessions in this project.</p>
      ) : (
        <div className="space-y-0.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenSession(s)}
              className="w-full text-left flex items-baseline gap-2 px-2 py-1.5 rounded-md hover:bg-black/[0.03]"
            >
              <span className="text-[13px] text-[#1a1a18] truncate flex-1 min-w-0">
                {s.title}
              </span>
              <span className="text-[10px] text-[#9a9a93] flex-shrink-0">
                {formatTime(s.mtime)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Conversation screen ─────────────────────────────────────────── */

function ConversationScreen({
  projectId,
  sessionId,
  fallbackTitle,
}: {
  projectId: string;
  sessionId: string;
  fallbackTitle: string;
}) {
  const cc = getClaudeCode();
  const [data, setData] = useState<{ title: string; messages: Message[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Composer + streaming state. A "send" spawns `claude --resume` in the
  // main process; chunks land here via onChunk and accumulate into
  // `streamingText` while `streaming` is true. When the child exits we
  // re-fetch via getSession to render the canonical on-disk turns.
  const [composerText, setComposerText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  // Share state. `shareInfo` is the existing magic-link record if this
  // session is already shared; `shareModalOpen` controls the dialog;
  // `sharing` is true while shareSession() is in flight.
  const [shareInfo, setShareInfo] = useState<SharedRecord | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Remote (other-member) turns, populated by Supabase Realtime when the
  // session is bound to a Veronum project. Hoisted here so the auto-scroll
  // effect below can depend on its length without a forward reference.
  const [remoteTurns, setRemoteTurns] = useState<VeronumMessage[]>([]);
  // Phase 2A: which tab is showing — chat or file-activity feed. Only
  // relevant when the session is bound; unshared sessions stay on chat.
  const [activeTab, setActiveTab] = useState<"chat" | "activity">("chat");

  const aliveRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initial load + alive-flag teardown. We don't cancel an in-flight send
  // on unmount on purpose: the child keeps writing to disk so the user
  // sees the new turns next time they open this session.
  useEffect(() => {
    if (!cc) return;
    aliveRef.current = true;
    cc.getSession(projectId, sessionId)
      .then((r) => {
        if (!aliveRef.current) return;
        if (!r.ok) setError(r.error || "load failed");
        else setData({ title: r.title || fallbackTitle, messages: r.messages || [] });
      })
      .catch((e) => {
        if (aliveRef.current) setError(e.message);
      });
    return () => {
      aliveRef.current = false;
    };
  }, [cc, projectId, sessionId, fallbackTitle]);

  // Keep the latest message in view when new turns or stream chunks arrive.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages.length, remoteTurns.length, streamingText, streaming]);

  // On mount: check whether this session is already shared so we can show
  // a "Shared" badge instead of "Share" when reopening it.
  useEffect(() => {
    if (!cc) return;
    let cancelled = false;
    cc.isShared(sessionId)
      .then((r) => {
        if (cancelled || !r.shared) return;
        setShareInfo({
          veronumProjectId: r.veronumProjectId!,
          sessionUuid: r.sessionUuid!,
          cwd: r.cwd!,
          inviteToken: r.inviteToken!,
          inviteUrl: r.inviteUrl!,
        });
      })
      .catch(() => {/* ignore — non-critical */});
    return () => {
      cancelled = true;
    };
  }, [cc, sessionId]);

  // ── Shared-room subscription ─────────────────────────────────────────
  // When this session is bound to a Veronum project, subscribe to that
  // project's Realtime feed and capture turns from OTHER members. The
  // local JSONL is still the primary source for our own turns; only
  // remote-author turns are rendered from this stream so we never
  // double-show our own work.
  useEffect(() => {
    if (!shareInfo) return;
    const projectId = shareInfo.veronumProjectId;
    const ourSessionUuid = shareInfo.sessionUuid;
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;

    // Backfill: load existing messages once so we don't miss turns posted
    // before we subscribed. Filter to remote-author rows.
    (async () => {
      try {
        const userId = localStorage.getItem("veronum_user_id");
        if (!userId) return;
        const { api } = await import("@/lib/api-client");
        const { messages } = await api.getMessages(projectId, userId);
        if (cancelled) return;
        setRemoteTurns(
          messages.filter(
            (m) =>
              (m.metadata as { source_uuid?: string } | null)?.source_uuid !==
              ourSessionUuid
          )
        );
      } catch {/* non-fatal — Realtime will still deliver new turns */}
    })();

    try {
      const sb = getBrowserSupabase();
      channel = sb
        .channel(`veronum_messages:overlay:${projectId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "veronum_messages",
            filter: `project_id=eq.${projectId}`,
          },
          (payload) => {
            const m = payload.new as VeronumMessage;
            // Skip turns mirrored from OUR own JSONL — already in the local view.
            const sourceUuid = (m.metadata as { source_uuid?: string } | null)
              ?.source_uuid;
            if (sourceUuid === ourSessionUuid) return;
            setRemoteTurns((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              return [...prev, m];
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[shared-room] subscribe failed:", e);
    }

    return () => {
      cancelled = true;
      if (channel) channel.unsubscribe();
      // Reset on unbind so the next bound session starts clean.
      setRemoteTurns([]);
    };
  }, [shareInfo]);

  // ── Live shared-folder subscription ──────────────────────────────────
  // When this session is bound, watch the project's `veronum_shared_files`
  // table for changes authored by OTHER members and forward each one to
  // the Electron main process, which writes it to disk inside our local
  // cwd. Our own writes are filtered out by `updated_by` so we don't
  // round-trip our own saves.
  useEffect(() => {
    if (!shareInfo) return;
    const projectId = shareInfo.veronumProjectId;
    const myUserId = typeof window !== "undefined"
      ? localStorage.getItem("veronum_user_id")
      : null;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;

    const apply = async (row: VeronumSharedFile) => {
      if (myUserId && row.updated_by === myUserId) return;
      if (row.content === undefined) return; // shouldn't happen on full row
      const w = (window as ClaudeWindow).veronum?.claudeCode;
      if (!w?.applyRemoteFile) return;
      try {
        await w.applyRemoteFile({
          veronumProjectId: projectId,
          file_path: row.file_path,
          content: row.content ?? null,
          bytes_size: row.bytes_size,
        });
      } catch (e) {
        console.warn("[file-sync] applyRemoteFile failed:", e);
      }
    };

    try {
      const sb = getBrowserSupabase();
      channel = sb
        .channel(`veronum_shared_files:${projectId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "veronum_shared_files",
            filter: `project_id=eq.${projectId}`,
          },
          (payload) => {
            const row = (payload.new || payload.old) as VeronumSharedFile;
            if (!row) return;
            apply(row);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[file-sync] subscribe failed:", e);
    }

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [shareInfo]);

  const handleShare = async () => {
    if (!cc) return;
    setShareModalOpen(true);
    setShareError(null);
    setLinkCopied(false);
    if (shareInfo) return; // already shared, modal will show existing link
    setSharing(true);
    try {
      const result = await cc.shareSession({
        projectId,
        sessionId,
        sessionTitle: data?.title || fallbackTitle,
      });
      if (!aliveRef.current) return;
      if (!result.ok) {
        setShareError(result.error);
      } else {
        setShareInfo({
          veronumProjectId: result.veronumProjectId,
          sessionUuid: result.sessionUuid,
          cwd: result.cwd,
          inviteToken: result.inviteToken,
          inviteUrl: result.inviteUrl,
        });
      }
    } catch (err) {
      if (aliveRef.current) {
        setShareError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (aliveRef.current) setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareInfo) return;
    try {
      await navigator.clipboard.writeText(shareInfo.inviteUrl);
      setLinkCopied(true);
      setTimeout(() => {
        if (aliveRef.current) setLinkCopied(false);
      }, 1500);
    } catch {
      // Fallback: ask the main process to write to clipboard via IPC.
      const w = (window as ClaudeWindow).veronum;
      await w?.copyText?.(shareInfo.inviteUrl);
      setLinkCopied(true);
      setTimeout(() => {
        if (aliveRef.current) setLinkCopied(false);
      }, 1500);
    }
  };


  const handleSend = async () => {
    const prompt = composerText.trim();
    if (!prompt || !cc || streaming) return;

    // Optimistic user bubble — replaced by the canonical version after
    // the send completes and we re-read the JSONL.
    const optimisticId = `optimistic-${Date.now()}`;
    setData((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: optimisticId,
                role: "user",
                text: prompt,
                timestamp: new Date().toISOString(),
              },
            ],
          }
        : prev
    );
    setStreaming(true);
    setStreamError(null);
    setStreamingText("");

    let result: SendResult;
    try {
      result = await cc.sendInSession({ projectId, sessionId, prompt }, (payload) => {
        if (!aliveRef.current) return;
        if ("done" in payload) return; // exit handled below
        const obj = payload.chunk;
        // Skip the user-echo chunk so we don't double-render the prompt.
        if (!obj || obj.type !== "assistant") return;
        const text = extractStreamText(obj);
        if (!text) return;
        setStreamingText((prev) => (prev ? `${prev}\n\n${text}` : text));
      });
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (!aliveRef.current) return;

    // Refresh from disk regardless of success — getSession is the single
    // source of truth for what actually got persisted.
    try {
      const refreshed = await cc.getSession(projectId, sessionId);
      if (!aliveRef.current) return;
      if (refreshed.ok) {
        setData({
          title: refreshed.title || fallbackTitle,
          messages: refreshed.messages || [],
        });
      }
    } catch {
      /* keep prior data; surface streamError below */
    }

    if (!result.ok) {
      setStreamError(
        result.error ||
          result.stderrTail?.trim() ||
          (result.exitCode != null ? `claude exited with code ${result.exitCode}` : "send failed")
      );
      // Keep composerText so the user can retry without retyping.
    } else {
      setComposerText("");
    }

    setStreaming(false);
    setStreamingText("");
  };

  const handleStop = async () => {
    if (!cc || !streaming) return;
    try {
      await cc.cancelSend(sessionId);
    } catch {
      /* the exit handler in main.js will still fire */
    }
  };

  // Build the display feed: local JSONL turns + remote (other-member) turns
  // from Supabase, interleaved by timestamp. Only computed when shared so
  // unshared sessions stay zero-cost.
  const displayTurns = useMemo<DisplayTurn[] | null>(() => {
    if (!data) return null;
    if (!shareInfo) {
      // Unshared: just the local JSONL view, normalized.
      return data.messages.map((m) => ({
        key: `local-${m.id}`,
        origin: "local",
        authorName: m.role === "assistant" ? "claude" : "you",
        authorColor: m.role === "assistant" ? "#1a1a18" : "#cc785c",
        isAi: m.role === "assistant",
        text: m.text,
        ts: parseTs(m.timestamp),
      }));
    }
    const local: DisplayTurn[] = data.messages.map((m) => ({
      key: `local-${m.id}`,
      origin: "local",
      authorName: m.role === "assistant" ? "claude" : "you",
      authorColor: m.role === "assistant" ? "#1a1a18" : "#cc785c",
      isAi: m.role === "assistant",
      text: m.text,
      ts: parseTs(m.timestamp),
    }));
    const remote: DisplayTurn[] = remoteTurns.map((m) => ({
      key: `remote-${m.id}`,
      origin: "remote",
      authorName: m.author_name,
      authorColor: m.author_color,
      isAi: m.kind === "ai",
      text: m.body,
      ts: parseTs(
        (m.metadata as { source_timestamp?: string } | null)?.source_timestamp ||
          m.created_at
      ),
    }));
    return [...local, ...remote].sort((a, b) => a.ts - b.ts);
  }, [data, remoteTurns, shareInfo]);

  if (error) {
    return (
      <Centered>
        <p className="text-[12.5px] text-[#c44] font-mono break-words max-w-[440px]">{error}</p>
      </Centered>
    );
  }
  if (!data || !displayTurns) return <Centered><Spinner /></Centered>;

  const sendDisabled = streaming || !composerText.trim();

  return (
    <div className="px-5 max-w-[820px] mx-auto pb-32">
      {/* Sticky title bar — always visible while scrolling so the Share
          button is reachable regardless of how deep the conversation goes. */}
      <div className="sticky top-0 -mx-5 px-5 pt-4 pb-3 bg-[#faf9f5]/95 backdrop-blur-sm border-b border-black/[0.04] z-10">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2
            className="text-[16px] font-medium flex-1 min-w-0 truncate"
            style={{ fontFamily: '"Newsreader", Georgia, serif' }}
          >
            {data.title}
          </h2>
          <button
            onClick={handleShare}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              shareInfo
                ? "bg-[#cc785c]/10 text-[#cc785c] hover:bg-[#cc785c]/15"
                : "bg-[#cc785c] text-white hover:bg-[#b86a52]"
            }`}
            title={shareInfo ? "View invite link" : "Share this session with a teammate"}
          >
            {shareInfo ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#cc785c]" /> Shared
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 2v8M4 6l4-4 4 4M3 12v2h10v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>
        <p className="text-[10.5px] text-[#9a9a93] font-mono">
          {data.messages.length} turn{data.messages.length === 1 ? "" : "s"}
          {shareInfo && (
            <span className="ml-2 text-[#cc785c]">· mirroring to Veronum room</span>
          )}
        </p>
        {shareInfo && (
          <div className="flex items-center gap-1 mt-2 -mb-1">
            {(["chat", "activity"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition ${
                  activeTab === t
                    ? "bg-[#1a1a18] text-white"
                    : "text-[#7d7d76] hover:text-[#1a1a18] hover:bg-black/[0.05]"
                }`}
              >
                {t === "chat" ? "Chat" : "Activity"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pt-4" />
      {shareInfo && activeTab === "activity" ? (
        <ActivityTab
          veronumProjectId={shareInfo.veronumProjectId}
          userId={typeof window !== "undefined" ? localStorage.getItem("veronum_user_id") : null}
        />
      ) : displayTurns.length === 0 && !streaming ? (
        <p className="text-[12px] text-[#7d7d76]">
          {shareInfo
            ? "No turns in this room yet. Send a message to get started — your teammates will see it within a couple of seconds."
            : "This session has no readable messages."}
        </p>
      ) : (
        <div className="space-y-5">
          {displayTurns.map((t) => (
            <TurnBlock key={t.key} turn={t} />
          ))}
          {streaming && (
            <TurnBlock
              turn={{
                key: "streaming",
                origin: "local",
                authorName: "claude",
                authorColor: "#1a1a18",
                isAi: true,
                text: streamingText || "…",
                ts: Date.now(),
              }}
              pulse
            />
          )}
        </div>
      )}
      {streamError && (
        <p className="mt-4 text-[12px] text-[#c44] font-mono break-words">
          {streamError}
        </p>
      )}
      <div ref={messagesEndRef} />

      {/* Composer — sticky inside the scrolling parent so it floats over
          the messages without taking layout away from them. Hidden when
          the Activity tab is active. */}
      <div className={`sticky bottom-0 left-0 right-0 -mx-5 mt-6 px-5 pt-3 pb-4 bg-gradient-to-t from-[#faf9f5] via-[#faf9f5]/95 to-[#faf9f5]/0 pointer-events-none ${
        activeTab !== "chat" ? "hidden" : ""
      }`}>
        <div className="pointer-events-auto flex items-end gap-2 bg-white border border-black/10 rounded-xl shadow-sm p-2">
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sendDisabled) handleSend();
              }
            }}
            disabled={streaming}
            rows={1}
            placeholder={
              streaming
                ? "Claude is replying…"
                : "Continue this session — Enter to send, Shift+Enter for newline"
            }
            className="flex-1 resize-none bg-transparent outline-none text-[13.5px] py-2 px-2 max-h-32 disabled:text-[#9a9a93] placeholder:text-[#9a9a93]"
          />
          {streaming ? (
            <button
              onClick={handleStop}
              className="px-3 py-2 rounded-md bg-[#1a1a18] text-white text-[12.5px] font-medium hover:bg-[#2a2a25] transition"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={sendDisabled}
              className="px-3 py-2 rounded-md bg-[#cc785c] text-white text-[12.5px] font-medium hover:bg-[#b86a52] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#9a9a93] font-mono px-1">
          spawns <code>claude --resume</code> in {projectId}
        </p>
      </div>

      {/* Share modal — appears whenever the user clicks Share. Floats over
          the conversation; click outside or X to close. */}
      {shareModalOpen && (
        <ShareModal
          sharing={sharing}
          shareInfo={shareInfo}
          shareError={shareError}
          linkCopied={linkCopied}
          onCopy={handleCopyLink}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
}

function ShareModal({
  sharing,
  shareInfo,
  shareError,
  linkCopied,
  onCopy,
  onClose,
}: {
  sharing: boolean;
  shareInfo: SharedRecord | null;
  shareError: string | null;
  linkCopied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-[460px] w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h3
            className="text-[18px] font-medium text-[#1a1a18]"
            style={{ fontFamily: '"Newsreader", Georgia, serif' }}
          >
            {shareInfo ? "Share this session" : "Sharing…"}
          </h3>
          <button
            onClick={onClose}
            className="text-[#9a9a93] hover:text-[#1a1a18] text-[14px]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {sharing && !shareInfo && (
          <div className="py-6 text-center">
            <div
              className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "#cc785c", borderTopColor: "transparent" }}
            />
            <p className="mt-3 text-[12.5px] text-[#7d7d76]">
              Creating Veronum project, minting invite link, starting mirror…
            </p>
          </div>
        )}

        {shareError && (
          <p className="mt-2 text-[12px] text-[#c44] font-mono break-words">
            {shareError}
          </p>
        )}

        {shareInfo && (
          <>
            <p className="text-[13px] text-[#1a1a18] leading-[1.5] mb-3">
              Send this link to a teammate. They&apos;ll see your Claude Code
              chat live as you work.
            </p>
            <div className="flex items-stretch gap-2 mb-3">
              <input
                readOnly
                value={shareInfo.inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 bg-[#faf9f5] border border-black/10 rounded-md px-3 py-2 text-[12px] font-mono text-[#1a1a18] outline-none"
              />
              <button
                onClick={onCopy}
                className="flex-shrink-0 px-3 py-2 rounded-md bg-[#cc785c] text-white text-[12.5px] font-medium hover:bg-[#b86a52] transition"
              >
                {linkCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-[11px] text-[#9a9a93] leading-[1.5]">
              When your teammate clicks the link, Veronum opens on their
              machine and they pick which of their local Claude Code sessions
              to bind as their seat in the room. If they don&apos;t have
              Veronum yet, the link offers a download. Every turn from
              either side mirrors to the shared room within ~2 seconds.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Join Shared modal ────────────────────────────────────────────────
 *
 * Two-step flow inside the overlay:
 *   1. Paste the magic link → joinShared() claims the invite
 *   2. Pick a local Claude Code session to bind as your seat in the room
 *      → bindLocalToShared() updates your member row + starts the mirror
 *
 * After step 2 the parent navigates straight into the bound session so
 * the user lands in the shared conversation.
 */

type JoinedProject = { id: string; name: string; color: string };

function JoinSharedModal({
  onClose,
  onJoinedAndBound,
  autoLink = "",
}: {
  onClose: () => void;
  onJoinedAndBound: (args: {
    veronumProjectId: string;
    veronumProjectName: string;
    sessionUuid: string;
    cwd: string;
  }) => void;
  autoLink?: string;
}) {
  const cc = getClaudeCode();
  const [step, setStep] = useState<
    "paste" | "joining" | "pickProject" | "pickSession" | "binding" | "error"
  >(autoLink ? "joining" : "paste");
  const [link, setLink] = useState(autoLink);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinedProject | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pickedCwd, setPickedCwd] = useState<string | null>(null);
  const [pickedProjectName, setPickedProjectName] = useState<string>("");
  const [sessions, setSessions] = useState<Session[] | null>(null);

  const handleJoinWith = async (linkValue: string) => {
    if (!cc) return;
    const trimmed = linkValue.trim();
    if (!trimmed) {
      setErrorMsg("Paste the magic link from the host first.");
      setStep("paste");
      return;
    }
    setStep("joining");
    setErrorMsg(null);
    const result = await cc.joinShared(trimmed);
    if (!result.ok) {
      setErrorMsg(result.error);
      setStep("error");
      return;
    }
    setJoined(result.project);
    setStep("pickProject");
    // Kick off project list load while user reads the confirmation.
    cc.listProjects()
      .then((r) => {
        if (!r.ok) {
          setErrorMsg(r.error || "Could not list projects");
          setStep("error");
          return;
        }
        setProjects(r.projects || []);
      })
      .catch((e) => {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStep("error");
      });
  };

  const handleJoin = () => handleJoinWith(link);

  // When the modal was opened by a veronum:// deep-link, claim the invite
  // automatically — the user already chose to open it. They'll still pick
  // which local session to bind on the next step.
  useEffect(() => {
    if (autoLink) handleJoinWith(autoLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLink]);

  const handlePickProject = async (p: Project) => {
    if (!cc) return;
    setPickedCwd(p.id);
    setPickedProjectName(p.name);
    setSessions(null);
    setStep("pickSession");
    try {
      const r = await cc.listSessions(p.id);
      if (!r.ok) {
        setErrorMsg(r.error || "Could not list sessions");
        setStep("error");
        return;
      }
      setSessions(r.sessions || []);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const handlePickSession = async (s: Session) => {
    if (!cc || !joined || !pickedCwd) return;
    setStep("binding");
    setErrorMsg(null);
    const result = await cc.bindLocalToShared({
      veronumProjectId: joined.id,
      sessionUuid: s.id,
      cwd: pickedCwd,
    });
    if (!result.ok) {
      setErrorMsg(result.error);
      setStep("error");
      return;
    }
    onJoinedAndBound({
      veronumProjectId: joined.id,
      veronumProjectName: joined.name,
      sessionUuid: s.id,
      cwd: pickedCwd,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-[520px] w-full p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4 flex-shrink-0">
          <h3
            className="text-[18px] font-medium text-[#1a1a18]"
            style={{ fontFamily: '"Newsreader", Georgia, serif' }}
          >
            {step === "paste" && "Join a shared session"}
            {step === "joining" && "Claiming invite…"}
            {step === "pickProject" && joined && (
              <>
                Joined <span style={{ color: joined.color }}>{joined.name}</span>
              </>
            )}
            {step === "pickSession" && `Pick a session in ${pickedProjectName}`}
            {step === "binding" && "Binding…"}
            {step === "error" && "Couldn't join"}
          </h3>
          <button
            onClick={onClose}
            className="text-[#9a9a93] hover:text-[#1a1a18] text-[14px] flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === "paste" && (
          <PasteStep link={link} setLink={setLink} onSubmit={handleJoin} errorMsg={errorMsg} />
        )}

        {step === "joining" && <SpinnerStep label="Talking to the Veronum bridge…" />}

        {step === "pickProject" && (
          <ProjectPickStep
            joinedColor={joined?.color || "#cc785c"}
            joinedName={joined?.name || ""}
            projects={projects}
            onPick={handlePickProject}
          />
        )}

        {step === "pickSession" && (
          <SessionPickStep
            sessions={sessions}
            onPick={handlePickSession}
            onBack={() => setStep("pickProject")}
          />
        )}

        {step === "binding" && <SpinnerStep label="Linking your local session and starting the mirror…" />}

        {step === "error" && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[#c44] font-mono break-words">
              {errorMsg || "Unknown error"}
            </p>
            <button
              onClick={() => {
                setErrorMsg(null);
                setStep("paste");
              }}
              className="text-[12.5px] text-[#cc785c] hover:underline"
            >
              ← Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PasteStep({
  link,
  setLink,
  onSubmit,
  errorMsg,
}: {
  link: string;
  setLink: (v: string) => void;
  onSubmit: () => void;
  errorMsg: string | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[#1a1a18] leading-[1.5]">
        Paste the magic link your teammate sent. We&apos;ll claim the invite,
        then ask you which of your local Claude Code sessions to use as your
        seat in the room.
      </p>
      <textarea
        value={link}
        onChange={(e) => setLink(e.target.value)}
        rows={2}
        placeholder="http://…/p/…/join?t=…"
        className="w-full bg-[#faf9f5] border border-black/10 rounded-md px-3 py-2 text-[12px] font-mono text-[#1a1a18] outline-none focus:border-[#cc785c] resize-none"
        autoFocus
      />
      {errorMsg && (
        <p className="text-[11.5px] text-[#c44] font-mono">{errorMsg}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={onSubmit}
          disabled={!link.trim()}
          className="px-3 py-2 rounded-md bg-[#cc785c] text-white text-[12.5px] font-medium hover:bg-[#b86a52] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Join session
        </button>
      </div>
    </div>
  );
}

function SpinnerStep({ label }: { label: string }) {
  return (
    <div className="py-6 text-center">
      <div
        className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
        style={{ borderColor: "#cc785c", borderTopColor: "transparent" }}
      />
      <p className="mt-3 text-[12.5px] text-[#7d7d76]">{label}</p>
    </div>
  );
}

function ProjectPickStep({
  joinedColor,
  joinedName,
  projects,
  onPick,
}: {
  joinedColor: string;
  joinedName: string;
  projects: Project[] | null;
  onPick: (p: Project) => void;
}) {
  return (
    <>
      <p className="text-[13px] text-[#1a1a18] leading-[1.5] mb-3">
        Which of YOUR local Claude Code projects should host your seat in
        the <span style={{ color: joinedColor }}>{joinedName}</span> room?
        Pick one — next we&apos;ll choose a session inside it.
      </p>
      {!projects ? (
        <SpinnerStep label="Loading projects…" />
      ) : projects.length === 0 ? (
        <p className="text-[12.5px] text-[#7d7d76]">
          You don&apos;t have any Claude Code projects yet. Use Claude Code in
          a directory once and try again.
        </p>
      ) : (
        <div className="overflow-y-auto flex-1 -mx-2">
          <ul className="space-y-0.5">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onPick(p)}
                  className="w-full text-left flex items-baseline gap-2 px-2 py-1.5 rounded-md hover:bg-black/[0.04]"
                >
                  <span className="text-[13px] text-[#1a1a18] truncate flex-1 min-w-0">
                    {p.name}
                  </span>
                  <span className="text-[10px] text-[#9a9a93] font-mono flex-shrink-0">
                    {p.sessionCount} session{p.sessionCount === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function SessionPickStep({
  sessions,
  onPick,
  onBack,
}: {
  sessions: Session[] | null;
  onPick: (s: Session) => void;
  onBack: () => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="text-[12px] text-[#7d7d76] hover:text-[#1a1a18] mb-2 self-start"
      >
        ← back to projects
      </button>
      {!sessions ? (
        <SpinnerStep label="Loading sessions…" />
      ) : sessions.length === 0 ? (
        <p className="text-[12.5px] text-[#7d7d76]">
          No sessions in this project. Pick a different one.
        </p>
      ) : (
        <div className="overflow-y-auto flex-1 -mx-2">
          <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onPick(s)}
                  className="w-full text-left flex items-baseline gap-2 px-2 py-1.5 rounded-md hover:bg-black/[0.04]"
                >
                  <span className="text-[13px] text-[#1a1a18] truncate flex-1 min-w-0">
                    {s.title}
                  </span>
                  <span className="text-[10px] text-[#9a9a93] font-mono flex-shrink-0">
                    {formatTime(s.mtime)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Pull text + tool-use markers out of a single `assistant` stream chunk
 *  so the renderer can show Claude's progress as it works. Mirrors the
 *  shape used by getSession's history reader. */
function extractStreamText(obj: StreamChunk): string {
  const c = obj.message?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  const parts: string[] = [];
  for (const blk of c) {
    if (!blk || typeof blk !== "object") continue;
    if (blk.type === "text" && typeof blk.text === "string") {
      parts.push(blk.text);
    } else if (blk.type === "tool_use") {
      parts.push(`\n\n\`[tool: ${blk.name || "?"}]\``);
    }
  }
  return parts.join("").trim();
}

/* ─── Unified turn rendering (local + shared) ──────────────────────────
 *
 * DisplayTurn is the renderer-facing shape that hides whether a turn
 * came from the local JSONL or from another member's mirror via
 * Supabase Realtime. It carries its own author name + color so multiple
 * teammates' chats are visually distinguishable.
 */
type DisplayTurn = {
  key: string;
  origin: "local" | "remote";
  authorName: string;
  authorColor: string;
  isAi: boolean;
  text: string;
  ts: number;
};

function parseTs(raw: string | null | undefined): number {
  if (!raw) return 0;
  const d = Date.parse(raw);
  return Number.isNaN(d) ? 0 : d;
}

function TurnBlock({ turn, pulse = false }: { turn: DisplayTurn; pulse?: boolean }) {
  const initial = turn.isAi ? "C" : (turn.authorName[0] || "?").toUpperCase();
  const isRemote = turn.origin === "remote";
  return (
    <div className="flex gap-3">
      <div
        className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-medium flex-shrink-0 text-white ${
          pulse ? "animate-pulse" : ""
        }`}
        style={{ backgroundColor: turn.authorColor }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#7d7d76] mb-1 font-mono uppercase tracking-[0.08em] flex items-baseline gap-2">
          <span>{turn.authorName}</span>
          {pulse && <span className="text-[#cc785c]">streaming…</span>}
          {isRemote && (
            <span className="text-[10px] text-[#9a9a93] normal-case tracking-normal">
              · from teammate
            </span>
          )}
        </div>
        <div
          className="text-[14px] leading-[1.6] text-[#1a1a18] whitespace-pre-wrap break-words"
          style={{
            fontFamily: turn.isAi
              ? '"Newsreader", Georgia, serif'
              : '"Inter", system-ui',
          }}
        >
          {turn.text}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function getClaudeCode() {
  if (typeof window === "undefined") return null;
  return (window as ClaudeWindow).veronum?.claudeCode ?? null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#faf9f5] text-center px-6"
      style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
    >
      <div>{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
      style={{ borderColor: "#cc785c", borderTopColor: "transparent" }}
    />
  );
}

function loadSynced(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SYNCED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSynced(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

function formatTime(ms: number) {
  if (!ms) return "";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return "";
  }
}
