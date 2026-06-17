/**
 * GET  /api/v1/projects     — list projects this user is a member of
 * POST /api/v1/projects     — create a new project (current user becomes owner)
 *
 * Both require x-veronum-user-id header (from /api/v1/users/register).
 */

import {
  isAuthorized,
  unauthorizedResponse,
  badRequest,
  jsonResponse,
  serverError,
  extractUserId,
} from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 120);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("veronum_project_members")
    .select(
      `
      role,
      joined_at,
      projects:veronum_projects!project_id (
        id, name, color, owner_id, created_at, archived_at
      )
    `
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error) return serverError(error.message);

  // Flatten. Supabase's typed embedded select returns the joined relation
  // as an array (it can't statically infer 1:1), so normalize through unknown.
  type ProjectRow = {
    id: string;
    name: string;
    color: string;
    owner_id: string;
    created_at: string;
    archived_at: string | null;
  };
  type Row = { role: string; joined_at: string; projects: ProjectRow | ProjectRow[] | null };

  const rows = (data as unknown as Row[]) || [];
  const flat = rows
    .map((r) => {
      const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
      if (!project) return null;
      return { role: r.role, joined_at: r.joined_at, ...project };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return jsonResponse({ projects: flat });
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const userId = extractUserId(req);
  if (!userId) return badRequest("x-veronum-user-id header required");

  let body: { name?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected JSON body");
  }
  if (!body.name || typeof body.name !== "string") return badRequest("name required");

  const supabase = getServiceSupabase();

  // Create project
  const { data: project, error: pErr } = await supabase
    .from("veronum_projects")
    .insert({ name: body.name, color: body.color || "#cc785c", owner_id: userId })
    .select()
    .single();
  if (pErr) return serverError(pErr.message);

  // Add creator as owner-role member
  const { error: mErr } = await supabase
    .from("veronum_project_members")
    .insert({ project_id: project.id, user_id: userId, role: "owner" });
  if (mErr) return serverError(mErr.message);

  return jsonResponse(project, 201);
}
