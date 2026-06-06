"use client";

/**
 * Browser-side wrapper around /api/bridge/git. Calls the Tools-AI
 * Next route, which proxies to the user's paired Veronum Bridge
 * daemon (which has git + gh CLI). End result: clicking "Save
 * version" in /compare runs a real `git commit` on the user's Mac
 * and pushes to GitHub via `gh`, the same flow the desktop apps use.
 *
 * Auth: Supabase JWT. The user must be signed in (same auth /chat
 * uses). If not signed in, status() returns `signed_in: false` and
 * callers fall back to localStorage.
 */

import { getBrowserSupabase } from "@/lib/supabase";

export type BridgeFile = {
  content: string;
  language?: string;
};

export type BridgeGitStatus =
  | { available: true; tunnelOk: true }
  | { available: false; reason: "not_signed_in" | "no_bridge_paired" | "daemon_unreachable"; detail?: string };

export type BridgeVersion = {
  hash: string;
  shortHash: string;
  message: string;
  ts: number;
};

async function getJWT(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call(payload: Record<string, unknown>): Promise<Response> {
  const jwt = await getJWT();
  if (!jwt) throw new Error("not_signed_in");
  return fetch("/api/bridge/git", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(payload),
  });
}

/** Quick health check: are we signed in + does the user have a
 *  paired Bridge + is the daemon reachable right now? Used by the
 *  Version History modal to decide whether to show the
 *  "GitHub-backed" badge or fall back to localStorage. */
export async function bridgeStatus(): Promise<BridgeGitStatus> {
  const jwt = await getJWT();
  if (!jwt) return { available: false, reason: "not_signed_in" };
  try {
    const r = await call({ op: "log", cwd: defaultCwd("status-check") });
    if (r.ok) return { available: true, tunnelOk: true };
    const body = (await r.json().catch(() => ({}))) as { error?: string; detail?: string };
    if (body.error === "no_bridge_paired") {
      return { available: false, reason: "no_bridge_paired", detail: body.detail };
    }
    return { available: false, reason: "daemon_unreachable", detail: body.detail };
  } catch (e) {
    return { available: false, reason: "daemon_unreachable", detail: (e as Error).message };
  }
}

/** Save a virtual project snapshot. Daemon writes files to
 *  ${cwd}/${path}, then commits + pushes via gh. Returns the new
 *  commit hash on success. */
export async function bridgeSave(
  sessionId: string,
  name: string,
  files: Record<string, BridgeFile>,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const cwd = defaultCwd(sessionId);
  // Flatten { content, language } → string for the daemon's view.
  const flat: Record<string, string> = {};
  for (const [p, f] of Object.entries(files)) flat[p] = f.content;
  const r = await call({
    op: "save-virtual",
    cwd,
    message: name,
    files: flat,
  });
  const body = (await r.json().catch(() => ({}))) as { ok?: boolean; hash?: string; error?: string };
  return { ok: !!body.ok, hash: body.hash, error: body.error };
}

/** Revert to a saved commit. Daemon runs `git checkout <hash> -- .`
 *  in the same cwd, then reads every file back and returns its
 *  contents so /compare can update the in-memory project map. */
export async function bridgeRevert(
  sessionId: string,
  hash: string,
  name: string,
): Promise<{ ok: boolean; files?: Record<string, string>; error?: string }> {
  const cwd = defaultCwd(sessionId);
  const r = await call({
    op: "revert",
    cwd,
    hash,
    name,
  });
  const body = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    files?: Record<string, string>;
    error?: string;
  };
  return { ok: !!body.ok, files: body.files, error: body.error };
}

/** List all saved versions for this session. Returns an empty list
 *  if the daemon has nothing for this cwd yet. */
export async function bridgeLog(sessionId: string): Promise<{
  ok: boolean;
  versions: BridgeVersion[];
  remote?: { url?: string; branch?: string };
  ghAvailable?: boolean;
  error?: string;
}> {
  const cwd = defaultCwd(sessionId);
  const r = await call({ op: "log", cwd });
  const body = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    versions?: BridgeVersion[];
    remote?: { url?: string; branch?: string };
    ghAvailable?: boolean;
    error?: string;
  };
  return {
    ok: !!body.ok,
    versions: body.versions ?? [],
    remote: body.remote,
    ghAvailable: body.ghAvailable,
    error: body.error,
  };
}

/** Compute the daemon-side cwd for a compare session. The daemon
 *  expands `~` to the user's home dir, so this is portable. Each
 *  session gets its own folder under ~/Veronum/compare/. */
function defaultCwd(sessionId: string): string {
  // Sanitize — sessionId is a UUID but defend against future formats.
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `~/Veronum/compare/${safe}`;
}
