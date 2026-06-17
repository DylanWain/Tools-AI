/**
 * GET /api/v1/projects/{id}/changes — paginated activity feed
 *
 * Returns the immutable history of file edits in this Veronum project,
 * tagged with author + source app + change kind. Supports filters for
 * the React UI's sort/group controls (by author, by file, by app, since).
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 240);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;
  const supabase = getServiceSupabase();

  const { data: member } = await supabase
    .from("veronum_project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return forbidden("not a member of this project");

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const author = url.searchParams.get("author");
  const filePath = url.searchParams.get("file_path");
  const sourceApp = url.searchParams.get("source_app");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 1000);

  let q = supabase
    .from("veronum_file_changes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (since) q = q.gt("created_at", since);
  if (author) q = q.eq("author_id", author);
  if (filePath) q = q.eq("file_path", filePath);
  if (sourceApp) q = q.eq("source_app", sourceApp);

  const { data, error } = await q;
  if (error) return serverError(error.message);
  return jsonResponse({ changes: data || [] });
}
