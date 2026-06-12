/**
 * Veronum Desktop bridge — runtime detection + thin wrappers.
 *
 * When the Veronum web app runs inside the Electron desktop wrapper,
 * `window.veronumDesktop` exists and gives us zero-popup native disk
 * access. This module is the single point that exposes that surface
 * to CompareChat and friends, so the rest of the app stays unaware of
 * which environment it's running in.
 *
 * In a regular browser the desktop API is absent and helpers return
 * null / false, so callers fall through to their normal File System
 * Access API path (showDirectoryPicker → walkDirectoryHandle).
 */

export type DesktopFile = { path: string; content: string };

export type DesktopPickResult = {
  rootId: string;
  rootName: string;
  files: DesktopFile[];
  totalBytes: number;
  dropped: number;
};

type DesktopApi = {
  pickFolder(): Promise<DesktopPickResult | null>;
  walkFolder(rootId: string): Promise<{
    files: DesktopFile[];
    totalBytes: number;
    dropped: number;
  } | null>;
  readFile(rootId: string, relPath: string): Promise<string | null>;
  writeFile(
    rootId: string,
    relPath: string,
    content: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  platform(): Promise<{
    isDesktop: true;
    platform: string;
    arch: string;
    version: string;
  }>;
  onAuthCallback(handler: (url: string) => void): () => void;
};

/** True when the app is running inside the Veronum Desktop wrapper.
 *  Safe to call during SSR — returns false; component bodies should
 *  read this inside a useEffect or on user interaction, not at the
 *  module top level. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { veronumDesktop?: DesktopApi }).veronumDesktop;
}

function api(): DesktopApi | null {
  if (!isDesktop()) return null;
  return (window as unknown as { veronumDesktop: DesktopApi }).veronumDesktop;
}

/** Opens the native folder dialog via Electron's main process.
 *  Returns null if the user canceled or we're not in the desktop app.
 *  No permission prompt — Electron treats the OS dialog as consent. */
export async function desktopPickFolder(): Promise<DesktopPickResult | null> {
  const a = api();
  if (!a) return null;
  return a.pickFolder();
}

/** Re-walks a previously-granted root for fresh content. Use on
 *  window focus or explicit "reload folder" to pick up external edits. */
export async function desktopWalkFolder(rootId: string): Promise<{
  files: DesktopFile[];
  totalBytes: number;
  dropped: number;
} | null> {
  const a = api();
  if (!a) return null;
  return a.walkFolder(rootId);
}

export async function desktopReadFile(rootId: string, relPath: string): Promise<string | null> {
  const a = api();
  if (!a) return null;
  return a.readFile(rootId, relPath);
}

export async function desktopWriteFile(
  rootId: string,
  relPath: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = api();
  if (!a) return { ok: false, error: "not_desktop" };
  return a.writeFile(rootId, relPath, content);
}

/** Subscribe to veronum://auth deep-link callbacks. Fires when macOS
 *  reopens the app via a magic-link redirect from the handoff page.
 *  The full URL is passed so the caller can parse access_token /
 *  refresh_token from the query string. Returns an unsubscribe fn,
 *  or a no-op when not running in desktop mode. */
export function onDesktopAuthCallback(handler: (url: string) => void): () => void {
  const a = api();
  if (!a) return () => {};
  return a.onAuthCallback(handler);
}
