/**
 * Compare-chat session store — localStorage only, no backend.
 *
 * Each session is the FULL multi-turn compare conversation:
 *   - `prompt` + `runs` hold the most-recent (or in-flight) batch.
 *   - `turns[]` holds every prior batch as a FrozenTurn — user prompt,
 *     every model's reply, and which card the user picked (the pick
 *     can be changed at any time, and only picked cards flow into
 *     subsequent multi-turn history).
 *
 * Layout in localStorage:
 *   key  = "veronum.compare.sessions.v1"
 *   val  = JSON.stringify(CompareSession[])
 *
 * Max 50 sessions retained, oldest evicted on save.
 */

import type { FrozenTurn } from "./turns";

const KEY = "veronum.compare.sessions.v1";
const MAX = 50;

export type SessionRun = {
  text: string;
  error?: string;
  durationMs?: number;
  modelId?: string;   // recorded so we can re-render with proper labels
  task?: string;      // multi-agent: the specific task for this slot
};

export type AgentSlot = {
  modelId: string;
  task: string;
  /** Multi-agent CODE mode: file paths this agent is allowed to write
   *  to. Every peer's system prompt is told to stay out of these. */
  files?: string[];
  /** Optional fine-grained ownership when two agents must share a file.
   *  Free text — agents read it literally (e.g. "lines 1-50"). */
  lineRange?: string;
};

/** Code-mode session also tracks a virtual project — files parsed out
 *  of each agent's output, who wrote them, and any conflicts. */
export type ProjectFile = {
  path: string;
  language?: string;
  content: string;
  ownerSlotId: string;     // who claimed it (or first wrote it)
  /** Other slot ids that ALSO wrote to this path — non-empty = conflict. */
  conflictingSlotIds?: string[];
  /** True if the closing ``` fence has been seen — false while streaming. */
  complete: boolean;
};

export type CompareSession = {
  id: string;
  title: string;              // first ~60 chars of the prompt / synthesized for agents
  createdAt: number;          // epoch ms
  mode: "compare" | "agents" | "auto-research" | "agent"; // default 'compare' for backward compat
  // Compare-mode fields
  prompt?: string;            // the single user prompt fan'd out to N models
  modelIds?: string[];        // which models the user picked
  /** Compare-mode multi-turn transcript. Every Send beyond the first
   *  appends a FrozenTurn here so reloading a session preserves the
   *  full conversation history (not just the most recent batch). The
   *  user's "pick" per turn is also persisted so picks survive reload. */
  turns?: FrozenTurn[];
  // Agents-mode fields
  goal?: string;              // the master task shared across all agents
  agents?: AgentSlot[];       // ordered list of per-agent (model + task + files) pairs
  // Common — runs keyed by SLOT id (compare: model id, agents: `agent-${idx}`)
  runs: Record<string, SessionRun>;
  /** Virtual project tree parsed from the agents' outputs. Keyed by
   *  file path, ordered insertion-wise by Object.entries(). */
  project?: Record<string, ProjectFile>;
  /** Agent-mode (local tool-loop) transcript: the streamed agent
   *  events (assistant text, tool calls, results). Stored opaquely so
   *  reopening the session restores the conversation in the chat. */
  agentLog?: unknown[];
};

function isBrowser() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): CompareSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSession);
  } catch {
    return [];
  }
}

function writeAll(rows: CompareSession[]) {
  if (!isBrowser()) return;
  try {
    // Sort newest first + cap.
    const trimmed = [...rows]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota exceeded — silently drop */
  }
}

function isValidSession(s: unknown): s is CompareSession {
  if (!s || typeof s !== "object") return false;
  const r = s as Record<string, unknown>;
  if (typeof r.id !== "string") return false;
  if (typeof r.title !== "string") return false;
  if (typeof r.createdAt !== "number") return false;
  if (typeof r.runs !== "object") return false;
  // Mode is optional for back-compat — pre-existing rows without
  // `mode` are treated as compare. Normalize on read.
  // NOTE: "agent" MUST be here — folder/agent sessions save with
  // mode "agent" and were being silently filtered out on read, so they
  // never appeared in the sidebar (the whole "no session shows up" bug).
  if (r.mode && r.mode !== "compare" && r.mode !== "agents" && r.mode !== "auto-research" && r.mode !== "agent") return false;
  return true;
}

export function listSessions(): CompareSession[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getSession(id: string): CompareSession | null {
  return readAll().find((s) => s.id === id) || null;
}

/** Upsert. Returns a new array, never mutates. */
export function saveSession(session: CompareSession) {
  const all = readAll();
  const next = [session, ...all.filter((s) => s.id !== session.id)];
  writeAll(next);
}

export function deleteSession(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function clearAll() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY);
}

export function newSessionId(): string {
  // crypto.randomUUID is available in modern browsers + Node 19+.
  // Fall back to a hand-rolled id if not (very old browsers).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function titleFromPrompt(prompt: string, max = 60): string {
  const oneLine = prompt.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trimEnd() + "…";
}
