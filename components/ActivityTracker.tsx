"use client";

/**
 * ActivityTracker — mounted once in app/layout.tsx (sibling to the
 * existing PageViewTracker). Wires up the page lifecycle events for
 * the admin dashboard's Activity tab:
 *
 *   page_enter   on mount + on every client-side route change
 *   page_leave   on visibilitychange→hidden + beforeunload, with
 *                duration_ms = ms since the matching page_enter
 *
 * mode_change events are NOT fired from here — those happen inside
 * CompareChat where the toggle state lives. It calls
 * trackActivity({kind: 'mode_change', ...}) directly.
 *
 * One enter per route visit, paired with one leave. The leave fires
 * on visibilitychange (tab hidden) AND beforeunload (tab closing /
 * page reloading) — we de-dupe by tracking whether we've already
 * sent the leave for the current enter.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackActivity } from "@/lib/activity/track";

export function ActivityTracker() {
  const pathname = usePathname();
  // Mark + only-fire-leave-once-per-enter coordination.
  const enteredAtRef = useRef<number | null>(null);
  const leaveSentRef = useRef<boolean>(false);
  const lastPathRef = useRef<string | null>(null);

  // Fire page_enter on every pathname change. Also handles initial mount.
  useEffect(() => {
    if (!pathname) return;
    // Don't track admin views — they're you checking metrics.
    if (pathname.startsWith("/admin")) return;
    // If pathname changed mid-session, flush a leave for the previous
    // path before logging the new enter.
    if (lastPathRef.current && lastPathRef.current !== pathname && enteredAtRef.current && !leaveSentRef.current) {
      trackActivity({
        kind: "page_leave",
        path: lastPathRef.current,
        durationMs: Date.now() - enteredAtRef.current,
      });
    }
    enteredAtRef.current = Date.now();
    leaveSentRef.current = false;
    lastPathRef.current = pathname;
    trackActivity({ kind: "page_enter", path: pathname });
  }, [pathname]);

  // Browser-lifecycle listeners — fire page_leave when the tab
  // closes, the page reloads, or the user switches to another tab.
  useEffect(() => {
    function flushLeave() {
      if (leaveSentRef.current) return;
      if (!enteredAtRef.current) return;
      leaveSentRef.current = true;
      const path = lastPathRef.current ?? (typeof window !== "undefined" ? window.location.pathname : "");
      if (path.startsWith("/admin")) return;
      trackActivity({
        kind: "page_leave",
        path,
        durationMs: Date.now() - enteredAtRef.current,
      });
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flushLeave();
      else if (document.visibilityState === "visible") {
        // Re-arm the enter timer when the user comes back to the tab.
        // We don't fire another page_enter for visibility flips because
        // that would inflate visit counts.
        enteredAtRef.current = Date.now();
        leaveSentRef.current = false;
      }
    }
    window.addEventListener("beforeunload", flushLeave);
    window.addEventListener("pagehide", flushLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flushLeave);
      window.removeEventListener("pagehide", flushLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
