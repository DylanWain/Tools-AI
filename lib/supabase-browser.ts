"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client for Realtime subscriptions only. We never
 * write through this client — all writes go through /api/v1/* (which use
 * the service-role key + bearer-token auth + RLS bypass).
 *
 * The anon key is safe to expose: RLS prevents reads of anything the user
 * isn't a member of. The service key (used in lib/supabase.ts) is server-only.
 */

let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Supabase env vars missing in browser: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  cached = createClient(url, anon, {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: false },
  });
  return cached;
}
