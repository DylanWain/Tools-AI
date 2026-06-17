/**
 * POST /api/v1/projects/join/{token}
 *
 * Join a project using an invite token. Adds the calling user as a member.
 * Decrements uses_remaining if set; rejects if expired or exhausted.
 *
 * Returns: { project, role }
 */

import {
  isAuthorized,
  unauthorizedResponse,
  badRequest,
  jsonResponse,
  serverError,
  notFound,
  extractUserId,
} from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { token } = await params;
  const supabase = getServiceSupabase();

  // Look up invite
  const { data: invite, error: iErr } = await supabase
    .from("veronum_project_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (iErr) return serverError(iErr.message);
  if (!invite) return notFound("invite not found");
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return notFound("invite expired");
  }
  if (invite.uses_remaining !== null && invite.uses_remaining <= 0) {
    return notFound("invite exhausted");
  }

  // Add as member (idempotent — re-joining returns existing membership)
  const { error: mErr } = await supabase
    .from("veronum_project_members")
    .upsert(
      { project_id: invite.project_id, user_id: userId, role: invite.role },
      { onConflict: "project_id,user_id", ignoreDuplicates: true }
    );
  if (mErr) return serverError(mErr.message);

  // Decrement uses_remaining
  if (invite.uses_remaining !== null) {
    await supabase
      .from("veronum_project_invites")
      .update({ uses_remaining: invite.uses_remaining - 1 })
      .eq("token", token);
  }

  // Return project info
  const { data: project, error: pErr } = await supabase
    .from("veronum_projects")
    .select("*")
    .eq("id", invite.project_id)
    .single();
  if (pErr) return serverError(pErr.message);

  return jsonResponse({ project, role: invite.role });
}
