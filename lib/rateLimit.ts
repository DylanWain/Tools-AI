/**
 * Per-IP rate limiter for API routes. In-memory (per Vercel function
 * instance — multiple isolates means imperfect global enforcement, but
 * sufficient as basic abuse insurance until we move to Upstash/Redis).
 *
 * Default: 60 requests / minute / IP.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;

export function clientIP(req: Request): string {
  // Vercel populates these headers
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function checkRateLimit(
  req: Request,
  limit: number = DEFAULT_LIMIT
): { allowed: boolean; remaining: number; resetAt: number } {
  const ip = clientIP(req);
  const now = Date.now();
  const existing = buckets.get(ip);

  if (!existing || existing.resetAt < now) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(ip, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function rateLimitResponse(resetAt: number): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Too many requests. Try again shortly.",
      retryAt: new Date(resetAt).toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  );
}
