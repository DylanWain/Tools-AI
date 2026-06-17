"use client";

/**
 * /p/[id]/join?t=TOKEN — magic-link landing page.
 *
 * The host shares a link like `https://veronum.com/p/<id>/join?t=<token>`.
 * Recipient clicks it. This page does ONE thing: it tries to hand the
 * invite to the recipient's local Veronum overlay via the `veronum://`
 * custom protocol. The Electron app, registered as the OS handler for
 * that scheme, opens the JoinSharedModal pre-armed with the link.
 *
 * If Veronum isn't installed, the protocol launch silently fails and the
 * page stays put with a "Don't have Veronum? Download it" CTA. Users who
 * just installed it can click "Open in Veronum" to retry the launch.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { VeronumMark } from "@/components/VeronumMark";

export default function JoinProjectPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const token = search.get("t");

  const [tried, setTried] = useState(false);

  // The custom-protocol URL we ask the OS to route to Veronum. We carry
  // the token + projectId so the desktop side can claim and bind in one go.
  const protocolUrl = token
    ? `veronum://join?t=${encodeURIComponent(token)}&p=${encodeURIComponent(params.id)}`
    : null;

  const launchVeronum = () => {
    if (!protocolUrl) return;
    // Triggering navigation to the custom scheme fires the OS handler.
    // If Veronum is installed, the app comes to the foreground; if not,
    // the browser ignores the navigation and we stay on this page.
    window.location.href = protocolUrl;
    setTried(true);
  };

  // Auto-fire on mount so the common path (Veronum installed) feels
  // instant — the user sees the page for a blink, then their overlay
  // takes over.
  useEffect(() => {
    if (protocolUrl) launchVeronum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolUrl]);

  return (
    <div
      className="fixed inset-0 bg-white flex items-center justify-center px-6"
      style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
    >
      <div className="max-w-[440px] w-full text-center">
        <VeronumMark className="w-14 h-14 rounded-2xl mx-auto mb-5" />

        {!token ? (
          <>
            <h1
              className="text-[22px] font-medium text-[#1a1a18] mb-2"
              style={{ fontFamily: '"Newsreader", Georgia, serif' }}
            >
              Missing invite token
            </h1>
            <p className="text-[13px] text-[#7d7d76]">
              The link you opened doesn&apos;t carry a <code>?t=…</code> token.
              Ask whoever shared it for a fresh link.
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-[22px] font-medium text-[#1a1a18] mb-2"
              style={{ fontFamily: '"Newsreader", Georgia, serif' }}
            >
              Opening in Veronum…
            </h1>
            <p className="text-[13px] text-[#7d7d76] mb-6">
              {tried
                ? "If Veronum is installed, it should be on screen now. Otherwise:"
                : "Hand-off to the desktop app in a moment…"}
            </p>

            <div className="flex flex-col gap-2.5 max-w-[320px] mx-auto">
              <button
                onClick={launchVeronum}
                className="w-full py-2.5 rounded-md bg-[#1a1a18] text-white text-[13px] font-medium hover:bg-black transition"
              >
                Open in Veronum
              </button>
              <a
                href="/download"
                className="w-full py-2.5 rounded-md bg-black/[0.05] hover:bg-black/[0.08] text-[#1a1a18] text-[13px] font-medium transition"
              >
                Don&apos;t have Veronum? Download it
              </a>
            </div>

            <p className="text-[11px] text-[#9a9a93] mt-6 leading-[1.5]">
              After installing, return here and click <strong>Open in Veronum</strong>.
              The same link works any number of times.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
