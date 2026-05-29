"use client";

/**
 * LocalViewDemo — animated walkthrough of Veronum's local view
 * (the in-app workspace panel shipped in v0.3.6). Shows the user
 * cycling Files → Terminal → Activity tabs with realistic state
 * landing in each: editing a file, running a command in zsh, then
 * watching the activity feed light up with red/green diffs as
 * Claude edits the file.
 *
 * Phase machine:
 *   1. files-idle        → editor visible, cursor blinking
 *   2. files-type        → user types a small change
 *   3. files-save        → cmd+S → "✓ saved" badge flashes
 *   4. switch-terminal   → tabs swap with a 200ms slide
 *   5. terminal-type     → "npm run dev" typed into zsh
 *   6. terminal-output   → server URL streams back
 *   7. switch-activity   → tabs swap
 *   8. activity-land     → new entry slides in, red/green diff
 *   9. reset             → fade → loop
 */

import { useEffect, useState } from "react";

type Phase =
  | "files-idle"
  | "files-type"
  | "files-save"
  | "switch-terminal"
  | "terminal-type"
  | "terminal-output"
  | "switch-activity"
  | "activity-land"
  | "reset";

type Tab = "files" | "terminal" | "activity";

const FILE_BEFORE =
  `export function greet(name: string) {\n  return \`hi \${name}\`;\n}`;
const FILE_AFTER =
  `export function greet(name: string) {\n  return \`Hello, \${name}!\`;\n}`;

const TERM_CMD = "npm run dev";
const TERM_OUTPUT = [
  "> veronum-overlay@1.4.3 dev",
  "  vite v6.4.2  ready in 410 ms",
  "  ➜  Local:   http://localhost:5173/",
];

const PHASE_DURATION: Record<Phase, number> = {
  "files-idle": 1400,
  "files-type": 1600,
  "files-save": 1100,
  "switch-terminal": 500,
  "terminal-type": 1200,
  "terminal-output": 1800,
  "switch-activity": 500,
  "activity-land": 2400,
  reset: 700,
};

const PHASE_TO_TAB: Record<Phase, Tab> = {
  "files-idle": "files",
  "files-type": "files",
  "files-save": "files",
  "switch-terminal": "terminal",
  "terminal-type": "terminal",
  "terminal-output": "terminal",
  "switch-activity": "activity",
  "activity-land": "activity",
  reset: "files",
};

const NEXT: Record<Phase, Phase> = {
  "files-idle": "files-type",
  "files-type": "files-save",
  "files-save": "switch-terminal",
  "switch-terminal": "terminal-type",
  "terminal-type": "terminal-output",
  "terminal-output": "switch-activity",
  "switch-activity": "activity-land",
  "activity-land": "reset",
  reset: "files-idle",
};

export function LocalViewDemo() {
  const [phase, setPhase] = useState<Phase>("files-idle");

  useEffect(() => {
    const t = setTimeout(() => setPhase(NEXT[phase]), PHASE_DURATION[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const activeTab = PHASE_TO_TAB[phase];

  return (
    <div className="mx-auto max-w-[820px] w-full">
      <div className="rounded-2xl bg-[#0e0d12] border border-white/[.10] shadow-[0_24px_60px_rgba(0,0,0,.18)] overflow-hidden font-mono">
        <Topbar />
        <TabBar active={activeTab} />
        <div className="relative h-[260px] sm:h-[300px]">
          <Pane visible={activeTab === "files"}>
            <FilesPane phase={phase} />
          </Pane>
          <Pane visible={activeTab === "terminal"}>
            <TerminalPane phase={phase} />
          </Pane>
          <Pane visible={activeTab === "activity"}>
            <ActivityPane phase={phase} />
          </Pane>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-faded font-mono">
        Live demo · loops every ~12s · runs in the real Veronum app on your Mac and phone
      </p>
    </div>
  );
}

/* ─── chrome ─── */

function Topbar() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[.08] bg-[#0c0c0c]">
      <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
      <span className="ml-3 text-[10px] uppercase tracking-[0.14em] text-white/40">
        Veronum · veronum-overlay
      </span>
      <span className="ml-auto text-[10px] text-white/35">v0.3.6</span>
    </div>
  );
}

function TabBar({ active }: { active: Tab }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "files", label: "Files" },
    { id: "terminal", label: "Terminal" },
    { id: "activity", label: "Activity" },
  ];
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[.06] bg-[#141414]">
      {tabs.map((t) => (
        <span
          key={t.id}
          className={
            "px-3 py-1 rounded-md text-[11px] font-mono transition-colors duration-200 " +
            (active === t.id
              ? "bg-white/[.08] text-white"
              : "text-white/45")
          }
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function Pane({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        "absolute inset-0 transition-opacity duration-200 " +
        (visible ? "opacity-100" : "opacity-0 pointer-events-none")
      }
    >
      {children}
    </div>
  );
}

/* ─── Files pane ─── */

function FilesPane({ phase }: { phase: Phase }) {
  const typingChars = useTypewriter(
    phase === "files-type" ? FILE_AFTER : phase === "files-save" ? FILE_AFTER : FILE_BEFORE,
    phase === "files-type" ? PHASE_DURATION["files-type"] : 0,
  );
  const isSaved = phase === "files-save";
  return (
    <div className="flex h-full">
      <FileTree active="greet.ts" />
      <div className="flex-1 flex flex-col">
        <FileHead name="greet.ts" saved={isSaved} dirty={phase === "files-type"} />
        <pre className="flex-1 px-4 py-3 text-[12.5px] leading-[1.55] text-[#f4f1ea] bg-[#0e0d12] overflow-hidden">
          <code className="font-mono whitespace-pre">{typingChars}<Cursor /></code>
        </pre>
      </div>
    </div>
  );
}

function FileTree({ active }: { active: string }) {
  const items = ["package.json", "tsconfig.json", "src/", "  index.ts", "  greet.ts", "  utils.ts"];
  return (
    <div className="w-[140px] border-r border-white/[.06] bg-[#0c0c0c] py-2 text-[11px] text-white/55">
      {items.map((it) => {
        const isActive = it.trim() === active;
        return (
          <div
            key={it}
            className={
              "px-3 py-[3px] " +
              (isActive ? "bg-white/[.06] text-white" : "")
            }
          >
            {it}
          </div>
        );
      })}
    </div>
  );
}

function FileHead({ name, saved, dirty }: { name: string; saved: boolean; dirty: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[.06] bg-[#0c0c0c] text-[11px]">
      <span className="text-white/80">{name}</span>
      <span className="ml-auto inline-flex items-center gap-2">
        {dirty && <span className="text-[#f59e0b]">● unsaved</span>}
        {saved && <span className="text-[#22c55e]">✓ saved</span>}
        <span className="rounded-md bg-[#a78bfa] text-[#0e0d12] px-2 py-[2px] font-medium">
          Save (⌘S)
        </span>
      </span>
    </div>
  );
}

/* ─── Terminal pane ─── */

function TerminalPane({ phase }: { phase: Phase }) {
  const typed = useTypewriter(TERM_CMD, phase === "terminal-type" ? PHASE_DURATION["terminal-type"] : 0);
  const showOutput = phase === "terminal-output";
  const showCmd = phase === "terminal-type" || phase === "terminal-output";
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[.05] bg-[#0c0c0c] text-[10px] text-white/55">
        <span className="px-2 py-[2px] rounded bg-white/[.08] text-white">veronum-overlay · #1</span>
        <span className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded border border-white/15">+</span>
      </div>
      <div className="flex-1 px-4 py-3 bg-[#141414] text-[12px] text-[#f4f1ea] leading-[1.6] overflow-hidden">
        <div className="text-white/40">✦ zsh @ ~/projects/veronum-overlay</div>
        {showCmd && (
          <div className="mt-1">
            <span className="text-[#a78bfa] mr-2">❯</span>
            <span>{typed}</span>
            {phase === "terminal-type" && <Cursor />}
          </div>
        )}
        {showOutput && (
          <div className="mt-2 space-y-[2px] text-white/85">
            {TERM_OUTPUT.map((l) => (
              <div key={l} className={l.includes("Local") ? "text-[#22c55e]" : ""}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Activity pane ─── */

function ActivityPane({ phase }: { phase: Phase }) {
  const landed = phase === "activity-land";
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[.05] bg-[#0c0c0c] text-[10px] text-white/55">
        <span className="px-2 py-[2px] rounded border border-white/15 text-white/70">↶ Undo</span>
        <span className="px-2 py-[2px] rounded border border-white/15 text-white/70">↷ Redo</span>
        <span className="ml-3">2 edits</span>
      </div>
      <div className="flex-1 px-4 py-3 bg-[#141414] overflow-hidden">
        <div
          className={
            "rounded-lg border border-white/[.10] bg-white/[.02] p-3 transition-all duration-300 " +
            (landed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2")
          }
        >
          <div className="flex items-center gap-2 mb-2 text-[11px] font-mono">
            <span className="rounded-full bg-[#f0a570]/20 text-[#f0a570] px-1.5 py-[1px] text-[9px] uppercase tracking-wider">claude</span>
            <span className="text-[#4ade80]">+1</span>
            <span className="text-[#f87171]">-1</span>
            <span className="text-white/70 truncate">src/greet.ts</span>
            <span className="ml-auto text-white/40">just now</span>
          </div>
          <div className="text-[11px] font-mono leading-[1.55] bg-[#0c0c0c] rounded p-2">
            <div className="text-white/45">{"  "}export function greet(name: string) {`{`}</div>
            <div className="bg-[#f87171]/15 text-[#f5c7c7]">- {"  "}return `hi ${"${name}"}`;</div>
            <div className="bg-[#4ade80]/15 text-[#c2f0d2]">+ {"  "}return `Hello, ${"${name}"}!`;</div>
            <div className="text-white/45">{"  "}{`}`}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── helpers ─── */

function Cursor() {
  return <span className="inline-block w-[7px] h-[14px] -mb-[2px] bg-[#a78bfa] animate-pulse align-middle ml-[1px]" />;
}

function useTypewriter(target: string, durationMs: number) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (durationMs <= 0) { setOut(target); return; }
    setOut("");
    const stepMs = Math.max(15, Math.floor(durationMs / Math.max(1, target.length)));
    let i = 0;
    const id = setInterval(() => {
      i++;
      setOut(target.slice(0, i));
      if (i >= target.length) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, [target, durationMs]);
  return out;
}
