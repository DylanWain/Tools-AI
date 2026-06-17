/**
 * POST /api/v1/projects/{id}/invite
 *
 * Generate a shareable invite token. Returns { token, url } so the
 * Veronum overlay's "Generate Link" button can copy it to clipboard.
 *
 * Body: { role?: "participant"|"viewer", expires_in_hours?: number, uses_remaining?: number }
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
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

function genToken(): string {
  // URL-safe base64, ~22 chars
  return randomBytes(16).toString("base64url");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const { id: projectId } = await params;
  const supabase = getServiceSupabase();

  // Must be a member to issue invites
  const { data: member } = await supabase
    .from("veronum_project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return forbidden("not a member of this project");

  let body: { role?: string; expires_in_hours?: number; uses_remaining?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const role = body.role && ["participant", "viewer"].includes(body.role) ? body.role : "participant";
  const expiresAt = body.expires_in_hours
    ? new Date(Date.now() + body.expires_in_hours * 3600_000).toISOString()
    : null;

  const token = genToken();

  const { data, error } = await supabase
    .from("veronum_project_invites")
    .insert({
      token,
      project_id: projectId,
      role,
      created_by: userId,
      expires_at: expiresAt,
      uses_remaining: body.uses_remaining ?? null,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  // Construct URL using the request's origin so it works in dev + prod.
  // When called from a non-browser (Electron main process via Node fetch),
  // there's no Origin header — derive protocol from req.url instead so
  // localhost stays http and prod stays https.
  let origin = req.headers.get("origin");
  if (!origin) {
    try {
      const reqUrl = new URL(req.url);
      origin = `${reqUrl.protocol}//${req.headers.get("host") || reqUrl.host}`;
    } catch {
      origin = `https://${req.headers.get("host") || "thetoolswebsite.com"}`;
    }
  }
  const url = `${origin}/p/${projectId}/join?t=${token}`;

  return jsonResponse({ ...data, url });
}
