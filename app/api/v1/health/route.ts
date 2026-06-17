/**
 * GET /api/v1/health — quick status check for Veronum bridge clients.
 * No auth required. Returns env-var configuration status so the user
 * can verify deployment from the DMG without needing logs.
 */

import { checkSupabaseConfig } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const supabaseErr = checkSupabaseConfig();

  return new Response(
    JSON.stringify({
      ok: true,
      service: "veronum-api",
      version: "v1",
      time: new Date().toISOString(),
      config: {
        openai_key: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
        anthropic_key: !!process.env.ANTHROPIC_API_KEY,
        supabase: supabaseErr === null ? true : supabaseErr,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
