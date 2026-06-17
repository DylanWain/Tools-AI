/**
 * Bearer token validation for the Veronum bridge API.
 *
 * Existing shipped DMG (Veronum 1.0.x) hardcodes this token in
 * dwc-meetings-bridge.js, dwc-subscription-bridge.js, etc. We honor
 * it for backwards compatibility. New endpoints should additionally
 * support per-user JWTs (added later).
 */

export const SHIPPED_DMG_TOKEN = "tai-aadbe6df1780d20814e1271c7273e117";

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function isAuthorized(req: Request): boolean {
  const token = extractBearer(req);
  if (!token) return false;
  // Constant-time-ish equality (length first, then char compare)
  if (token.length !== SHIPPED_DMG_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ SHIPPED_DMG_TOKEN.charCodeAt(i);
  }
  return diff === 0;
}

export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "unauthorized", message: "Bearer token missing or invalid" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Extract the Veronum user UUID from the request. Veronum stores its
 * install's user id in userData on first run (after /api/v1/users/register)
 * and sends it as the x-veronum-user-id header on every shared-chat request.
 */
export function extractUserId(req: Request): string | null {
  return req.headers.get("x-veronum-user-id");
}

export function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: "bad_request", message }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

export function notFound(message = "not found"): Response {
  return new Response(
    JSON.stringify({ error: "not_found", message }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}

export function forbidden(message = "forbidden"): Response {
  return new Response(
    JSON.stringify({ error: "forbidden", message }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function serverError(message: string): Response {
  return new Response(
    JSON.stringify({ error: "server_error", message }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
