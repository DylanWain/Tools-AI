"use client";

/**
 * In-browser preview pane — Claude-artifacts-style.
 *
 * The user's virtual project gets compiled in-memory into a single
 * self-contained HTML string and rendered inside a sandboxed iframe
 * via `srcdoc`. No server, no daemon, no localhost, no install.
 * Same UX you see in Claude artifacts and ChatGPT canvas.
 *
 *   Generated code → buildIframePreview(project) → <iframe srcdoc>
 *
 * For projects that need a real bundler (Next.js / Vite / Electron /
 * anything with a build step), we show a "Bridge required" card with
 * a link to /pair-bridge. Those projects bypass the iframe entirely
 * because the browser can't run a Node bundler standalone.
 *
 * The component is fully synchronous — no fetch, no spinner, no
 * popup-blocker dance. Switching to the Preview tab renders the
 * iframe immediately.
 */

import { useMemo, useRef, useState } from "react";
import type { ProjectFile } from "@/lib/compare/sessions";
import { buildIframePreview, type IframePreview } from "@/lib/compare/iframePreview";
import Link from "next/link";

type Props = {
  /** The user's virtual project files — same shape CompareChat already
   *  passes to SplitWorkspace. Pure input; we re-build the iframe
   *  whenever this changes (after the user picks a winning card,
   *  edits a file, etc.). */
  project: Record<string, ProjectFile>;
  /** True when the user is signed in AND on a paid tier. Free users
   *  see a locked panel pointing to the upsell. */
  canPreview: boolean;
};

export function SandboxPreview({ project, canPreview }: Props) {
  // Re-build on every project change. Pure, memoized so we don't
  // re-stringify the same project on unrelated re-renders.
  const preview: IframePreview = useMemo(
    () => buildIframePreview(project),
    [project],
  );

  // Force a re-render of the iframe (re-mounts it via the key bump)
  // when the user hits Refresh. Cheap, lets users retry after an
  // edit without changing the project shape.
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /** Pop the current preview into a real browser tab. Uses a blob URL
   *  so the page has a real origin (about:srcdoc has quirks like no
   *  document.cookie, broken history.pushState, etc). */
  function openInNewTab() {
    if (preview.kind !== "html") return;
    const blob = new Blob([preview.srcdoc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    // Revoke after the new tab has had time to load. Vague but fine
    // for previews — the blob lives ~30s, plenty for the page to load.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (!w) {
      // Popup-blocked. Surface it inline so the user knows.
      window.alert("Your browser blocked the new tab. Allow popups for this site to use Open in tab.");
    }
  }

  // Locked panel — free user. The Preview tab itself is locked at
  // the SplitWorkspace level, but if a paid user gets downgraded
  // mid-session we still render a soft block here.
  if (!canPreview) {
    return <LockedPanel />;
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0e0e0e]">
      <Toolbar
        preview={preview}
        onReload={() => setReloadKey((n) => n + 1)}
        onOpenInTab={preview.kind === "html" ? openInNewTab : null}
      />
      <div className="flex-1 min-h-0 relative">
        {preview.kind === "html" && (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            // `allow-scripts` lets the user's JS run; we deliberately
            // omit `allow-same-origin` so the iframe can't read this
            // app's cookies / localStorage / sessionStorage. Matches
            // Claude artifacts' sandbox posture.
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            srcDoc={preview.srcdoc}
            title={`Preview of ${preview.entry}`}
            className="absolute inset-0 w-full h-full bg-white border-0"
          />
        )}
        {preview.kind === "needs-bridge" && <NeedsBridgePanel preview={preview} />}
        {preview.kind === "empty" && <EmptyPanel preview={preview} />}
      </div>
    </div>
  );
}

function Toolbar({
  preview, onReload, onOpenInTab,
}: {
  preview: IframePreview;
  onReload: () => void;
  onOpenInTab: (() => void) | null;
}) {
  return (
    <div className="shrink-0 h-9 flex items-center gap-2 px-3 bg-[#1a1918] border-b border-white/[0.06] text-[12px] text-white/55">
      <span className="inline-flex items-center gap-1.5">
        <StatusDot kind={preview.kind} />
        <span className="text-white/70">
          {preview.kind === "html" && (
            <>Preview · <code className="text-white/45 font-mono text-[11px]">{preview.entry}</code></>
          )}
          {preview.kind === "needs-bridge" && "Bridge required"}
          {preview.kind === "empty" && "Empty"}
        </span>
      </span>
      <div className="flex-1" />
      {preview.kind === "html" && (
        <>
          <button
            type="button"
            onClick={onReload}
            title="Reload the iframe"
            className="px-2 py-1 rounded text-white/55 hover:text-white hover:bg-white/[0.06] transition"
          >
            ↻ Reload
          </button>
          {onOpenInTab && (
            <button
              type="button"
              onClick={onOpenInTab}
              title="Open this preview in a new browser tab"
              className="px-2 py-1 rounded text-white/55 hover:text-white hover:bg-white/[0.06] transition"
            >
              ↗ Open in tab
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StatusDot({ kind }: { kind: IframePreview["kind"] }) {
  const color = kind === "html" ? "#5cd6a7" : kind === "needs-bridge" ? "#d97757" : "#777";
  return (
    <span
      aria-hidden
      style={{ background: color }}
      className="inline-block w-1.5 h-1.5 rounded-full"
    />
  );
}

function NeedsBridgePanel({ preview }: { preview: Extract<IframePreview, { kind: "needs-bridge" }> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <div className="max-w-[480px] text-center">
        <div className="inline-flex w-12 h-12 rounded-xl bg-[#d97757]/12 items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97757" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M2 20h20" />
            <path d="M8 16v4M16 16v4" />
          </svg>
        </div>
        <h2 className="text-white font-serif text-[19px] mb-2">This project needs a real dev server</h2>
        <p className="text-white/55 text-[13.5px] leading-[1.55] mb-1">
          {preview.detail}
        </p>
        <p className="text-white/35 text-[12px] mt-3 font-mono">Detected: {preview.reason}</p>
        <Link
          href="/pair-bridge"
          className="inline-flex mt-6 px-4 py-2 rounded-lg bg-[#d97757] hover:bg-[#c66645] text-white text-[13px] font-medium transition"
        >
          Pair your Bridge →
        </Link>
        <p className="text-white/35 text-[11.5px] mt-4">
          The Bridge runs on your Mac so <code>npm install</code> + dev server execute locally. No Vercel costs.
        </p>
      </div>
    </div>
  );
}

function EmptyPanel({ preview }: { preview: Extract<IframePreview, { kind: "empty" }> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <div className="max-w-[420px] text-center">
        <p className="text-white/40 text-[13.5px]">{preview.detail}</p>
      </div>
    </div>
  );
}

function LockedPanel() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <div className="max-w-[420px] text-center">
        <p className="text-white/55 text-[13.5px] mb-3">
          Live preview is on the paid tier. Subscribe ($25/mo) or pay-as-you-go to unlock it.
        </p>
        <Link href="/welcome" className="inline-flex px-4 py-2 rounded-lg bg-[#d97757] hover:bg-[#c66645] text-white text-[13px] font-medium transition">
          See plans
        </Link>
      </div>
    </div>
  );
}
