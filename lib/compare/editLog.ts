/**
 * Append-only edit log + undo/redo state computer. Web-side adapter
 * of veronum-chat-localhost/lib/activity.js — same event shape and
 * the same `computeUndoState` fold logic so an undo of an undo
 * re-applies the original. Storage swapped from a JSON sidecar on
 * disk to localStorage; semantics are identical.
 *
 * Sources tracked:
 *   "user"  — typed in the in-editor textarea (debounced one event
 *             per stop-typing burst so the log doesn't explode)
 *   "undo"  — an undo of a prior event; carries `undoneId`
 *   "redo"  — an undo of an undo; carries `undoneId` too
 *
 * Agent emissions are NOT logged here. They live in `runs` and flow
 * into the project map directly; the user's edits layer on top via
 * the fileEdits override. Undo/redo only walks user-side history.
 *
 * Storage cap: 500 events total, oldest evicted on append. Per-session
 * scoping done at read time (every list/computeUndoState call filters
 * by sessionId).
 */

const KEY = "veronum.compare.editlog.v1";
const MAX = 500;

export type EditEvent = {
  id: string;
  sessionId: string;
  ts: number;
  source: "user" | "undo" | "redo";
  filePath: string;
  /** File content before this event. Empty string for new files. */
  before: string;
  /** File content after this event. */
  after: string;
  /** Optional user-supplied label, e.g. "fixed auth bug". */
  name?: string;
  /** Set on "undo" / "redo" events — the id of the event being
   *  reverted/re-applied. The fold in computeUndoState uses this to
   *  decide what's next on each stack. */
  undoneId?: string;
};

function isBrowser() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): EditEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid);
  } catch {
    return [];
  }
}

function writeAll(rows: EditEvent[]) {
  if (!isBrowser()) return;
  try {
    const trimmed = [...rows]
      .sort((a, b) => a.ts - b.ts)
      .slice(-MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — non-fatal */
  }
}

function isValid(e: unknown): e is EditEvent {
  if (!e || typeof e !== "object") return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.sessionId === "string" &&
    typeof r.ts === "number" &&
    (r.source === "user" || r.source === "undo" || r.source === "redo") &&
    typeof r.filePath === "string" &&
    typeof r.before === "string" &&
    typeof r.after === "string"
  );
}

export function listEdits(sessionId: string): EditEvent[] {
  return readAll()
    .filter((e) => e.sessionId === sessionId)
    .sort((a, b) => a.ts - b.ts);
}

export function appendEdit(e: Omit<EditEvent, "id" | "ts"> & { ts?: number }): EditEvent {
  const full: EditEvent = {
    ...e,
    id: newId(),
    ts: e.ts ?? Date.now(),
  };
  writeAll([...readAll(), full]);
  return full;
}

export function setEditName(id: string, name: string) {
  writeAll(
    readAll().map((e) => (e.id === id ? { ...e, name } : e)),
  );
}

export function deleteEditLog(sessionId: string) {
  writeAll(readAll().filter((e) => e.sessionId !== sessionId));
}

export type UndoState = {
  nextUndo: EditEvent | null;
  nextRedo: EditEvent | null;
};

/**
 * Fold the per-session edit log into the "what would Undo/Redo do
 * next?" state. Mirrors lib/activity.js:computeUndoState exactly:
 *
 *   walk events in chronological order
 *   - "redo"  → its undoneId is now re-applied; pop from undone set,
 *               add to redone set
 *   - "undo"  → its undoneId is now reverted; pop from redone set,
 *               add to undone set
 *   - "user"  → if not already undone, becomes the new nextUndo
 *
 *   after walking:
 *     nextUndo is the most recent user/redo event that hasn't been
 *     undone since
 *     nextRedo is the most recent undo event whose target hasn't
 *     been redone since
 */
export function computeUndoState(edits: EditEvent[]): UndoState {
  // Pass 1 — walk chronologically to figure out which user/redo
  // events are currently undone and which undo events have been
  // re-applied by a later redo. Mirrors veronum-chat-localhost/lib/
  // activity.js's undoneId bookkeeping.
  const undone = new Set<string>();
  const redone = new Set<string>();
  for (const e of edits) {
    if (e.source === "redo" && e.undoneId) {
      redone.add(e.undoneId);
      undone.delete(e.undoneId);
    } else if (e.source === "undo" && e.undoneId) {
      if (!redone.has(e.undoneId)) {
        undone.add(e.undoneId);
      } else {
        redone.delete(e.undoneId);
      }
    }
  }

  // Pass 2 — walk backwards from newest. The first user/redo event
  // whose id isn't in `undone` is what Undo will revert next. The
  // first undo event whose target IS still in `undone` is what Redo
  // will re-apply next.
  let nextUndo: EditEvent | null = null;
  let nextRedo: EditEvent | null = null;
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    if (!nextUndo) {
      if ((e.source === "user" || e.source === "redo") && !undone.has(e.id)) {
        nextUndo = e;
      }
    }
    if (!nextRedo) {
      if (e.source === "undo" && e.undoneId && undone.has(e.undoneId)) {
        nextRedo = e;
      }
    }
    if (nextUndo && nextRedo) break;
  }
  return { nextUndo, nextRedo };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
