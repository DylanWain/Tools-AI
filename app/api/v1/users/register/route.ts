/**
 * POST /api/v1/users/register
 *
 * Called by Veronum on first run. Creates (or returns) a user row keyed
 * by the install_token (a UUID generated on the user's machine and stored
 * in userData). The returned user.id becomes the x-veronum-user-id header
 * on every subsequent request from this install.
 *
 * Body: { install_token: string, display_name: string, avatar_color?: string, email?: string }
 * Returns: { id, install_token, display_name, avatar_color, email, created_at }
 */

import { isAuthorized, unauthorizedResponse, badRequest, jsonResponse, serverError } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let body: { install_token?: string; display_name?: string; avatar_color?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected JSON body");
  }

  if (!body.install_token || typeof body.install_token !== "string") {
    return badRequest("install_token required");
  }
  if (!body.display_name || typeof body.display_name !== "string") {
    return badRequest("display_name required");
  }

  const supabase = getServiceSupabase();

  // Upsert by install_token (idempotent — re-running register on same install returns same user)
  const { data, error } = await supabase
    .from("veronum_users")
    .upsert(
      {
        install_token: body.install_token,
        display_name: body.display_name,
        avatar_color: body.avatar_color || "#cc785c",
        email: body.email,
      },
      { onConflict: "install_token" }
    )
    .select()
    .single();

  if (error) return serverError(error.message);
  return jsonResponse(data);
}
