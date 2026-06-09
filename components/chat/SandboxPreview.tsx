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

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import type { ProjectFile } from "@/lib/compare/sessions";

type Artifact = {
  name: string;
  url: string;
  sizeBytes: number;
  platform: string;  // 'macOS' | 'Windows' | 'Linux' | 'Cross-platform'
};

type State =
  | { kind: "idle" }
  | { kind: "spawning"; startedAt: number }
  | { kind: "ready"; previewUrl: string; expiresAt: number }
  | { kind: "artifacts"; artifacts: Artifact[]; buildScript: string; durationMs: number }
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

/** Imperative API exposed to the parent (SplitWorkspace) so the
 *  tab-click handler can fire a launch atomically — opening the
 *  popup synchronously inside the click gesture and handing it down
 *  here rather than waiting for the user to click a second button. */
export type SandboxPreviewHandle = {
  /** Launch a preview. The caller MUST have already called
   *  `window.open('about:blank', '_blank')` inside their click
   *  handler and passed the result here — opening it here async
   *  would get blocked by popup-blockers. Pass null if you couldn't
   *  open a popup and we'll fall back to the manual "Open preview"
   *  button on the ready state. */
  launchNow: (popup: Window | null) => void;
};

export const SandboxPreview = forwardRef<SandboxPreviewHandle, Props>(function SandboxPreview(
  { project, canPreview }, ref,
) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // Pre-opened browser tab. We grab it the INSTANT the user clicks
  // Launch (still inside the click-handler user-gesture context, so
  // popup blockers leave us alone). When the sandbox becomes ready
  // ~60s later, we just set this tab's location. If we waited until
  // the fetch resolved to call window.open, modern browsers would
  // treat it as an unsolicited popup and block it.
  const popupRef = useRef<Window | null>(null);

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

  /** Internal launch — accepts an externally-provided popup window
   *  so the user-gesture context isn't lost. Callers from inside
   *  this component (the IdleOverlay's fallback button) open the
   *  popup themselves and pass it in; the parent SplitWorkspace
   *  opens the popup synchronously in its tab-click handler and
   *  passes it via the imperative ref. */
  async function launch(externalPopup: Window | null) {
    if (!canPreview) return;
    if (state.kind === "spawning") return;

    // Serialize the project into the {path: content} map the route wants.
    const files: Record<string, string> = {};
    for (const [path, pf] of Object.entries(project)) {
      files[path] = pf.content;
    }
    if (Object.keys(files).length === 0) {
      externalPopup?.close();
      setState({ kind: "error", message: "no_files", detail: "Generate some code first — the workspace is empty." });
      return;
    }
    // The server handles both Node and static-only project shapes
    // (we don't pre-check for package.json client-side anymore — a
    // single HTML file previews fine).

    // Use the popup the caller already opened. If they didn't open
    // one (e.g. internal launch button), we open one ourselves —
    // that path requires the call to be inside a click handler, which
    // the IdleOverlay fallback button satisfies.
    popupRef.current = externalPopup ?? window.open("about:blank", "_blank");
    if (popupRef.current) {
      try {
        popupRef.current.document.title = "Spinning up preview…";
        popupRef.current.document.body.style.cssText = "background:#0d0d0d;color:#a8a8a8;font:14px system-ui;padding:48px;text-align:center;";
        popupRef.current.document.body.innerHTML =
          "<h2 style='font-weight:500;color:#fff;margin-bottom:8px;'>Spinning up preview…</h2>" +
          "<p>Installing dependencies + starting your dev server. Usually 5-10s for static HTML, 60-90s for npm projects.</p>" +
          "<p style='color:#666;margin-top:24px;font-size:12px;'>Don't close this tab — we'll redirect it the moment the sandbox is ready.</p>";
      } catch { /* same-origin policy can throw on about:blank in some browsers */ }
    }

    setState({ kind: "spawning", startedAt: Date.now() });

    try {
      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        popupRef.current?.close();
        popupRef.current = null;
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
        mode?: "electron-build" | "node" | "static";
        previewUrl?: string;
        expiresAt?: string;
        artifacts?: Artifact[];
        buildScript?: string;
        durationMs?: number;
        error?: string;
        detail?: string;
      };

      // Electron build path — no live URL, just downloadable artifacts.
      // Close the popup since it'd just sit on the loading screen forever.
      if (res.ok && body.mode === "electron-build" && Array.isArray(body.artifacts)) {
        if (popupRef.current && !popupRef.current.closed) {
          try { popupRef.current.close(); } catch { /* noop */ }
        }
        popupRef.current = null;
        setState({
          kind: "artifacts",
          artifacts: body.artifacts,
          buildScript: body.buildScript ?? "build",
          durationMs: body.durationMs ?? 0,
        });
        return;
      }

      if (!res.ok || !body.previewUrl) {
        popupRef.current?.close();
        popupRef.current = null;
        setState({
          kind: "error",
          message: body.error || `http_${res.status}`,
          detail: body.detail,
        });
        return;
      }
      // Sandbox is up — live dev server. Redirect the pre-opened tab.
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.location.href = body.previewUrl;
      }
      setState({
        kind: "ready",
        previewUrl: body.previewUrl,
        expiresAt: new Date(body.expiresAt ?? Date.now() + 10 * 60_000).getTime(),
      });
    } catch (e) {
      popupRef.current?.close();
      popupRef.current = null;
      setState({ kind: "error", message: "network", detail: (e as Error).message });
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  // Expose launch to the parent so SplitWorkspace's Preview-tab click
  // handler can open the popup synchronously (preserving the user
  // gesture context) and pass it in here. Single click flow:
  // tab click → popup opens + sandbox fetch starts. No second button.
  useImperativeHandle(ref, () => ({
    launchNow: (popup: Window | null) => {
      if (state.kind === "spawning" || state.kind === "ready") return;
      void launch(popup);
    },
  }), [state.kind, canPreview, project]);

  // Internal launch helper — the in-component buttons (IdleOverlay
  // fallback, expired-state relaunch) open their own popup via this
  // wrapper. The parent's tab-click handler uses launchNow() instead
  // so it can pre-open the popup in the click context.
  const launchSelfOpen = () => { void launch(null); };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      <Toolbar
        state={state}
        canPreview={canPreview}
        onLaunch={launchSelfOpen}
        onReset={reset}
      />
      <div className="flex-1 min-h-0 relative">
        {state.kind === "ready" && <ReadyOverlay state={state} />}
        {state.kind === "artifacts" && <ArtifactsOverlay state={state} onReset={reset} />}
        {state.kind === "spawning" && <SpawningOverlay startedAt={state.startedAt} />}
        {state.kind === "idle" && <IdleOverlay canPreview={canPreview} onLaunch={launchSelfOpen} />}
        {state.kind === "error" && <ErrorOverlay state={state} onRetry={reset} />}
        {state.kind === "expired" && <ExpiredOverlay onRelaunch={launchSelfOpen} />}
      </div>
    </div>
  );
});

/** Build-complete state for Electron projects. Renders one download
 *  card per artifact, grouped by platform. No popup tab here — Electron
 *  apps run natively on the user's machine after they download. */
function ArtifactsOverlay({
  state, onReset,
}: {
  state: Extract<State, { kind: "artifacts" }>;
  onReset: () => void;
}) {
  // Group artifacts by platform so the user can scan by their OS.
  const byPlatform: Record<string, Artifact[]> = {};
  for (const a of state.artifacts) {
    if (!byPlatform[a.platform]) byPlatform[a.platform] = [];
    byPlatform[a.platform].push(a);
  }
  const totalSize = state.artifacts.reduce((s, a) => s + a.sizeBytes, 0);

  return (
    <div className="absolute inset-0 overflow-y-auto p-6">
      <div className="max-w-[560px] mx-auto">
        <div className="inline-flex items-center gap-2 mb-3 text-[#7eb472]">
          <span aria-hidden className="w-2 h-2 rounded-full bg-[#7eb472] inline-block" />
          <span className="text-[12.5px] font-mono uppercase tracking-wider">Build complete</span>
        </div>
        <h2 className="text-white text-[18px] font-medium mb-1.5">Your Electron app is ready</h2>
        <p className="text-white/55 text-[13px] leading-[1.55] mb-1">
          Built {state.artifacts.length} artifact{state.artifacts.length === 1 ? "" : "s"} ({formatBytes(totalSize)}) in {Math.round(state.durationMs / 1000)}s via <code className="text-white/80 bg-white/[0.06] px-1 py-0.5 rounded text-[11.5px]">npm run {state.buildScript}</code>
        </p>
        <p className="text-white/35 text-[11.5px] leading-[1.55] mb-5">
          Download for your OS, double-click to install. Linux artifacts run as-is. macOS / Windows builds require the matching host OS (the sandbox is Linux-only) so they'll only appear if your build config produced them.
        </p>

        <div className="space-y-4">
          {Object.entries(byPlatform).map(([platform, list]) => (
            <section key={platform}>
              <div className="text-[10.5px] uppercase tracking-wider text-white/40 font-mono mb-2">
                {platform}
              </div>
              <ul className="space-y-1.5">
                {list.map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={a.name}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-white/10 bg-[#161616] hover:border-white/30 transition-colors group"
                    >
                      <span className="text-[#d97757] text-[14px]" aria-hidden>↓</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] text-white/95 font-medium truncate">{a.name}</div>
                        <div className="text-[11px] text-white/45 font-mono">{formatBytes(a.sizeBytes)}</div>
                      </div>
                      <span className="text-[11.5px] text-white/45 group-hover:text-white/85 transition-colors">
                        Download →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="mt-6 text-[12px] text-white/45 hover:text-white/85 transition-colors"
        >
          Build again →
        </button>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Live-and-running state. Preview opens in a new tab (auto via the
 *  pre-opened popup; manual click fallback if the popup blocker won.) */
function ReadyOverlay({ state }: { state: Extract<State, { kind: "ready" }> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div className="max-w-[480px]">
        <div className="inline-flex items-center gap-2 mb-3 text-[#7eb472]">
          <span aria-hidden className="w-2 h-2 rounded-full bg-[#7eb472] inline-block" />
          <span className="text-[12.5px] font-mono uppercase tracking-wider">Preview running</span>
        </div>
        <div className="text-white/95 text-[16px] font-medium mb-1.5">Open in your new tab</div>
        <p className="text-white/55 text-[12.5px] leading-[1.55] mb-3">
          We auto-opened a tab when you clicked Preview. If your browser blocked it, click the button below.
        </p>
        <p className="text-white/40 text-[11px] font-mono break-all mb-5 px-3 py-2 rounded bg-black/30 border border-white/[0.06]">
          {state.previewUrl}
        </p>
        <a
          href={state.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2 rounded-md bg-[#d97757] text-white text-[13.5px] font-medium hover:bg-[#c6613f] transition-colors"
        >
          ↗ Open preview
        </a>
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
    case "ready":     return "Live preview";
    case "artifacts": return "Build complete";
    case "spawning":  return "Spinning up sandbox…";
    case "error":     return "Preview failed";
    case "expired":   return "Preview expired (10 min limit)";
    case "idle":      return "Preview not running";
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
  // After 90s we're almost certainly in an Electron-build flow — switch
  // the copy to reflect that so the user isn't confused why a static
  // preview is taking minutes.
  const longBuild = elapsed > 90;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div className="max-w-[440px]">
        <div className="text-white/95 text-[15px] font-medium mb-3">
          {longBuild ? "Building Electron app…" : "Spinning up sandbox…"}
        </div>
        <div className="text-[11px] text-white/45 font-mono mb-3">
          {elapsed}s elapsed · ~10s static HTML · ~60-90s npm projects · ~3-10 min Electron builds
        </div>
        <ul className="text-[12px] text-white/55 leading-[1.7] list-none">
          <li>· allocating Linux microVM</li>
          <li>· writing your project files</li>
          <li>· installing dependencies (skipped for static HTML)</li>
          <li>{longBuild ? "· packaging desktop binaries (the slow part)" : "· starting server"}</li>
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
