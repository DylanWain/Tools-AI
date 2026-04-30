"use client";

import { useEffect, useState } from "react";
import { VeronumMark } from "./VeronumMark";

/**
 * Live, scripted demo of Veronum — recreates the actual desktop app:
 * Anthropic's claude.ai chat shell with our `dwc-*` injections (toolbar
 * pill, agents popover, subscription banner). Animation centers on the
 * agents popover since that's the most distinctive Veronum UX.
 *
 * Visual references lifted from the shipped app source:
 *   - dwc-agents-ui.js  — 480px popover, 10 numbered slots, master task
 *   - dwc-toolbar.js    — undo / redo / history pill near composer
 *   - dwc-subscription  — top-right "X days left" banner
 *
 * Phases:
 *   1. idle       (~1s)  — chat thread shows hero, composer empty
 *   2. clickPill  (.4s)  — @agents pill highlights
 *   3. popover    (~5s)  — popover opens, master task + 5 slots type in
 *   4. send       (.6s)  — Send button pulses, popover closes
 *   5. spawn      (~5s)  — assistant message + 5 agents progress in thread
 *   6. done       (~3s)  — synthesis message, then loop
 */

type Phase =
  | "idle"
  | "clickPill"
  | "popoverMaster"
  | "popoverSlots"
  | "send"
  | "spawn"
  | "done"
  | "reset";

const MASTER = "Add unit tests for the auth flow and ship a release.";

const SLOTS = [
  { name: "Tests", task: "Write unit tests for src/auth/*.ts", color: "#cc785c" },
  { name: "Refactor", task: "Refactor session middleware", color: "#bcd1ca" },
  { name: "Docs", task: "Draft changelog v1.4.0", color: "#ebdbbc" },
  { name: "Review", task: "Cross-check diffs", color: "#cbcadb" },
  { name: "Deploy", task: "Stage deploy preview", color: "#c46686" },
];

const SIDEBAR_TODAY = [
  "Add unit tests for auth flow",
  "Build full-stack fitness app",
  "Refactor session middleware",
  "Review and prepare frontend code",
];

const SIDEBAR_YESTERDAY = [
  "Study Cursor and Warp websites",
  "Deep dive into AI agents",
  "Multi-agent orchestrator design",
];

export function VeronumDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [masterTyped, setMasterTyped] = useState("");
  const [slotsTyped, setSlotsTyped] = useState<string[]>(["", "", "", "", ""]);
  const [agentProgress, setAgentProgress] = useState<number[]>([0, 0, 0, 0, 0]);

  // Phase machine
  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("clickPill"), 1200);
      return () => clearTimeout(t);
    }
    if (phase === "clickPill") {
      const t = setTimeout(() => setPhase("popoverMaster"), 450);
      return () => clearTimeout(t);
    }
    if (phase === "popoverMaster") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= MASTER.length) {
          setMasterTyped(MASTER.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setTimeout(() => setPhase("popoverSlots"), 380);
        }
      }, 22);
      return () => clearInterval(id);
    }
    if (phase === "popoverSlots") {
      // Type each slot one after another
      let slotIdx = 0;
      let charIdx = 0;
      const id = setInterval(() => {
        const cur = SLOTS[slotIdx];
        if (charIdx <= cur.task.length) {
          setSlotsTyped((prev) => {
            const next = [...prev];
            next[slotIdx] = cur.task.slice(0, charIdx);
            return next;
          });
          charIdx++;
        } else {
          slotIdx++;
          charIdx = 0;
          if (slotIdx >= SLOTS.length) {
            clearInterval(id);
            setTimeout(() => setPhase("send"), 480);
          }
        }
      }, 16);
      return () => clearInterval(id);
    }
    if (phase === "send") {
      const t = setTimeout(() => setPhase("spawn"), 700);
      return () => clearTimeout(t);
    }
    if (phase === "spawn") {
      const id = setInterval(() => {
        setAgentProgress((prev) => {
          const next = prev.map((p, i) => Math.min(100, p + 7 + ((i * 4) % 9)));
          if (next.every((p) => p >= 100)) {
            clearInterval(id);
            setTimeout(() => setPhase("done"), 500);
          }
          return next;
        });
      }, 220);
      return () => clearInterval(id);
    }
    if (phase === "done") {
      const t = setTimeout(() => setPhase("reset"), 3200);
      return () => clearTimeout(t);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setMasterTyped("");
        setSlotsTyped(["", "", "", "", ""]);
        setAgentProgress([0, 0, 0, 0, 0]);
        setPhase("idle");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const popoverOpen =
    phase === "popoverMaster" ||
    phase === "popoverSlots" ||
    phase === "send";

  const showThread = phase === "spawn" || phase === "done";
  const sendActive = phase === "send";
  const pillActive =
    phase === "clickPill" ||
    phase === "popoverMaster" ||
    phase === "popoverSlots" ||
    phase === "send";
  const activeSlotsCount = slotsTyped.filter((s) => s.trim().length > 0).length;

  return (
    <section
      className="u-container py-12 lg:py-16"
      id="composer"
      aria-label="Veronum composer demo"
    >
      <div className="mb-6 lg:mb-8 max-w-[60ch]">
        <p className="text-[14px] text-ink-faded uppercase tracking-[0.12em] mb-3">
          Live demo · scripted
        </p>
        <h2
          className="font-serif font-medium text-ink leading-[1.1]"
          style={{ fontSize: "var(--display-l)" }}
        >
          One prompt. Ten agents in parallel.
        </h2>
        <p
          className="mt-3 text-ink/80 leading-relaxed"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          The actual Veronum desktop UI, running in your browser with
          scripted data. Click the @agents pill, dispatch a master task to
          a parallel fleet, watch them complete. Loops every 18 seconds.
        </p>
      </div>

      {/* Mac window frame */}
      <div className="veronum-demo-frame bg-ivory-light rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_8px_16px_-8px_rgba(0,0,0,0.12)] border border-ink/10 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 h-9 bg-[#f4f0e8] border-b border-ink/[0.08]">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-serif text-[13px] text-ink-faded">
            Veronum
          </span>
        </div>

        <div className="flex h-[600px]">
          {/* Sidebar */}
          <aside className="w-[240px] border-r border-ink/[0.08] bg-[#faf7f0] flex-col hidden md:flex">
            <div className="p-3 border-b border-ink/[0.06]">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ivory-light border border-ink/[0.08] text-[13px] text-ink hover:bg-ivory transition">
                <span className="text-[14px]">＋</span>
                <span>New session</span>
                <span className="ml-auto text-[10.5px] text-ink-faded font-mono">
                  ⌘N
                </span>
              </button>
            </div>
            <div className="px-3 py-2 space-y-0.5">
              <SidebarItem icon="⚡" label="Routines" />
              <SidebarItem icon="◇" label="Customize" />
              <SidebarItem icon="◷" label="History" />
            </div>
            <div className="px-4 pt-4 pb-1 text-[10.5px] uppercase tracking-[0.14em] text-ink-faded font-mono">
              Today
            </div>
            <ul className="px-2 space-y-px">
              {SIDEBAR_TODAY.map((s, i) => (
                <li
                  key={s}
                  className={`px-3 py-1.5 rounded text-[12.5px] truncate ${
                    i === 0
                      ? "bg-ink/[0.06] text-ink font-medium"
                      : "text-ink/75 hover:bg-ink/[0.04]"
                  }`}
                >
                  {s}
                </li>
              ))}
            </ul>
            <div className="px-4 pt-4 pb-1 text-[10.5px] uppercase tracking-[0.14em] text-ink-faded font-mono">
              Yesterday
            </div>
            <ul className="px-2 space-y-px">
              {SIDEBAR_YESTERDAY.map((s) => (
                <li
                  key={s}
                  className="px-3 py-1.5 rounded text-[12.5px] truncate text-ink/75 hover:bg-ink/[0.04]"
                >
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-auto px-3 py-3 border-t border-ink/[0.06] flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-clay/20 flex items-center justify-center text-[11px] font-medium text-clay">
                DW
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-ink truncate">
                  Dylan Wain
                </div>
                <div className="text-[10.5px] text-ink-faded truncate">
                  Veronum Pro
                </div>
              </div>
            </div>
          </aside>

          {/* Main chat area */}
          <main className="flex-1 relative bg-ivory-light flex flex-col">
            {/* Trial banner — top-right */}
            <div className="absolute top-3 right-4 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ivory-light border border-ink/[0.10] text-[11.5px] font-medium text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]">
              <VeronumMark className="w-3.5 h-3.5 rounded-sm" />
              <span>6 days left in trial</span>
              <button className="ml-1 px-2.5 py-0.5 bg-clay text-ivory rounded-full text-[11px] font-medium hover:bg-accent transition">
                Upgrade
              </button>
            </div>

            {/* Thread area */}
            <div className="flex-1 overflow-hidden px-8 pt-16 pb-4">
              {!showThread && (
                <div className="h-full flex items-center justify-center">
                  <h3
                    className="font-serif font-medium text-ink/65 text-center"
                    style={{ fontSize: "var(--display-m)" }}
                  >
                    How can I help you today?
                  </h3>
                </div>
              )}

              {showThread && (
                <div className="space-y-4 animate-[demoFadeIn_0.4s_ease-out_forwards]">
                  {/* User message */}
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-clay/20 flex items-center justify-center text-[11px] font-medium text-clay flex-shrink-0">
                      DW
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-[14px] text-ink/85 leading-relaxed">
                        {MASTER}
                      </div>
                    </div>
                  </div>

                  {/* Assistant response */}
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                      <VeronumMark className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pt-1 min-w-0">
                      <div className="text-[14px] text-ink leading-relaxed mb-3">
                        Spawning 5 agents in parallel.
                      </div>
                      <div className="space-y-1.5">
                        {SLOTS.map((s, i) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-3 bg-ivory border border-ink/[0.08] rounded-lg px-3 py-2"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: s.color }}
                            />
                            <span className="font-mono text-[10.5px] text-ink-faded w-6 flex-shrink-0">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-[12.5px] text-ink/85 flex-1 truncate">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-ink/50"> — </span>
                              {s.task}
                            </span>
                            <div className="w-16 h-1 bg-ink/5 rounded-full overflow-hidden flex-shrink-0">
                              <div
                                className="h-full transition-all duration-200"
                                style={{
                                  width: `${agentProgress[i]}%`,
                                  background: s.color,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10.5px] text-ink-faded w-10 text-right flex-shrink-0">
                              {agentProgress[i] >= 100
                                ? "done"
                                : `${agentProgress[i]}%`}
                            </span>
                          </div>
                        ))}
                      </div>

                      {phase === "done" && (
                        <div className="mt-3 px-3 py-2.5 bg-clay/8 border border-clay/20 rounded-lg text-[12.5px] text-ink leading-relaxed animate-[demoFadeIn_0.35s_ease-out_forwards] opacity-0">
                          <span className="font-medium">All 5 agents done.</span>{" "}
                          PR drafted with 14 new tests, session middleware
                          refactored, changelog written, deploy preview live.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="relative px-6 pb-5 pt-2">
              {/* Agents popover (dwc-agents-ui) — slides up from composer */}
              {popoverOpen && (
                <div
                  className="absolute left-6 right-6 z-30 bg-ivory-light border border-ink/[0.10] rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_4px_12px_-6px_rgba(0,0,0,0.10)] overflow-hidden animate-[demoPopIn_0.18s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                  style={{ bottom: "calc(100% - 8px)" }}
                >
                  {/* Master task */}
                  <div className="px-4 pt-3 pb-2.5">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faded mb-1.5">
                      Master task
                    </div>
                    <div className="bg-ivory border border-ink/[0.10] rounded-lg px-3 py-2 text-[13px] text-ink min-h-[2em] leading-relaxed">
                      {masterTyped || (
                        <span className="text-ink-faded">
                          Describe the work; agents below will run in parallel
                        </span>
                      )}
                      {phase === "popoverMaster" && (
                        <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-ink/[0.08] mx-2" />

                  {/* Agent slots */}
                  <div className="py-1">
                    {SLOTS.map((s, i) => {
                      const text = slotsTyped[i];
                      const active = text.trim().length > 0;
                      const typing =
                        phase === "popoverSlots" &&
                        i === activeSlotsCount &&
                        text.length > 0 &&
                        text.length < s.task.length;
                      return (
                        <div
                          key={s.name}
                          className={`flex items-center gap-3 px-4 py-1.5 mx-1 rounded-lg ${
                            active ? "bg-ink/[0.04]" : ""
                          }`}
                        >
                          <span
                            className={`font-mono text-[11px] w-5 text-center flex-shrink-0 tabular-nums ${
                              active
                                ? "text-clay font-semibold"
                                : "text-ink-faded/60"
                            }`}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`text-[12.5px] flex-1 truncate ${
                              active ? "text-ink" : "text-ink-faded/50"
                            }`}
                          >
                            {text || `Agent ${i + 1} task`}
                            {typing && (
                              <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                            )}
                          </span>
                          {active && (
                            <span className="text-[11px] text-clay font-mono">
                              ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {/* Empty rows 6-10, faded */}
                    {[5, 6, 7, 8, 9].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-1.5 mx-1"
                      >
                        <span className="font-mono text-[11px] w-5 text-center text-ink-faded/50 tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[12.5px] text-ink-faded/50">
                          Agent {i + 1} task
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Send row */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-ink/[0.08]">
                    <span className="font-mono text-[11px] text-ink-faded">
                      ↵ to send · esc to close
                    </span>
                    <button
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        activeSlotsCount > 0
                          ? "bg-clay text-ivory"
                          : "bg-ink/10 text-ink-faded cursor-not-allowed"
                      } ${
                        sendActive
                          ? "scale-105 shadow-[0_0_0_4px_rgba(204,120,92,0.20)]"
                          : ""
                      }`}
                    >
                      <span>Send to {activeSlotsCount || 0} agents</span>
                      <span>↵</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Composer input */}
              <div className="bg-ivory-light border border-ink/[0.10] rounded-2xl px-4 pt-3 pb-2.5 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)]">
                <div className="text-[14px] text-ink/40 min-h-[1.5em] leading-relaxed">
                  Reply to Veronum...
                </div>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-ink/[0.06]">
                  {/* Anthropic native: + (attach), tools picker, model picker */}
                  <button className="w-7 h-7 rounded-md hover:bg-ink/[0.05] flex items-center justify-center text-ink-faded text-[15px]">
                    ＋
                  </button>
                  <button className="w-7 h-7 rounded-md hover:bg-ink/[0.05] flex items-center justify-center text-ink-faded text-[14px]">
                    ◐
                  </button>
                  <button className="px-2.5 h-7 rounded-md hover:bg-ink/[0.05] flex items-center gap-1.5 text-[11.5px] text-ink-faded">
                    <span>Opus 4.7</span>
                    <span className="text-[9px]">▾</span>
                  </button>

                  {/* dwc-agents pill */}
                  <button
                    className={`ml-1 px-2.5 h-7 rounded-full inline-flex items-center gap-1.5 text-[11.5px] font-medium border transition-all ${
                      pillActive
                        ? "bg-clay text-ivory border-clay shadow-[0_0_0_3px_rgba(204,120,92,0.18)]"
                        : "bg-ivory text-ink border-ink/[0.12] hover:border-ink/[0.25]"
                    }`}
                  >
                    <VeronumMark
                      className={`w-3 h-3 rounded-sm ${
                        pillActive ? "brightness-0 invert" : ""
                      }`}
                    />
                    <span>@agents</span>
                    {activeSlotsCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 rounded-full ${
                          pillActive ? "bg-ivory/25" : "bg-clay/15 text-clay"
                        }`}
                      >
                        {activeSlotsCount}
                      </span>
                    )}
                  </button>

                  {/* dwc-toolbar pill — undo / redo / history */}
                  <div className="ml-auto inline-flex items-center gap-0 px-1.5 h-7 rounded-full bg-ivory border border-ink/[0.10]">
                    <button
                      title="Undo"
                      className="w-6 h-6 rounded-full hover:bg-ink/[0.06] flex items-center justify-center text-ink-faded"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
                      </svg>
                    </button>
                    <button
                      title="Redo"
                      className="w-6 h-6 rounded-full hover:bg-ink/[0.06] flex items-center justify-center text-ink-faded"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 7v6h-6" />
                        <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
                      </svg>
                    </button>
                    <button
                      title="Version history"
                      className="w-6 h-6 rounded-full hover:bg-ink/[0.06] flex items-center justify-center text-ink-faded"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M12 7v5l4 2" />
                      </svg>
                    </button>
                  </div>

                  {/* Native send (disabled when popover is the active path) */}
                  <button className="w-7 h-7 rounded-full bg-ink/15 text-ink-faded flex items-center justify-center text-sm">
                    ↑
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

function SidebarItem({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[12.5px] text-ink/80 hover:bg-ink/[0.04]">
      <span className="text-[12px] text-ink-faded">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
