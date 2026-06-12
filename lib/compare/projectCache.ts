/**
 * Per-session project cache (IndexedDB).
 *
 * Why this exists: Veronum's chat sessions persist to localStorage
 * (turns, messages, mode), but the WORKSPACE files used to live in
 * React state only — meaning every page reload or session-switch
 * lost the code, and every Open-Folder triggered Chrome's permission
 * popup. This cache fixes both:
 *
 *   1. File contents are written to IndexedDB keyed by session id.
 *      Reopening an old chat restores them instantly — no popup,
 *      workspace looks the same as when you left it.
 *
 *   2. The FileSystemDirectoryHandle is also written when the user
 *      picked via showDirectoryPicker (Chrome/Edge). DirectoryHandles
 *      are structured-cloneable — IndexedDB stores them natively.
 *      On reopen we call handle.queryPermission(); if it's still
 *      'granted', we can silently re-walk and refresh the cached
 *      files with no popup at all.
 *
 * Why IndexedDB and not localStorage:
 *   - localStorage is string-only (~5 MB cap, sync-only). Project
 *     dumps run 100-1500 KB; many sessions blow past the cap.
 *   - localStorage can't store DirectoryHandle structures at all.
 *   - IndexedDB is async, ~50 MB+ quota, and handles binary/structured
 *     objects natively.
 *
 * Safari support: as of 2026 Safari has File System Access API behind
 * a flag, so loadHandle will return null in that browser. The file
 * cache still works — it's just always a snapshot, never a live link.
 */

const DB_NAME = "veronum.projectCache";
const DB_VERSION = 1;
const STORE = "sessions";

export type CachedFile = { path: string; content: string };

export type CachedProject = {
  /** Display name (folder or repo). */
  rootName: string;
  files: CachedFile[];
  /** Present when picked via showDirectoryPicker (Chrome/Edge). null
   *  for webkitdirectory uploads, GitHub ingests, or Safari. */
  handle: FileSystemDirectoryHandle | null;
  savedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // Private-mode / quota-exceeded — keep the app usable, just
      // means folder persistence is a no-op for this session.
      console.warn("[projectCache] IndexedDB open failed:", req.error);
      resolve(null);
    };
  });
  return dbPromise;
}

/** Save the current project state under the given session id. Every
 *  call overwrites the previous record (no partial merges) — the
 *  payload is the canonical snapshot of what the user sees right now. */
export async function saveProject(
  sessionId: string,
  payload: CachedProject,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload, sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      console.warn("[projectCache] save failed:", tx.error);
      resolve();
    };
  });
}

export async function loadProject(sessionId: string): Promise<CachedProject | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(sessionId);
    req.onsuccess = () => resolve((req.result as CachedProject | undefined) ?? null);
    req.onerror = () => {
      console.warn("[projectCache] load failed:", req.error);
      resolve(null);
    };
  });
}

export async function clearProject(sessionId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Check whether a stored DirectoryHandle still has read permission.
 *  Returns "granted" | "prompt" | "denied" | "unavailable". The last
 *  one covers Safari / non-FSAPI browsers where the method doesn't
 *  exist. Caller can decide: granted → silent re-walk; prompt → small
 *  "Reconnect" button; denied / unavailable → use cached snapshot. */
export async function probeHandlePermission(
  handle: FileSystemDirectoryHandle,
): Promise<"granted" | "prompt" | "denied" | "unavailable"> {
  const fn = (handle as unknown as {
    queryPermission?: (d: { mode: "read" }) => Promise<PermissionState>;
  }).queryPermission;
  if (typeof fn !== "function") return "unavailable";
  try {
    const state = await fn.call(handle, { mode: "read" });
    return state;
  } catch {
    return "unavailable";
  }
}

/** Walk a previously-cached DirectoryHandle and return a fresh snapshot.
 *  Throws if permission has been revoked since cache time — caller
 *  should fall back to the cached snapshot in that case. */
export async function walkHandle(
  handle: FileSystemDirectoryHandle,
  filters: {
    skipDirs: RegExp;
    allowedExtensions: ReadonlySet<string>;
    maxFileBytes: number;
  },
): Promise<CachedFile[]> {
  const files: CachedFile[] = [];
  async function recurse(dir: FileSystemDirectoryHandle, prefix: string) {
    // values() is async iterable — yield each child handle in turn.
    // We can't use for-of with await on it cleanly without TS lib.dom
    // updates, so use the explicit iterator.
    const iter = (dir as unknown as {
      values: () => AsyncIterable<FileSystemHandle>;
    }).values();
    for await (const child of iter) {
      const path = prefix ? `${prefix}/${child.name}` : child.name;
      if (filters.skipDirs.test(path)) continue;
      if (child.kind === "directory") {
        await recurse(child as FileSystemDirectoryHandle, path);
      } else {
        const ext = (path.split(".").pop() || "").toLowerCase();
        if (!filters.allowedExtensions.has(ext)) continue;
        const file = await (child as FileSystemFileHandle).getFile();
        if (file.size > filters.maxFileBytes) continue;
        try {
          const content = await file.text();
          files.push({ path, content });
        } catch {
          // skip unreadable
        }
      }
    }
  }
  await recurse(handle, "");
  return files;
}
