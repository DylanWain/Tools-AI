"use client";

/**
 * /download — public install page for the Veronum desktop app.
 *
 * Two ways someone lands here:
 *   1. They clicked a magic invite link (`/p/[id]/join?t=…`) without
 *      Veronum installed — the join page links here as the fallback.
 *   2. Direct visit from the marketing site / a friend's link.
 *
 * Always serves the latest signed + notarized DMG hosted on GitHub
 * Releases. The `/latest` URL auto-redirects to whatever the most
 * recent published release is, so this page never goes stale when we
 * cut a new version.
 */

import Link from "next/link";
import { VeronumMark } from "@/components/VeronumMark";
import { captureDownloadClicked } from "@/lib/analytics";

// Both installers build from veronum-desktop (the current app, with the
// code-loads-from-previous-sessions feature) — see its .github/workflows.
// The macOS build is currently UNSIGNED (CI has no Apple cert), so first
// launch shows Gatekeeper's "unverified developer"; replace with a signed
// dmg anytime via `npm run release:mac`.
const LATEST_DMG_URL =
  "https://github.com/DylanWain/veronum-desktop/releases/latest/download/Veronum.dmg";
const LATEST_EXE_URL =
  "https://github.com/DylanWain/veronum-desktop/releases/latest/download/Veronum-Setup.exe";
const RELEASES_PAGE_URL =
  "https://github.com/DylanWain/veronum-desktop/releases/latest";

export default function DownloadPage() {
  return (
    <div
      className="fixed inset-0 bg-white flex items-center justify-center px-6"
      style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
    >
      <div className="max-w-[520px] w-full text-center">
        <VeronumMark className="w-16 h-16 rounded-2xl mx-auto mb-6" />

        <h1
          className="text-[28px] font-medium text-[#1a1a18] mb-3"
          style={{ fontFamily: '"Newsreader", Georgia, serif', letterSpacing: "-0.018em" }}
        >
          Install Veronum
        </h1>

        <p className="text-[14px] text-[#1a1a18] leading-[1.6] mb-2">
          A live layer over Claude Code — share sessions, files, and
          context with your team in real time. Drag-drop documents, see
          who&apos;s editing what, undo per-edit, dispatch up to 10
          parallel agents.
        </p>

        <p className="text-[13.5px] text-[#7d7d76] leading-[1.6] mb-8">
          Free to install. No password, no email asked. macOS (Apple
          Silicon) or Windows 10/11 (x64) · auto-updates after first install.
        </p>

        <div className="flex flex-col gap-2.5 max-w-[340px] mx-auto">
          <a
            href={LATEST_DMG_URL}
            onClick={() => captureDownloadClicked({ os: "macos", kind: "dmg" })}
            className="w-full py-3 rounded-md bg-[#1a1a18] text-white text-[13.5px] font-medium hover:bg-black transition"
          >
            Download for Mac
          </a>
          <a
            href={LATEST_EXE_URL}
            onClick={() => captureDownloadClicked({ os: "windows", kind: "exe" })}
            className="w-full py-3 rounded-md bg-[#1a1a18] text-white text-[13.5px] font-medium hover:bg-black transition"
          >
            Download for Windows
          </a>
          <a
            href={RELEASES_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 rounded-md text-[#7d7d76] hover:text-[#1a1a18] text-[12px] font-medium transition"
          >
            View all releases & changelog →
          </a>
        </div>

        <div className="mt-10 text-left bg-[#f6f6f4] border border-black/[0.06] rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-[0.10em] text-[#9a9a93] font-mono mb-2">
            after you install
          </p>
          <ol className="text-[12.5px] text-[#1a1a18] leading-[1.65] space-y-1 list-decimal pl-4">
            <li>Open <strong>Veronum</strong> from /Applications.</li>
            <li>
              In your terminal, run <code className="font-mono text-[11.5px] bg-black/[0.04] px-1.5 py-0.5 rounded">claude</code> once
              in any folder so Claude Code creates its first session.
            </li>
            <li>Veronum picks it up automatically — no sign-in needed.</li>
            <li>
              Got a magic invite link? Re-click it; Veronum will catch
              the hand-off this time.
            </li>
          </ol>
        </div>

        <p className="text-[11px] text-[#9a9a93] mt-8 leading-[1.6]">
          macOS (Apple Silicon, M1+) or Windows 10/11 (x64). Sign-in is
          anonymous via a local install token; back up{" "}
          <code className="font-mono text-[10.5px] bg-black/[0.04] px-1 py-0.5 rounded">
            ~/Library/Application Support/veronum-overlay/veronum-identity.json
          </code>{" "}
          to migrate machines.
        </p>

        <Link
          href="/"
          className="inline-block mt-6 text-[12px] text-[#9a9a93] hover:text-[#1a1a18]"
        >
          ← veronum.com
        </Link>
      </div>
    </div>
  );
}
