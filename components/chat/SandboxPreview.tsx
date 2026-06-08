"use client";

/**
 * SandboxPreview — the live preview panel that opens when the user
 * clicks "▶ Preview" in the workspace header.
 *
 * States:
 *   idle       — no preview running, button to launch
 *   spawning   — POST /api/sandbox/preview in flight (60-90s without snapshot)
 *   ready      — iframe loaded, showing the live dev server
 *   error      — spawn failed, show the actionable error message
 *   expired    — 10-min timeout reached, button to relaunch
 *
 * Cost-awareness: each spawn costs real money (Vercel Sandbox is metered
 * Active CPU). We show the expiry timer + a "Stop" button so users
 * can release the sandbox early.
 */

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import type { ProjectFile } from "@/lib/compare/sessions";

type State =
  | { kind: "idle" }
  | { kind: "spawning"; startedAt: number }
  | { kind: "ready"; previewUrl: string; expiresAt: number }
  | { kind: "error"; message: string; detail?: string }
  | { kind: "expired" };

type Props = {
  /** The user's virtual project files — same shape CompareChat already
   *  passes to SplitWorkspace. We serialize to {path: content} for
   *  the sandbox route. */
  project: Record<string, ProjectFile>;
  /** True when the user is signed in AND on a paid tier (chad/payg
   *  or admin). Free users see a locked button + tooltip. */
  canPreview: boolean;
};

export function SandboxPreview({ project, canPreview }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Tick every second while a preview is live so the user sees a
  // live "expires in 9m 47s" countdown — and auto-flip to `expired`
  // when the timer crosses zero. One effect, one interval, primitive
  // dependency (state.kind) so we don't churn re-running it.
  const [, force] = useState(0);
  useEffect(() => {
    if (state.kind !== "ready") return;
    const expiresAt = state.expiresAt;
    const t = setInterval(() => {
      if (Date.now() >= expiresAt) {
        setState({ kind: "expired" });
        return;
      }
      force((n) => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [state.kind, state.kind === "ready" ? state.expiresAt : 0]);

  async function launch() {
    if (!canPreview) return;
    if (state.kind === "spawning") return;

    // Serialize the project into the {path: content} map the route wants.
    const files: Record<string, string> = {};
    for (const [path, pf] of Object.entries(project)) {
      files[path] = pf.content;
    }
    if (Object.keys(files).length === 0) {
      setState({ kind: "error", message: "no_files", detail: "Generate some code first — the workspace is empty." });
      return;
    }
    if (!files["package.json"]) {
      setState({
        kind: "error",
        message: "no_package_json",
        detail: "Project needs a package.json at the root. Ask one of the agents to add one.",
      });
      return;
    }

    setState({ kind: "spawning", startedAt: Date.now() });

    try {
      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setState({ kind: "error", message: "unauthenticated", detail: "Sign in again to launch a preview." });
        return;
      }
      const res = await fetch("/api/sandbox/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ files }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        previewUrl?: string;
        expiresAt?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.previewUrl) {
        setState({
          kind: "error",
          message: body.error || `http_${res.status}`,
          detail: body.detail,
        });
        return;
      }
      setState({
        kind: "ready",
        previewUrl: body.previewUrl,
        expiresAt: new Date(body.expiresAt ?? Date.now() + 10 * 60_000).getTime(),
      });
    } catch (e) {
      setState({ kind: "error", message: "network", detail: (e as Error).message });
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      <Toolbar
        state={state}
        canPreview={canPreview}
        onLaunch={launch}
        onReset={reset}
      />
      <div className="flex-1 min-h-0 relative">
        {state.kind === "ready" && (
          <iframe
            ref={iframeRef}
            src={state.previewUrl}
            title="Live preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            className="absolute inset-0 w-full h-full border-0 bg-white"
          />
        )}
        {state.kind === "spawning" && <SpawningOverlay startedAt={state.startedAt} />}
        {state.kind === "idle" && <IdleOverlay canPreview={canPreview} onLaunch={launch} />}
        {state.kind === "error" && <ErrorOverlay state={state} onRetry={reset} />}
        {state.kind === "expired" && <ExpiredOverlay onRelaunch={launch} />}
      </div>
    </div>
  );
}

function Toolbar({
  state, canPreview, onLaunch, onReset,
}: { state: State; canPreview: boolean; onLaunch: () => void; onReset: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 px-3 py-2 bg-[#1a1918] border-b border-white/[0.06] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot state={state} />
        <span className="text-[12.5px] text-white/85 font-medium truncate">
          {labelFor(state)}
        </span>
        {state.kind === "ready" && (
          <span className="text-[11px] text-white/45 font-mono whitespace-nowrap">
            expires in {formatExpiry(state.expiresAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {state.kind === "ready" && (
          <>
            <a
              href={state.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded text-[11.5px] text-white/65 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Open in new tab"
            >
              ↗ open
            </a>
            <button
              type="button"
              onClick={onReset}
              className="px-2 py-1 rounded text-[11.5px] text-white/65 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Release the sandbox (you'll need to relaunch to preview again)"
            >
              ■ stop
            </button>
          </>
        )}
        {(state.kind === "idle" || state.kind === "expired" || state.kind === "error") && (
          <button
            type="button"
            onClick={onLaunch}
            disabled={!canPreview}
            title={canPreview ? "Launch a live preview" : "Subscribe to unlock live preview"}
            className="px-3 py-1 rounded bg-[#d97757] text-white text-[11.5px] font-medium hover:bg-[#c6613f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            ▶ Preview
          </button>
        )}
      </div>
    </header>
  );
}

function StatusDot({ state }: { state: State }) {
  const color =
    state.kind === "ready"    ? "#7eb472" :
    state.kind === "spawning" ? "#d6b15b" :
    state.kind === "error"    ? "#d97777" :
    state.kind === "expired"  ? "#888" :
                                "rgba(255,255,255,0.25)";
  return (
    <span
      aria-hidden
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{
        background: color,
        animation: state.kind === "spawning" ? "caret-blink 1s infinite" : undefined,
      }}
    />
  );
}

function labelFor(state: State): string {
  switch (state.kind) {
    case "ready":    return "Live preview";
    case "spawning": return "Spinning up sandbox…";
    case "error":    return "Preview failed";
    case "expired":  return "Preview expired (10 min limit)";
    case "idle":     return "Preview not running";
  }
}

function formatExpiry(expiresAt: number): string {
  const s = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

function IdleOverlay({ canPreview, onLaunch }: { canPreview: boolean; onLaunch: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div className="max-w-[420px]">
        <div className="text-white/95 text-[18px] font-medium mb-2">Live preview</div>
        <p className="text-white/55 text-[13px] leading-[1.55] mb-5">
          Click Preview to spin up an ephemeral Linux sandbox, install your project's dependencies, run its dev script, and serve the result here in real time.
        </p>
        <p className="text-white/40 text-[11.5px] leading-[1.5] mb-5">
          First boot takes ~60-90 seconds (npm install). Sandbox auto-releases after 10 minutes.
        </p>
        <button
          type="button"
          onClick={onLaunch}
          disabled={!canPreview}
          className="px-5 py-2 rounded-md bg-[#d97757] text-white text-[13.5px] font-medium hover:bg-[#c6613f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canPreview ? "▶ Launch preview" : "🔒 Subscribe to unlock"}
        </button>
        {!canPreview && (
          <p className="text-white/40 text-[11px] mt-4 leading-[1.5]">
            Live preview runs on metered compute — subscriber + PAYG tiers only.
          </p>
        )}
      </div>
    </div>
  );
}

function SpawningOverlay({ startedAt }: { startedAt: number }) {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div className="max-w-[420px]">
        <div className="text-white/95 text-[15px] font-medium mb-3">Spinning up sandbox…</div>
        <div className="text-[11px] text-white/45 font-mono mb-3">
          {elapsed}s elapsed · typical first boot 60-90s
        </div>
        <ul className="text-[12px] text-white/55 leading-[1.7] list-none">
          <li>· allocating Linux microVM</li>
          <li>· writing your project files</li>
          <li>· installing dependencies (the slow part)</li>
          <li>· starting dev server</li>
        </ul>
      </div>
    </div>
  );
}

function ErrorOverlay({ state, onRetry }: { state: Extract<State, { kind: "error" }>; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div className="max-w-[480px]">
        <div className="text-red-300/95 text-[15px] font-medium mb-2">⚠ {state.message}</div>
        {state.detail && (
          <p className="text-white/55 text-[12.5px] leading-[1.55] mb-4 whitespace-pre-wrap font-mono bg-black/30 border border-white/[0.06] rounded p-3 text-left max-h-[280px] overflow-y-auto">
            {state.detail}
          </p>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-1.5 rounded bg-white/[0.06] text-white/85 text-[12.5px] hover:bg-white/[0.1] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ExpiredOverlay({ onRelaunch }: { onRelaunch: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div className="max-w-[420px]">
        <div className="text-white/95 text-[15px] font-medium mb-2">Preview expired</div>
        <p className="text-white/55 text-[12.5px] leading-[1.55] mb-5">
          Sandboxes auto-release after 10 minutes to keep compute costs bounded. Relaunch to preview the current state of your project again.
        </p>
        <button
          type="button"
          onClick={onRelaunch}
          className="px-5 py-2 rounded-md bg-[#d97757] text-white text-[13.5px] font-medium hover:bg-[#c6613f] transition-colors"
        >
          ▶ Relaunch
        </button>
      </div>
    </div>
  );
}
