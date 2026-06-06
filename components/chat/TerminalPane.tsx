"use client";

/**
 * Terminal pane — Veronum dark theme. The body is the darkest
 * surface in the workspace (#1a1918) so it reads as a terminal
 * regardless of the user's display calibration. Chrome above uses
 * the same #2a2826 header band as the editor for visual hierarchy.
 *
 * Stub on web. The desktop port will websocket into the Veronum
 * Bridge daemon's node-pty + xterm.js terminal (already running in
 * veronum-chat-localhost/lib/terminal.js).
 */

import { useEffect, useRef, useState } from "react";

type Line = { kind: "in" | "out" | "info"; text: string };

const PROMPT = "$ ";
const BANNER: Line[] = [
  { kind: "info", text: "veronum terminal — connect Veronum Bridge to execute commands locally" },
];

export function TerminalPane() {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function submit() {
    const cmd = draft.trim();
    if (!cmd) return;
    const next: Line[] = [...lines, { kind: "in", text: cmd }];
    if (cmd === "clear") {
      setLines(BANNER);
      setDraft("");
      return;
    }
    if (cmd === "help") {
      next.push({ kind: "out", text: "Builtins: clear, help, echo <text>" });
      next.push({ kind: "info", text: "External commands need Veronum Bridge — not connected." });
    } else if (cmd.startsWith("echo ")) {
      next.push({ kind: "out", text: cmd.slice(5) });
    } else {
      next.push({ kind: "info", text: `(not connected) ${cmd}` });
    }
    setLines(next);
    setDraft("");
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col"
      style={{ background: "#000" }}
    >
      <header
        className="flex items-center justify-between px-3 h-9 shrink-0"
        style={{
          background: "#000",
          borderTop: "1px solid #1a1918",
          borderBottom: "1px solid #1a1918",
        }}
      >
        <div
          className="text-[10.5px] uppercase tracking-[0.06em] font-medium"
          style={{ color: "#9a958a", fontFamily: "var(--font-mono)" }}
        >
          Terminal
        </div>
        <button
          type="button"
          onClick={() => setLines(BANNER)}
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded transition-colors"
          style={{
            color: "#9a958a",
            fontFamily: "var(--font-mono)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#f0eee6";
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#9a958a";
            e.currentTarget.style.background = "transparent";
          }}
        >
          Clear
        </button>
      </header>

      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 min-h-0 overflow-y-auto cursor-text"
        style={{
          padding: "10px 14px",
          fontSize: 12,
          lineHeight: 1.45,
          fontFamily: "var(--font-mono), 'SF Mono', ui-monospace, monospace",
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              color:
                l.kind === "in"
                  ? "#f0eee6"
                  : l.kind === "info"
                    ? "#7a766c"
                    : "#c3bdac",
            }}
          >
            {l.kind === "in" ? <span style={{ color: "#9a958a" }}>{PROMPT}</span> : null}
            <span className="whitespace-pre-wrap">{l.text}</span>
          </div>
        ))}
        <div className="flex items-center">
          <span style={{ color: "#9a958a" }}>{PROMPT}</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="(not connected — connect Veronum Bridge to run for real)"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="flex-1 outline-none"
            style={{
              background: "transparent",
              color: "#f0eee6",
              fontFamily: "inherit",
              fontSize: "inherit",
            }}
          />
        </div>
      </div>
    </div>
  );
}
