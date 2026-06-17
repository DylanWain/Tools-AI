/**
 * POST /api/v1/projects/{id}/files — upsert a file's content (or null for delete)
 * GET  /api/v1/projects/{id}/files — list current files in the shared folder
 *
 * The desktop watcher calls POST whenever a file in the bound cwd is
 * saved. The same request also writes an immutable row to
 * veronum_file_changes for the activity feed. Other members' Veronum
 * instances subscribe to Supabase Realtime on these tables and apply
 * incoming changes to their own local copy of the folder.
 *
 * Path normalization happens in the desktop watcher, but we re-validate
 * here defense-in-depth: relative, forward-slash-only, no `..` segments,
 * no leading slash. Anything else is rejected.
 */

import {
  isAuthorized,
  unauthorizedResponse,
  badRequest,
  jsonResponse,
  serverError,
  forbidden,
  extractUserId,
} from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// 1 MB cap matches the desktop watcher's filter — anything bigger is
// almost always a build output / large asset that doesn't belong in a
// live-sync feed.
const MAX_CONTENT_BYTES = 1024 * 1024;

function isUnsafePath(p: string): boolean {
  if (!p || typeof p !== "string") return true;
  if (p.length > 1024) return true;
  if (p.startsWith("/") || p.startsWith("\\")) return true;
  if (p.includes("\0")) return true;
  // Forbid traversal segments. Normalize separators first.
  const segments = p.replace(/\\/g, "/").split("/");
  return segments.some((s) => s === ".." || s === ".");
}

async function checkMembership(
  supabase: ReturnType<typeof getServiceSupabase>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("veronum_project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 120);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;
  const supabase = getServiceSupabase();

  if (!(await checkMembership(supabase, projectId, userId))) {
    return forbidden("not a member of this project");
  }

  const url = new URL(req.url);
  const since = url.searchParams.get("since"); // updated_at cursor
  const includeContent = url.searchParams.get("content") === "1";

  const cols = includeContent
    ? "id, file_path, content, bytes_size, source_app, updated_by, updated_by_name, updated_by_color, version, updated_at"
    : "id, file_path, bytes_size, source_app, updated_by, updated_by_name, updated_by_color, version, updated_at";

  let q = supabase
    .from("veronum_shared_files")
    .select(cols)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (since) q = q.gt("updated_at", since);

  const { data, error } = await q;
  if (error) return serverError(error.message);
  return jsonResponse({ files: data || [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 600); // ~10 saves/sec sustained
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;
  const supabase = getServiceSupabase();

  if (!(await checkMembership(supabase, projectId, userId))) {
    return forbidden("not a member of this project");
  }

  let body: {
    file_path?: string;
    content?: string | null;
    bytes_size?: number;
    source_app?: string;
    lines_added?: number;
    lines_removed?: number;
    change_kind?: "create" | "modify" | "delete" | "rename";
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected JSON body");
  }

  if (!body.file_path || typeof body.file_path !== "string") {
    return badRequest("file_path required");
  }
  if (isUnsafePath(body.file_path)) {
    return badRequest("file_path is unsafe (traversal/absolute/null bytes)");
  }
  const isDelete = body.content === null || body.content === undefined;
  if (!isDelete && typeof body.content !== "string") {
    return badRequest("content must be string or null");
  }
  const size = isDelete
    ? 0
    : Math.min(body.bytes_size ?? Buffer.byteLength(body.content!, "utf8"), MAX_CONTENT_BYTES);
  if (!isDelete && Buffer.byteLength(body.content!, "utf8") > MAX_CONTENT_BYTES) {
    return badRequest(`file too large for live sync (>${MAX_CONTENT_BYTES} bytes)`);
  }

  // Author snapshot (for the activity feed display)
  const { data: user, error: uErr } = await supabase
    .from("veronum_users")
    .select("display_name, avatar_color")
    .eq("id", userId)
    .single();
  if (uErr) return serverError(uErr.message);

  // Read existing for version bump + bytes_before
  const { data: existing } = await supabase
    .from("veronum_shared_files")
    .select("version, bytes_size")
    .eq("project_id", projectId)
    .eq("file_path", body.file_path)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;
  const bytesBefore = existing?.bytes_size ?? 0;

  // Upsert the canonical file row
  const { error: upErr } = await supabase
    .from("veronum_shared_files")
    .upsert(
      {
        project_id: projectId,
        file_path: body.file_path,
        content: isDelete ? null : body.content,
        bytes_size: size,
        source_app: body.source_app || null,
        updated_by: userId,
        updated_by_name: user.display_name,
        updated_by_color: user.avatar_color,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,file_path" }
    );
  if (upErr) return serverError(upErr.message);

  // Append to the activity feed
  const changeKind = body.change_kind || (isDelete ? "delete" : existing ? "modify" : "create");
  await supabase.from("veronum_file_changes").insert({
    project_id: projectId,
    file_path: body.file_path,
    change_kind: changeKind,
    bytes_before: bytesBefore,
    bytes_after: size,
    lines_added: body.lines_added ?? null,
    lines_removed: body.lines_removed ?? null,
    source_app: body.source_app || null,
    author_id: userId,
    author_name: user.display_name,
    author_color: user.avatar_color,
  });

  return jsonResponse({ ok: true, version: nextVersion });
}
