"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, type VeronumUser, type VeronumProject, type VeronumMessage } from "@/lib/api-client";
import { getBrowserSupabase } from "@/lib/supabase-browser";

/* ─── Bridge typing — Electron preload contract ────────────────────────── */

type VeronumBridgeWindow = Window & {
  veronum?: {
    bridge?: {
      relayToClaude: (input: { author: string; body: string }) => Promise<{ ok: boolean; reason?: string }>;
      isClaudeRunning: () => Promise<{ running: boolean }>;
      readClaudeReply: () => Promise<{ ok: boolean; text: string }>;
    };
  };
};

function getBridge() {
  if (typeof window === "undefined") return null;
  return (window as VeronumBridgeWindow).veronum?.bridge ?? null;
}

/* ─── useVeronumUser ───────────────────────────────────────────────────────
 *
 * Manages the current install's user identity. Generates an install token
 * on first mount, stores in localStorage, calls /users/register to get a
 * user.id, persists that too. Subsequent mounts reuse the same identity.
 */
export function useVeronumUser(displayName: string = "Anon") {
  const [user, setUser] = useState<VeronumUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let install_token = localStorage.getItem("veronum_install_token");
    if (!install_token) {
      install_token = crypto.randomUUID();
      localStorage.setItem("veronum_install_token", install_token);
    }
    api
      .registerUser({ install_token, display_name: displayName })
      .then((u) => {
        setUser(u);
        localStorage.setItem("veronum_user_id", u.id);
      })
      .catch((e) => setError(e.message || String(e)));
  }, [displayName]);

  return { user, error };
}

/* ─── useProjects ──────────────────────────────────────────────────────────
 *
 * Lists all projects the current user is a member of. Refreshes on demand
 * via reload(). Provides create() and join() helpers.
 */
export function useProjects(userId: string | null) {
  const [projects, setProjects] = useState<VeronumProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { projects } = await api.listProjects(userId);
      setProjects(projects);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (name: string, color = "#cc785c") => {
      if (!userId) return null;
      const project = await api.createProject(userId, { name, color });
      await reload();
      return project;
    },
    [userId, reload]
  );

  const join = useCallback(
    async (token: string) => {
      if (!userId) return null;
      const result = await api.joinProject(token, userId);
      await reload();
      return result;
    },
    [userId, reload]
  );

  return { projects, loading, error, reload, create, join };
}

/* ─── useMessages ──────────────────────────────────────────────────────────
 *
 * Loads message history for a project + subscribes to Realtime INSERTs.
 * New messages from any teammate appear in `messages` automatically within
 * ~50ms of being posted.
 */
export function useMessages(projectId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<VeronumMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!projectId || !userId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getMessages(projectId, userId)
      .then(({ messages }) => {
        setMessages(messages);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [projectId, userId]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]>;
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
            const newMsg = payload.new as VeronumMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[useMessages] realtime subscribe failed:", e);
    }
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [projectId]);

  const send = useCallback(
    async (text: string, opts: { kind?: "human" | "ai" | "system"; app?: string; model?: string } = {}) => {
      if (!projectId || !userId || !text.trim()) return null;
      const m = await api.postMessage(projectId, userId, {
        kind: opts.kind || "human",
        body: text,
        app: opts.app || "Claude (overlay)",
        model: opts.model,
      });
      // Optimistic insert (Realtime echo also arrives, dedupe by id)
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      return m;
    },
    [projectId, userId]
  );

  return { messages, loading, error, send };
}

/* ─── usePresence ──────────────────────────────────────────────────────────
 *
 * Heartbeats this user's presence every 5s + subscribes to other users'
 * presence updates for the project. Returns a map of userId → presence row.
 */
type PresenceRow = {
  project_id: string;
  user_id: string;
  app: string | null;
  file: string | null;
  line: number | null;
  typing: boolean;
  recent_snippet: string | null;
  last_seen: string;
};

export function usePresence(
  projectId: string | null,
  userId: string | null,
  myStatus: { app?: string; file?: string; typing?: boolean } = {}
) {
  const [presence, setPresence] = useState<Record<string, PresenceRow>>({});
  const myStatusRef = useRef(myStatus);
  myStatusRef.current = myStatus;

  // Heartbeat
  useEffect(() => {
    if (!projectId || !userId) return;

    const send = () => {
      api.updatePresence(projectId, userId, myStatusRef.current).catch(() => {});
    };
    send();
    const interval = setInterval(send, 5000);
    return () => clearInterval(interval);
  }, [projectId, userId]);

  // Subscribe to others' presence
  useEffect(() => {
    if (!projectId) return;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]>;
    try {
      const sb = getBrowserSupabase();
      channel = sb
        .channel(`veronum_presence:${projectId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "veronum_presence",
            filter: `project_id=eq.${projectId}`,
          },
          (payload) => {
            const row = (payload.new || payload.old) as PresenceRow;
            if (!row?.user_id) return;
            setPresence((prev) => ({ ...prev, [row.user_id]: row }));
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[usePresence] realtime subscribe failed:", e);
    }
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [projectId]);

  return { presence };
}

/* ─── useBridge ────────────────────────────────────────────────────────────
 *
 * Manages this machine's Claude Desktop bridge:
 *   - Polls `isClaudeRunning` every 4s → drives `claudeRunning` state
 *   - Whenever a NEW human message from a teammate arrives, types it into
 *     the local Claude Desktop's composer (if Claude is running here)
 *   - Exposes `broadcastClaudeReply()` for the user to push the latest
 *     visible Claude response back into the team room
 *
 * No-op outside Electron (window.veronum.bridge is undefined in a plain
 * browser tab — safe to call from there too).
 */
export function useBridge(
  projectId: string | null,
  userId: string | null,
  messages: VeronumMessage[]
) {
  const [claudeRunning, setClaudeRunning] = useState(false);
  const [lastBridged, setLastBridged] = useState<number | null>(null);
  const [broadcasting, _setBroadcasting] = useState(false);
  const seenIdsRef = useRef<Set<number>>(new Set());

  // Keep the seen set primed with the messages already loaded so we don't
  // re-bridge the entire history on first mount.
  const primedRef = useRef(false);
  useEffect(() => {
    if (primedRef.current || messages.length === 0) return;
    messages.forEach((m) => seenIdsRef.current.add(m.id));
    primedRef.current = true;
  }, [messages]);

  // Poll Claude Desktop running state.
  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { running } = await bridge.isClaudeRunning();
        if (!cancelled) setClaudeRunning(running);
      } catch {
        if (!cancelled) setClaudeRunning(false);
      }
    };
    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-relay new human messages into the local Claude Desktop. Each
  // relayed message includes a system instruction telling Claude to call
  // the `team_post_reply` MCP tool with its full answer. The MCP server
  // (running as a child of Claude Desktop) handles the tool call and
  // posts to Supabase, which broadcasts to all overlays via Realtime.
  // No polling, no OCR — Claude itself delivers the reply through MCP.
  useEffect(() => {
    const bridge = getBridge();
    if (!bridge || !claudeRunning || !userId) return;
    const fresh = messages.filter(
      (m) => !seenIdsRef.current.has(m.id) && m.kind === "human"
    );
    if (fresh.length === 0) return;
    fresh.forEach((m) => seenIdsRef.current.add(m.id));
    (async () => {
      for (const m of fresh) {
        try {
          const author = m.author_id === userId ? "" : m.author_name;
          await bridge.relayToClaude({ author, body: m.body });
          setLastBridged(m.id);
        } catch {
          /* swallow — surfaced via UI elsewhere */
        }
      }
    })();
  }, [messages, claudeRunning, userId]);

  // Manual broadcast is now a no-op — Claude posts its own reply via the
  // team_post_reply MCP tool on every turn. Kept for back-compat with
  // the composer's button (which we'll hide when claudeRunning is true).
  const broadcastClaudeReply = useCallback(async () => null, []);

  return {
    claudeRunning,
    lastBridged,
    broadcasting,
    broadcastClaudeReply,
    isInElectron: !!getBridge(),
  };
}
