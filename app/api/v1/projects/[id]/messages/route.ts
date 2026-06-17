/**
 * GET  /api/v1/projects/{id}/messages?since=cursor — paginated history
 * POST /api/v1/projects/{id}/messages              — post a new message
 *
 * Real-time updates flow via Supabase Realtime — each Veronum overlay
 * subscribes to the `messages` table for this project_id and receives
 * inserts directly. The POST here triggers that broadcast automatically
 * because the messages table is in the supabase_realtime publication.
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
  const rl = checkRateLimit(req, 240);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;
  const supabase = getServiceSupabase();

  if (!(await checkMembership(supabase, projectId, userId))) {
    return forbidden("not a member of this project");
  }

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

  let query = supabase
    .from("veronum_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (since) query = query.gt("created_at", since);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  // Return chronological order (oldest first) for easier rendering
  return jsonResponse({ messages: (data || []).reverse() });
}

export async function POST(
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

  let body: {
    kind?: "human" | "ai" | "system";
    body?: string;
    app?: string;
    model?: string;
    in_reply_to?: number;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected JSON body");
  }
  if (!body.body || typeof body.body !== "string") return badRequest("body field required");
  if (!body.kind || !["human", "ai", "system"].includes(body.kind)) {
    return badRequest("kind must be human|ai|system");
  }

  // Look up author info (snapshot to message row so it survives user delete)
  const { data: user, error: uErr } = await supabase
    .from("veronum_users")
    .select("display_name, avatar_color")
    .eq("id", userId)
    .single();
  if (uErr) return serverError(uErr.message);

  const isHumanFromUser = body.kind === "human";

  const { data, error } = await supabase
    .from("veronum_messages")
    .insert({
      project_id: projectId,
      author_id: body.kind === "system" ? null : userId,
      author_name: body.kind === "system" ? "system" : isHumanFromUser ? user.display_name : "Claude",
      author_color: body.kind === "system" ? "#9a9a93" : isHumanFromUser ? user.avatar_color : "#cc785c",
      kind: body.kind,
      body: body.body,
      app: body.app,
      model: body.model,
      in_reply_to: body.in_reply_to,
      metadata: body.metadata || {},
    })
    .select()
    .single();

  if (error) {
    // Dedup conflict from the (project_id, source_uuid, line_idx) unique
    // index — the JSONL watcher restarted and replayed an already-mirrored
    // line. Idempotent by design; tell the caller it was a no-op.
    if (error.code === "23505") {
      return jsonResponse({ skipped: true, reason: "already mirrored" }, 200);
    }
    return serverError(error.message);
  }
  return jsonResponse(data, 201);
}
