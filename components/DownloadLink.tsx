"use client";

import { getBrowserSupabase } from "@/lib/supabase";
import type { AnchorHTMLAttributes, ReactNode } from "react";

/**
 * DownloadLink — wraps an <a> tag and records a download_events row
 * BEFORE the browser navigates to the asset. Uses navigator.sendBeacon
 * when available so the tracking call survives the page unload; falls
 * back to a fire-and-forget Supabase insert otherwise.
 *
 * The browser still follows the href normally — we don't preventDefault.
 * The event records: ts (server-default now()), user_id (if signed in),
 * source (e.g. "nav" / "footer" / "pricing"), app_version, ua.
 *
 * Drop-in replacement for <a href="...">Download</a> across the site
 * (Nav, Footer, Pricing, /welcome, /s/[id]).
 */

const SUPABASE_URL = "https://synpjcammfjebwsmtfpz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1h3d9dMB7f5JK_8aLHR5ig_GiurDzuS";

// Pull v0.3.6 from the URL when possible so the analytics row knows
// exactly which version the user clicked. Falls back to a static
// "latest" marker if we can't parse.
function extractAppVersion(href: string): string {
  const m = href.match(/\/releases\/(?:tag|latest|download)\/(?:v?)(\d+\.\d+\.\d+)/);
  return m?.[1] || "latest";
}

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  source: string;
  children: ReactNode;
};

export function DownloadLink({ href, source, children, onClick, ...rest }: Props) {
  return (
    <a
      href={href}
      onClick={(e) => {
        // Fire-and-forget tracking. We don't await it — the browser is
        // about to navigate away anyway. sendBeacon is the right call
        // here: it's designed to survive unload events.
        try {
          const payload = {
            source,
            app_version: extractAppVersion(href),
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          };
          // Read user_id from the Supabase auth session if available,
          // but don't block on it. Async path runs in parallel.
          void (async () => {
            try {
              const supabase = getBrowserSupabase();
              const { data: { session } } = await supabase.auth.getSession();
              const row = { ...payload, user_id: session?.user?.id ?? null };
              if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                const url = `${SUPABASE_URL}/rest/v1/download_events`;
                const blob = new Blob(
                  [JSON.stringify([row])],
                  { type: "application/json" },
                );
                // sendBeacon doesn't accept custom headers, so we
                // fall through to fetch when auth headers are needed.
                const ok = navigator.sendBeacon(
                  `${url}?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
                  blob,
                );
                if (!ok) {
                  await fetch(url, {
                    method: "POST",
                    headers: {
                      apikey: SUPABASE_ANON_KEY,
                      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                      "Content-Type": "application/json",
                      Prefer: "return=minimal",
                    },
                    body: JSON.stringify(row),
                    keepalive: true,
                  });
                }
              } else {
                await fetch(`${SUPABASE_URL}/rest/v1/download_events`, {
                  method: "POST",
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    "Content-Type": "application/json",
                    Prefer: "return=minimal",
                  },
                  body: JSON.stringify(row),
                  keepalive: true,
                });
              }
            } catch {
              /* never block download */
            }
          })();
        } catch {
          /* same */
        }
        // Let the original onClick (if any) run too, then let the browser navigate.
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
