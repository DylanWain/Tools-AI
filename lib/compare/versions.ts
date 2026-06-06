/**
 * Named version snapshots for /compare's workspace. Web-side adapter
 * of veronum-chat-localhost/lib/git.js — same shape (named saves,
 * revert points to a previous state), but the backing store is
 * localStorage instead of a git repo because the browser has no
 * filesystem to commit against.
 *
 * Each saved version freezes the entire project map (every file's
 * content + language) at save-time. Reverting just hands the snapshot
 * back to the caller, who applies it via the same `fileEdits` overlay
 * that powers in-editor typing — so a revert is itself undoable.
 *
 * Storage layout:
 *   key: "veronum.compare.versions.v1"
 *   val: JSON.stringify(CompareVersion[])  — global array, scoped by
 *        sessionId when read so each compare session has its own
 *        version history.
 *
 * Capped at 100 most-recent versions total to keep localStorage
 * bounded; oldest evicted on save.
 */

const KEY = "veronum.compare.versions.v1";
const MAX = 100;

export type VersionFile = {
  content: string;
  language?: string;
};

export type CompareVersion = {
  id: string;
  sessionId: string;
  name: string;        // user-provided label, "Initial scaffolding" etc.
  createdAt: number;
  /** Frozen snapshot of every file in the workspace at save time. */
  files: Record<string, VersionFile>;
};

function isBrowser() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): CompareVersion[] {
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

function writeAll(rows: CompareVersion[]) {
  if (!isBrowser()) return;
  try {
    const trimmed = [...rows]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — non-fatal */
  }
}

function isValid(v: unknown): v is CompareVersion {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.sessionId === "string" &&
    typeof r.name === "string" &&
    typeof r.createdAt === "number" &&
    typeof r.files === "object" && r.files !== null
  );
}

export function listVersions(sessionId: string): CompareVersion[] {
  return readAll()
    .filter((v) => v.sessionId === sessionId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getVersion(id: string): CompareVersion | null {
  return readAll().find((v) => v.id === id) || null;
}

export function saveVersion(
  sessionId: string,
  name: string,
  files: Record<string, VersionFile>,
): CompareVersion {
  const v: CompareVersion = {
    id: newId(),
    sessionId,
    name: name.trim() || `version ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    // Deep-copy the files so future mutations of the live map can't
    // mutate the snapshot.
    files: Object.fromEntries(
      Object.entries(files).map(([p, f]) => [p, { content: f.content, language: f.language }]),
    ),
  };
  writeAll([v, ...readAll()]);
  return v;
}

export function deleteVersion(id: string) {
  writeAll(readAll().filter((v) => v.id !== id));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
