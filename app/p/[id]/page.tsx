"use client";

/**
 * /p/[id] — browser-side viewer for a Veronum shared room.
 *
 * Loads message history once via the API + subscribes to Supabase Realtime
 * for new inserts. Works in any browser (Electron or plain Chrome). The
 * Veronum desktop app's JSONL watcher pushes turns into veronum_messages
 * on every member's behalf, so opening this page on any device gives a
 * live mirror of everyone's Claude Code chats in the room.
 *
 * Phase 1A is read-only by design — the composer comes in 1B once we
 * teach the desktop app to spawn `claude --resume` against the LOCAL
 * session bound to the viewing user's project_member row.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  api,
  type VeronumMessage,
  type VeronumProject,
} from "@/lib/api-client";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function SharedRoomPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  // Hydration gate: localStorage isn't available SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Centered><Spinner /></Centered>;
  return <Room projectId={projectId} />;
}

function Room({ projectId }: { projectId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("Teammate");
  const [project, setProject] = useState<VeronumProject | null>(null);
  const [messages, setMessages] = useState<VeronumMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Bootstrap an identity for this browser. Same install_token model the
  //    overlay-preview page + /p/[id]/join page use, so the user is the
  //    SAME row in veronum_users no matter how they arrived.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let installToken = localStorage.getItem("veronum_install_token");
        if (!installToken) {
          installToken = crypto.randomUUID();
          localStorage.setItem("veronum_install_token", installToken);
        }
        const name = localStorage.getItem("veronum_display_name") || "Teammate";
        const user = await api.registerUser({
          install_token: installToken,
          display_name: name,
        });
        if (cancelled) return;
        localStorage.setItem("veronum_user_id", user.id);
        setUserId(user.id);
        setDisplayName(user.display_name);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Load message history (only after we have a user id — the API
  //    requires the x-veronum-user-id header for membership check).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ messages }, { projects }] = await Promise.all([
          api.getMessages(projectId, userId),
          api.listProjects(userId),
        ]);
        if (cancelled) return;
        setMessages(messages);
        setProject(projects.find((p) => p.id === projectId) || null);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? `${e.message} — make sure you've claimed the invite link first.`
              : String(e)
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, userId]);

  // 3. Realtime: subscribe to INSERTs on veronum_messages for this project.
  useEffect(() => {
    if (!userId) return;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;
    try {
      const sb = getBrowserSupabase();
      channel = sb
        .channel(`veronum_messages:${projectId}`)
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
            setMessages((prev) => {
              if (!prev) return [m];
              if (prev.some((x) => x.id === m.id)) return prev;
              return [...prev, m];
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[shared-room] realtime subscribe failed:", e);
    }
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [projectId, userId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  // Group consecutive same-author messages so the room reads like a chat
  // log instead of a turn-by-turn dump.
  const grouped = useMemo(() => groupByAuthor(messages || []), [messages]);

  if (error) {
    return (
      <Centered>
        <p className="text-[14px] text-[#1a1a18] mb-1">Couldn&apos;t load this room</p>
        <p className="text-[12px] text-[#c44] font-mono break-words max-w-[440px]">
          {error}
        </p>
      </Centered>
    );
  }
  if (!userId || !messages) return <Centered><Spinner /></Centered>;

  return (
    <div
      className="fixed inset-0 bg-[#faf9f5] overflow-hidden flex flex-col"
      style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
    >
      <header className="flex items-baseline gap-3 px-5 py-3 border-b border-black/[0.06] flex-shrink-0">
        <h1
          className="text-[16px] font-medium text-[#1a1a18]"
          style={{ fontFamily: '"Newsreader", Georgia, serif' }}
        >
          {project?.name || "Shared room"}
        </h1>
        <span className="text-[10.5px] text-[#9a9a93] font-mono uppercase tracking-[0.10em]">
          shared · live
        </span>
        <span className="ml-auto text-[10.5px] text-[#9a9a93] font-mono">
          you · {displayName}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-5 py-4 max-w-[820px] mx-auto">
          {grouped.length === 0 ? (
            <p className="text-[12.5px] text-[#7d7d76]">
              No messages yet. As soon as the host (or any member) sends a
              turn in their local Claude Code, it&apos;ll appear here within
              a couple of seconds.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map((g) => (
                <SharedMessageGroup key={g.id} group={g} />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}

type Group = {
  id: string;
  author_name: string;
  author_color: string;
  kind: VeronumMessage["kind"];
  messages: VeronumMessage[];
};

function groupByAuthor(messages: VeronumMessage[]): Group[] {
  const out: Group[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (
      last &&
      last.author_name === m.author_name &&
      last.kind === m.kind &&
      last.author_color === m.author_color
    ) {
      last.messages.push(m);
    } else {
      out.push({
        id: `g-${m.id}`,
        author_name: m.author_name,
        author_color: m.author_color,
        kind: m.kind,
        messages: [m],
      });
    }
  }
  return out;
}

function SharedMessageGroup({ group }: { group: Group }) {
  const isAi = group.kind === "ai";
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-medium flex-shrink-0 text-white"
        style={{ backgroundColor: isAi ? "#1a1a18" : group.author_color }}
      >
        {isAi ? "C" : (group.author_name[0] || "?").toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#7d7d76] mb-1 font-mono uppercase tracking-[0.08em]">
          {group.author_name}
        </div>
        <div className="space-y-3">
          {group.messages.map((m) => (
            <div
              key={m.id}
              className="text-[14px] leading-[1.6] text-[#1a1a18] whitespace-pre-wrap break-words"
              style={{
                fontFamily: isAi ? '"Newsreader", Georgia, serif' : '"Inter", system-ui',
              }}
            >
              {m.body}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
