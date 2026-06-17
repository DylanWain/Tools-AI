/**
 * Browser-side typed client for the Veronum bridge API.
 *
 * Calls /api/v1/* with the shared bearer token + per-user x-veronum-user-id
 * header. Same-origin fetches in the React UI; the Electron overlay will
 * use the same client when bundled.
 */

export const VERONUM_TOKEN = "tai-aadbe6df1780d20814e1271c7273e117";

export type VeronumUser = {
  id: string;
  install_token: string;
  display_name: string;
  avatar_color: string;
  email: string | null;
  created_at: string;
};

export type VeronumProject = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  created_at: string;
  archived_at: string | null;
  role?: "owner" | "participant" | "viewer";
  joined_at?: string;
};

export type VeronumMessage = {
  id: number;
  project_id: string;
  author_id: string | null;
  author_name: string;
  author_color: string;
  kind: "human" | "ai" | "system";
  body: string;
  app: string | null;
  model: string | null;
  in_reply_to: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type VeronumPresence = {
  project_id: string;
  user_id: string;
  app: string | null;
  file: string | null;
  line: number | null;
  typing: boolean;
  recent_snippet: string | null;
  last_seen: string;
};

export type VeronumSharedFile = {
  id: number;
  file_path: string;
  content?: string | null;     // omitted from list views unless ?content=1
  bytes_size: number;
  source_app: string | null;
  updated_by: string | null;
  updated_by_name: string;
  updated_by_color: string;
  version: number;
  updated_at: string;
};

export type VeronumFileChange = {
  id: number;
  project_id: string;
  file_path: string;
  change_kind: "create" | "modify" | "delete" | "rename";
  bytes_before: number | null;
  bytes_after: number | null;
  lines_added: number | null;
  lines_removed: number | null;
  source_app: string | null;
  author_id: string | null;
  author_name: string;
  author_color: string;
  created_at: string;
};

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(
  path: string,
  options: RequestInit & { userId?: string | null } = {}
): Promise<T> {
  const { userId, headers, ...rest } = options;
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VERONUM_TOKEN}`,
      ...(userId ? { "x-veronum-user-id": userId } : {}),
      ...(headers || {}),
    },
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed as T;
}

export const api = {
  async health() {
    return call<{ ok: boolean; config: { openai_key: boolean; anthropic_key: boolean; supabase: boolean | string } }>("/health");
  },

  async registerUser(input: { install_token: string; display_name: string; avatar_color?: string; email?: string }) {
    return call<VeronumUser>("/users/register", { method: "POST", body: JSON.stringify(input) });
  },

  async listProjects(userId: string) {
    return call<{ projects: VeronumProject[] }>("/projects", { userId });
  },

  async createProject(userId: string, input: { name: string; color?: string }) {
    return call<VeronumProject>("/projects", { method: "POST", userId, body: JSON.stringify(input) });
  },

  async getMessages(projectId: string, userId: string, since?: string) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return call<{ messages: VeronumMessage[] }>(`/projects/${projectId}/messages${qs}`, { userId });
  },

  async postMessage(projectId: string, userId: string, input: {
    kind: "human" | "ai" | "system";
    body: string;
    app?: string;
    model?: string;
    in_reply_to?: number;
    metadata?: Record<string, unknown>;
  }) {
    return call<VeronumMessage>(`/projects/${projectId}/messages`, {
      method: "POST",
      userId,
      body: JSON.stringify(input),
    });
  },

  async createInvite(projectId: string, userId: string, input?: { role?: string; expires_in_hours?: number; uses_remaining?: number }) {
    return call<{ token: string; project_id: string; role: string; url: string; expires_at: string | null }>(
      `/projects/${projectId}/invite`,
      { method: "POST", userId, body: JSON.stringify(input || {}) }
    );
  },

  async joinProject(token: string, userId: string) {
    return call<{ project: VeronumProject; role: string }>(`/projects/join/${token}`, { method: "POST", userId });
  },

  /**
   * Push a single file save into the shared folder. The desktop watcher
   * calls this on every text-file save in a bound cwd; null content
   * marks a delete. The route also writes an immutable activity row.
   */
  async pushFile(
    projectId: string,
    userId: string,
    input: {
      file_path: string;
      content: string | null;
      bytes_size?: number;
      source_app?: string;
      lines_added?: number;
      lines_removed?: number;
      change_kind?: "create" | "modify" | "delete" | "rename";
    }
  ) {
    return call<{ ok: boolean; version: number }>(
      `/projects/${projectId}/files`,
      { method: "POST", userId, body: JSON.stringify(input) }
    );
  },

  /** Bulk read of current shared-folder state. Pass content=true to
   *  get full file bodies (used during initial backfill on join). */
  async listFiles(projectId: string, userId: string, opts: { since?: string; content?: boolean } = {}) {
    const qs = new URLSearchParams();
    if (opts.since) qs.set("since", opts.since);
    if (opts.content) qs.set("content", "1");
    const q = qs.toString();
    return call<{ files: VeronumSharedFile[] }>(
      `/projects/${projectId}/files${q ? `?${q}` : ""}`,
      { userId }
    );
  },

  /** Activity feed of file changes. Filter by author/file/app, paginate
   *  by `since` (created_at cursor). */
  async listChanges(
    projectId: string,
    userId: string,
    opts: { since?: string; author?: string; file_path?: string; source_app?: string; limit?: number } = {}
  ) {
    const qs = new URLSearchParams();
    if (opts.since) qs.set("since", opts.since);
    if (opts.author) qs.set("author", opts.author);
    if (opts.file_path) qs.set("file_path", opts.file_path);
    if (opts.source_app) qs.set("source_app", opts.source_app);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const q = qs.toString();
    return call<{ changes: VeronumFileChange[] }>(
      `/projects/${projectId}/changes${q ? `?${q}` : ""}`,
      { userId }
    );
  },

  /**
   * Bind the calling user's local Claude Code session to this project, so
   * the desktop app's JSONL watcher knows which file is "this user's
   * contribution to the shared room". Pass nulls to unlink.
   */
  async linkLocalSession(
    projectId: string,
    userId: string,
    input: { linked_claude_session_uuid: string | null; linked_claude_cwd: string | null }
  ) {
    return call<{
      project_id: string;
      user_id: string;
      linked_claude_session_uuid: string | null;
      linked_claude_cwd: string | null;
      linked_at: string | null;
    }>(`/projects/${projectId}/link`, {
      method: "POST",
      userId,
      body: JSON.stringify(input),
    });
  },

  async updatePresence(projectId: string, userId: string, input?: {
    app?: string;
    file?: string;
    line?: number;
    typing?: boolean;
    recent_snippet?: string;
  }) {
    return call<{ ok: true }>(`/projects/${projectId}/presence`, {
      method: "POST",
      userId,
      body: JSON.stringify(input || {}),
    });
  },

  /**
   * Stream a Claude response from /api/v1/chat. Calls onChunk() for each
   * text fragment as it arrives, returns the full assembled text on close.
   *
   * This is the SUPPORTED route for "real Claude" replies in the overlay —
   * it goes through Anthropic's official Messages API (the same model
   * served by claude.ai), not by automating the claude.ai UI.
   */
  async chatStream(
    prompt: string,
    onChunk: (text: string) => void,
    opts: { system_prompt?: string; signal?: AbortSignal } = {}
  ): Promise<string> {
    const res = await fetch(`/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VERONUM_TOKEN}`,
      },
      body: JSON.stringify({ prompt, stream: true, system_prompt: opts.system_prompt }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new ApiError(res.status, text);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assembled = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!frame.startsWith("data:")) continue;
        const payload = frame.slice(5).trim();
        if (payload === "[DONE]") return assembled;
        try {
          const parsed = JSON.parse(payload) as { chunk?: string };
          if (typeof parsed.chunk === "string") {
            assembled += parsed.chunk;
            onChunk(parsed.chunk);
          }
        } catch {
          /* skip malformed */
        }
      }
    }
    return assembled;
  },
};

export { ApiError };
