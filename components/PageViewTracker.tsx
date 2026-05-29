"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase";

/**
 * PageViewTracker — fires one `page_view` row in usage_events for
 * every client-side navigation (and for the initial mount). Privacy:
 * the row contains pathname + signed-in user_id (when available) +
 * an install_id that's a per-browser random UUID stored in
 * localStorage. No referrer, no IP, no query strings.
 *
 * Mounted once in the root layout so every route is tracked
 * automatically. Fire-and-forget — failures don't surface.
 */

function getOrCreateInstallId(): string {
  if (typeof window === "undefined") return "";
  try {
    const KEY = "veronum-web-install-id";
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      (crypto.randomUUID && crypto.randomUUID()) ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "";
  }
}

export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    // Skip tracking the admin page itself — those visits are us
    // checking metrics, not real traffic.
    if (pathname.startsWith("/admin")) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        await supabase.from("usage_events").insert({
          event_type: "page_view",
          page: pathname,
          user_id: session?.user?.id || null,
          install_id: getOrCreateInstallId(),
        });
      } catch { /* ignore — analytics must not break the page */ }
    })();
    return () => { cancelled = true; };
  }, [pathname]);
  return null;
}
