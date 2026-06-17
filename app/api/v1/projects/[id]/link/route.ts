/**
 * POST /api/v1/projects/{id}/link
 *
 * Bind the calling user's local Claude Code session to this Veronum project.
 * This is what tells the watcher in the desktop app "the JSONL at <cwd>/<uuid>.jsonl
 * is THIS user's contribution to the shared room — mirror new turns into
 * veronum_messages tagged with my user_id."
 *
 * Each member can re-bind to a different local session at any time. Old
 * mirrored turns stay in the project; only future tail-pushes use the new
 * binding.
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 60);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;

  let body: { linked_claude_session_uuid?: string | null; linked_claude_cwd?: string | null };
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected JSON body");
  }

  const sessionUuid = body.linked_claude_session_uuid ?? null;
  const cwd = body.linked_claude_cwd ?? null;

  // Allow null/null to UNLINK. If one is set, the other must be set too.
  if ((sessionUuid && !cwd) || (!sessionUuid && cwd)) {
    return badRequest("linked_claude_session_uuid and linked_claude_cwd must be set together (or both null to unlink)");
  }
  if (sessionUuid && typeof sessionUuid !== "string") return badRequest("linked_claude_session_uuid must be string");
  if (cwd && typeof cwd !== "string") return badRequest("linked_claude_cwd must be string");

  const supabase = getServiceSupabase();

  // Membership check (also catches non-existent project) + update in one query
  const { data, error } = await supabase
    .from("veronum_project_members")
    .update({
      linked_claude_session_uuid: sessionUuid,
      linked_claude_cwd: cwd,
      linked_at: sessionUuid ? new Date().toISOString() : null,
    })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .select("project_id, user_id, linked_claude_session_uuid, linked_claude_cwd, linked_at")
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return forbidden("not a member of this project");

  return jsonResponse(data);
}
