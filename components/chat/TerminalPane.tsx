"use client";

/**
 * Live terminal pane. Wires the user's local shell (zsh on macOS,
 * spawned by the daemon's node-pty) into xterm.js in the browser via
 * a direct WebSocket through the user's paired Cloudflare tunnel.
 *
 *   xterm.js (browser) ◄──wss tunnel──► node-pty (user's Mac)
 *
 * No Vercel function in the data path — keystrokes go from the
 * browser straight to the user's machine through the same tunnel
 * the git Bridge already uses. Auth is by tunnel URL knowledge
 * (the URL itself is the secret).
 *
 * UI states:
 *   - loading       : initial fetch of tunnel info
 *   - signed_out    : user not authed → prompt
 *   - not_paired    : authed but no Bridge → CTA to /pair-bridge
 *   - paired        : full terminal, with connection sub-states
 *
 * Stays mounted across editor↔preview tab switches in SplitWorkspace,
 * so a long-running command keeps streaming even while the user
 * looks at the preview pane.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  fetchTerminalPairing,
  buildTerminalWsUrl,
  type TerminalPairing,
} from "@/lib/compare/bridgeTerminal";

type ConnState = "connecting" | "connected" | "disconnected" | "error";

export function TerminalPane() {
  const [pairing, setPairing] = useState<TerminalPairing | { status: "loading" }>({ status: "loading" });
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [connError, setConnError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch tunnel pairing once on mount. Re-fetch on Retry click.
  useEffect(() => {
    let cancelled = false;
    fetchTerminalPairing().then((p) => {
      if (!cancelled) setPairing(p);
    });
    return () => { cancelled = true; };
  }, []);

  // Spawn the xterm + WS connection once we have a paired tunnel.
  // Re-runs on Retry (which bumps pairing state through a re-fetch).
  useEffect(() => {
    if (pairing.status !== "paired") return;
    const host = containerRef.current;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "var(--font-mono), 'SF Mono', ui-monospace, monospace",
      fontSize: 12,
      lineHeight: 1.2,
      theme: {
        background: "#0a0908",
        foreground: "#f0eee6",
        cursor: "#d97757",
        cursorAccent: "#0a0908",
        selectionBackground: "#3a3733",
        black: "#1a1918", brightBlack: "#5a564f",
        red: "#e06c75", brightRed: "#ff8a96",
        green: "#98c379", brightGreen: "#a8d684",
        yellow: "#e5c07b", brightYellow: "#ffd692",
        blue: "#82a4d6", brightBlue: "#a4c1ec",
        magenta: "#c678dd", brightMagenta: "#d995ee",
        cyan: "#56b6c2", brightCyan: "#6cc5d3",
        white: "#dcdfe4", brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const wsUrl = buildTerminalWsUrl(pairing.tunnelUrl, {
      cols: term.cols,
      rows: term.rows,
    });
    setConnState("connecting");
    setConnError(null);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setConnState("error");
      setConnError((e as Error).message);
      return () => { term.dispose(); };
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setConnState("connected");
      term.focus();
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as
          { type?: string; data?: string; message?: string };
        if (msg.type === "data" && typeof msg.data === "string") {
          term.write(msg.data);
        } else if (msg.type === "error" && typeof msg.message === "string") {
          term.writeln(`\r\n\x1b[31m[bridge] ${msg.message}\x1b[0m`);
        }
      } catch {
        // Non-JSON frame — daemon never sends these but defend anyway.
      }
    };
    ws.onerror = () => {
      setConnState("error");
      setConnError("WebSocket error — check the Bridge daemon is running.");
    };
    ws.onclose = () => {
      setConnState((s) => (s === "error" ? s : "disconnected"));
    };

    // xterm → ws : user keystrokes (and pasted text).
    const dataSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "data", data }));
      }
    });

    // Container resize → fit → send resize frame so the remote pty
    // re-wraps lines. ResizeObserver is well-supported and cheap.
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      } catch {
        // fit() throws if container has zero size mid-animation. Ignore.
      }
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      dataSub.dispose();
      try { ws.close(); } catch { /* ignore */ }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [pairing]);

  function retry() {
    setPairing({ status: "loading" });
    fetchTerminalPairing().then(setPairing);
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0a0908]">
      <header className="flex items-center justify-between px-3 h-9 shrink-0 border-y border-[#1a1918]">
        <div className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#9a958a] font-mono flex items-center gap-2">
          <span>Terminal</span>
          {pairing.status === "paired" && <ConnDot state={connState} />}
        </div>
        <div className="flex items-center gap-2">
          {pairing.status === "paired" && connState === "disconnected" && (
            <button
              type="button"
              onClick={retry}
              className="text-[10px] uppercase tracking-wider text-[#d97757] hover:text-white px-2 py-0.5 rounded transition-colors font-mono"
            >
              Reconnect
            </button>
          )}
          {pairing.status === "paired" && (
            <button
              type="button"
              onClick={() => termRef.current?.clear()}
              className="text-[10px] uppercase tracking-wider text-[#9a958a] hover:text-white px-2 py-0.5 rounded transition-colors font-mono"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 relative">
        {pairing.status === "loading" && <CenteredMsg>Connecting…</CenteredMsg>}
        {pairing.status === "signed_out" && (
          <CenteredCard
            title="Sign in to use the terminal"
            body="The terminal streams to the Bridge daemon on your Mac. We need to know who you are first."
          />
        )}
        {pairing.status === "not_paired" && (
          <CenteredCard
            title="Pair your Bridge"
            body="The terminal needs the Bridge daemon running on your Mac to spawn a real shell. One-time setup."
            cta={{ href: "/pair-bridge", label: "Pair Bridge →" }}
          />
        )}
        {pairing.status === "error" && (
          <CenteredCard title="Couldn't reach the Bridge" body={pairing.detail} onRetry={retry} />
        )}
        {pairing.status === "paired" && (
          <>
            <div ref={containerRef} className="absolute inset-0 p-2" />
            {connState === "error" && connError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                <CenteredCard title="Disconnected" body={connError} onRetry={retry} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConnDot({ state }: { state: ConnState }) {
  const color =
    state === "connected" ? "#5cd6a7"
    : state === "connecting" ? "#e5c07b"
    : state === "disconnected" ? "#9a958a"
    : "#e06c75";
  return <span aria-hidden style={{ background: color }} className="inline-block w-1.5 h-1.5 rounded-full" />;
}

function CenteredMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white/40 font-mono">
      {children}
    </div>
  );
}

function CenteredCard({
  title, body, cta, onRetry,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
  onRetry?: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-[420px] text-center">
        <h3 className="text-white text-[14px] font-medium mb-2">{title}</h3>
        <p className="text-white/55 text-[12.5px] leading-[1.55]">{body}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {cta && (
            <Link
              href={cta.href}
              className="inline-flex px-3.5 py-1.5 rounded-lg bg-[#d97757] hover:bg-[#c66645] text-white text-[12.5px] font-medium transition"
            >
              {cta.label}
            </Link>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex px-3.5 py-1.5 rounded-lg border border-white/15 hover:border-white/30 text-white/75 hover:text-white text-[12.5px] font-medium transition"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
