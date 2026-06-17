/**
 * POST /api/v1/projects/{id}/presence
 *
 * Upsert this user's presence row for the project. Veronum calls this
 * every ~5s to refresh, plus immediately on tool/file change. Other
 * teammates' overlays subscribe to the presence table via Realtime
 * and re-render when this row updates.
 *
 * Body: { app?, file?, line?, typing?, recent_snippet? }
 *
 * Returns: { ok: true }
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
  // Higher rate limit — presence is heartbeat-like
  const rl = checkRateLimit(req, 600);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;
  const supabase = getServiceSupabase();

  // Membership check
  const { data: member } = await supabase
    .from("veronum_project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return forbidden("not a member of this project");

  let body: {
    app?: string;
    file?: string;
    line?: number;
    typing?: boolean;
    recent_snippet?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body = "I'm here" heartbeat
  }

  const { error } = await supabase
    .from("veronum_presence")
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        app: body.app,
        file: body.file,
        line: body.line,
        typing: !!body.typing,
        recent_snippet: body.recent_snippet,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id" }
    );

  if (error) return serverError(error.message);
  return jsonResponse({ ok: true });
}
