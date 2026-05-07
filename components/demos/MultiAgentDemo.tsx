"use client";

/**
 * MultiAgentDemo — auto-playing recreation of Veronum's multi-agent
 * composer flow. 1:1 visual match against the running app's
 * AgentSlots modal + Composer + chat thread.
 *
 * Visual references (every element traced to a source file):
 *   - DemoShell           ← dframe-root chrome + sidebar wrapping
 *   - DemoComposer        ← .code-prompt-* port from real Composer
 *   - AgentSlots modal    ← renderer/src/components/AgentSlots.tsx
 *   - DemoMessage         ← MessageBubble from chat tab
 *
 * Phase machine (mirrors actual user flow):
 *   1. idle             — chat thread visible, composer empty (1.4 s)
 *   2. clickAgentBtn    — multi-agent button pulses (0.4 s)
 *   3. modalMaster      — modal opens; master task types in (~3 s)
 *   4. modalSlots       — 5 of 10 slots fill in (~6 s)
 *   5. modalSend        — Send button pulses (0.6 s)
 *   6. modalClose       — modal fades, composer shows composed prompt (~0.4 s)
 *   7. composerSend     — composer Send button pulses (0.5 s)
 *   8. assistantThinking— pulse user bubble + streaming assistant (1.2 s)
 *   9. agentsProgress   — 5 progress bars fill 0 → 100% (~6 s)
 *  10. synthesis        — final assistant message lands (3 s)
 *  11. reset            — fade everything, loop back to idle
 */

import { useEffect, useState } from "react";
import { DemoShell } from "./DemoShell";
import { DemoHeader } from "./DemoHeader";
import { DemoComposer } from "./DemoComposer";
import { DemoMessage } from "./DemoMessage";

type Phase =
  | "idle"
  | "clickAgentBtn"
  | "modalMaster"
  | "modalSlots"
  | "modalSend"
  | "modalClose"
  | "composerSend"
  | "assistantThinking"
  | "agentsProgress"
  | "synthesis"
  | "reset";

const MASTER = "Add unit tests for the auth flow and ship a release.";

type SlotDef = {
  name: string;
  task: string;
  /** Color for the agent dot in the progress section */
  color: string;
};

const SLOTS: SlotDef[] = [
  { name: "Tests", task: "Write unit tests for src/auth/*.ts", color: "#cc785c" },
  { name: "Refactor", task: "Refactor session middleware", color: "#5e8b6d" },
  { name: "Docs", task: "Draft changelog for v1.1.1", color: "#a87dbf" },
  { name: "Review", task: "Cross-check diffs across the team", color: "#c46686" },
  { name: "Deploy", task: "Stage deploy preview", color: "#3878a3" },
];

const TOTAL_SLOTS = 10;

export function MultiAgentDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [masterTyped, setMasterTyped] = useState("");
  const [slotsTyped, setSlotsTyped] = useState<string[]>(
    new Array(SLOTS.length).fill("")
  );
  const [progress, setProgress] = useState<number[]>(
    new Array(SLOTS.length).fill(0)
  );

  // Phase machine — same pattern as veronum-overlay's flow timing.
  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("clickAgentBtn"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "clickAgentBtn") {
      const t = setTimeout(() => {
        setMasterTyped("");
        setPhase("modalMaster");
      }, 420);
      return () => clearTimeout(t);
    }
    if (phase === "modalMaster") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= MASTER.length) {
          setMasterTyped(MASTER.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setSlotsTyped(new Array(SLOTS.length).fill(""));
          setPhase("modalSlots");
        }
      }, 32);
      return () => clearInterval(id);
    }
    if (phase === "modalSlots") {
      let slotIdx = 0;
      let charIdx = 0;
      const id = setInterval(() => {
        const target = SLOTS[slotIdx]?.task ?? "";
        if (charIdx <= target.length) {
          setSlotsTyped((prev) => {
            const next = [...prev];
            next[slotIdx] = target.slice(0, charIdx);
            return next;
          });
          charIdx++;
        } else {
          slotIdx++;
          charIdx = 0;
          if (slotIdx >= SLOTS.length) {
            clearInterval(id);
            setPhase("modalSend");
          }
        }
      }, 22);
      return () => clearInterval(id);
    }
    if (phase === "modalSend") {
      const t = setTimeout(() => setPhase("modalClose"), 700);
      return () => clearTimeout(t);
    }
    if (phase === "modalClose") {
      const t = setTimeout(() => setPhase("composerSend"), 450);
      return () => clearTimeout(t);
    }
    if (phase === "composerSend") {
      const t = setTimeout(() => setPhase("assistantThinking"), 550);
      return () => clearTimeout(t);
    }
    if (phase === "assistantThinking") {
      const t = setTimeout(() => {
        setProgress(new Array(SLOTS.length).fill(0));
        setPhase("agentsProgress");
      }, 1200);
      return () => clearTimeout(t);
    }
    if (phase === "agentsProgress") {
      let frame = 0;
      const id = setInterval(() => {
        frame++;
        setProgress((prev) =>
          prev.map((p, i) => {
            // Stagger each agent's start; 5 agents finish over ~5 s.
            const start = i * 8;
            const speed = 1.4 + (i % 3) * 0.2;
            return Math.min(100, Math.max(0, (frame - start) * speed));
          })
        );
        if (frame > 110) {
          clearInterval(id);
          setProgress(new Array(SLOTS.length).fill(100));
          setPhase("synthesis");
        }
      }, 50);
      return () => clearInterval(id);
    }
    if (phase === "synthesis") {
      const t = setTimeout(() => setPhase("reset"), 3000);
      return () => clearTimeout(t);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setMasterTyped("");
        setSlotsTyped(new Array(SLOTS.length).fill(""));
        setProgress(new Array(SLOTS.length).fill(0));
        setPhase("idle");
      }, 800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const activeCount = slotsTyped.filter((t) => t.trim().length > 0).length;
  const modalVisible =
    phase === "modalMaster" ||
    phase === "modalSlots" ||
    phase === "modalSend" ||
    phase === "modalClose";
  const composedPrompt =
    phase === "modalClose" ||
    phase === "composerSend" ||
    phase === "assistantThinking" ||
    phase === "agentsProgress" ||
    phase === "synthesis"
      ? `Master task: ${MASTER}\n\nUse @veronum-agent-1, @veronum-agent-2, @veronum-agent-3, @veronum-agent-4, @veronum-agent-5 in PARALLEL …`
      : "";
  const showStreamingAssistant =
    phase === "assistantThinking" || phase === "agentsProgress";
  const showSynthesisMessage = phase === "synthesis" || phase === "reset";

  return (
    <DemoShell
      cwd="T3 Tools"
      sessionTitle="Add unit tests for multi-agent orchestrator"
      activeProjectName="T3 Tools"
      activeSessionTitle="Add unit tests for multi-agent orchestrator"
    >
      <DemoHeader
        title="Add unit tests for multi-agent orchestrator"
        shared
        turnCount={9 + (showSynthesisMessage ? 2 : showStreamingAssistant ? 1 : 0)}
        cwd="~/T3 Tools"
        activeTab="chat"
      />

      {/* Chat scroll body */}
      <div className="px-7 pb-2 overflow-hidden flex flex-col gap-5 h-[calc(100%-200px)]">
        <DemoMessage
          authorName="dylan"
          authorColor="#7d7d76"
          ts="14m ago"
          body="Help me ship the auth fix — I want it parallelized across our subagents so the unit tests, refactor and deploy happen at once."
        />
        <DemoMessage
          isAi
          authorName="claude"
          ts="13m ago"
          body={
            <>
              Sounds good. I&apos;ll dispatch the work across our specialist
              agents — open the multi-agent composer (the icon between the
              paperclip and the model picker) and give me one master goal
              plus a sub-task per agent.
            </>
          }
        />

        {/* Optimistic user bubble — appears once modal closes & composer fires */}
        {composedPrompt && (
          <DemoMessage
            authorName="dylan"
            authorColor="#7d7d76"
            ts="just now"
            body={
              <span className="font-mono text-[12.5px] whitespace-pre-line text-ink/85">
                {composedPrompt}
              </span>
            }
            pulse={
              phase === "composerSend" || phase === "assistantThinking"
            }
          />
        )}

        {/* Streaming assistant + per-agent progress */}
        {showStreamingAssistant && (
          <DemoMessage
            isAi
            authorName="claude"
            ts="now"
            streaming
            body={
              <div className="space-y-2.5">
                <div>
                  Spawning {SLOTS.length} agents in parallel via the Task
                  tool — each one runs in its own context window.
                </div>
                <div className="space-y-1.5">
                  {SLOTS.map((s, i) => (
                    <div
                      key={s.name}
                      className="flex items-center gap-2.5 text-[12px]"
                    >
                      <span
                        className="font-mono text-[10.5px] tabular-nums w-[44px] text-ink-faded"
                        style={{ color: progress[i] >= 100 ? s.color : undefined }}
                      >
                        agent {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="font-mono text-[10.5px] uppercase tracking-[0.06em]"
                        style={{ color: s.color, minWidth: 56 }}
                      >
                        {s.name}
                      </span>
                      <div
                        className="flex-1 h-[5px] rounded-full overflow-hidden"
                        style={{ background: "rgba(20,20,19,0.06)" }}
                      >
                        <div
                          className="h-full transition-[width] duration-100 ease-linear"
                          style={{
                            width: `${progress[i]}%`,
                            background: s.color,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-ink-faded tabular-nums w-[34px] text-right">
                        {progress[i] >= 100
                          ? "✓"
                          : `${Math.round(progress[i])}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        )}

        {showSynthesisMessage && (
          <DemoMessage
            isAi
            authorName="claude"
            ts="now"
            body={
              <div className="space-y-2">
                <div>
                  All five agents finished. Tests landed (12 new specs, 100%
                  pass), session middleware is refactored, changelog drafted
                  for v1.1.1, diffs cross-checked, and a stage deploy preview
                  is live at <span className="font-mono text-[12px]">https://stage.veronum.app</span>.
                </div>
                <div className="text-[11.5px] font-mono text-ink-faded">
                  ↳ 5 agents · 14.2 s wall · 26.4 k tokens
                </div>
              </div>
            }
          />
        )}
      </div>

      {/* Composer pinned to the bottom of the main pane */}
      <div className="absolute bottom-0 left-0 right-0 px-7 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
        <DemoComposer
          value={composedPrompt}
          cursor={false}
          agentPulse={phase === "clickAgentBtn"}
          sendPulse={phase === "composerSend"}
          streaming={
            phase === "assistantThinking" || phase === "agentsProgress"
          }
        />
      </div>

      {/* AgentSlots modal — full-screen overlay (matches actual app) */}
      {modalVisible && (
        <AgentSlotsModal
          activeCount={activeCount}
          masterTyped={masterTyped}
          slotsTyped={slotsTyped}
          phase={phase}
        />
      )}
    </DemoShell>
  );
}

/** Inline modal — recreates AgentSlots.tsx layout pixel-by-pixel. */
function AgentSlotsModal({
  activeCount,
  masterTyped,
  slotsTyped,
  phase,
}: {
  activeCount: number;
  masterTyped: string;
  slotsTyped: string[];
  phase: Phase;
}) {
  const closing = phase === "modalClose";
  const sendPulse = phase === "modalSend";
  return (
    <div
      className={`absolute inset-0 z-40 flex items-end justify-center backdrop-blur-[2px] px-6 pb-20 pt-10 transition-all duration-200 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: closing ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.30)",
      }}
    >
      <div
        className="bg-white border border-ink/[0.10] rounded-[10px] flex flex-col overflow-hidden animate-[demoPopIn_0.22s_cubic-bezier(0.32,0.72,0,1)_forwards]"
        style={{
          width: "min(640px, 100%)",
          maxHeight: "80%",
          boxShadow:
            "0 0 0 0.5px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.10)",
        }}
      >
        {/* Header: title + counter + close */}
        <div className="flex items-baseline gap-3 px-4 py-3.5 border-b border-ink/[0.08]">
          <span
            className="font-serif text-ink"
            style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.018em" }}
          >
            Multi-agent composer
          </span>
          <span className="font-mono text-[11px] text-ink-faded">
            {activeCount} / {TOTAL_SLOTS} agents
          </span>
          <button
            aria-label="Close"
            className="ml-auto w-[22px] h-[22px] rounded-md flex items-center justify-center text-ink-faded hover:bg-ink/[0.04]"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              width={13}
              height={13}
            >
              <path d="M4 4l8 8M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Master + slots scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5">
          <label className="block font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faded">
            Master task (optional context for all agents)
          </label>
          <div
            className="bg-white border border-ink/[0.10] rounded-lg px-2.5 py-2 text-[13px] text-ink min-h-[56px] leading-[1.5]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {masterTyped || (
              <span className="text-ink-faded">
                What&apos;s the overall goal? e.g. &lsquo;Refactor authentication across the codebase&rsquo;
              </span>
            )}
            {phase === "modalMaster" && (
              <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
            )}
          </div>

          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faded pt-2">
            Sub-tasks (one per agent, leave blank to skip)
          </div>

          {/* Slot rows: 10 total. First 5 fill in during modalSlots phase. */}
          {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
            const slot = SLOTS[i];
            const text = slotsTyped[i] ?? "";
            const isActive = text.trim().length > 0;
            const typing =
              phase === "modalSlots" &&
              text.length > 0 &&
              slot &&
              text.length < slot.task.length;
            return (
              <div
                key={i}
                className="flex items-stretch gap-2 transition-opacity"
                style={{ opacity: isActive ? 1 : 0.78 }}
              >
                <span
                  className="flex items-center justify-center font-mono text-[11px] font-medium rounded-md flex-shrink-0"
                  style={{
                    width: 56,
                    color: isActive ? "#1a1a18" : "#87867f",
                    background: isActive
                      ? "rgba(20,20,19,0.06)"
                      : "rgba(20,20,19,0.03)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div
                  className="flex-1 bg-white border border-ink/[0.10] rounded-lg px-2.5 py-1.5 text-[13px]"
                  style={{
                    color: isActive ? "#1a1a18" : "#a09e92",
                    minHeight: 30,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {text || (slot ? `Sub-task for agent ${i + 1}` : "—")}
                  {typing && (
                    <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Reset / Send */}
        <div className="flex items-center justify-between border-t border-ink/[0.08] px-3.5 py-2.5">
          <button className="text-[12.5px] text-ink-faded font-medium px-2 py-1 rounded-md hover:bg-ink/[0.04]">
            Reset
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-ink-faded">
              ↵ to send · esc to close
            </span>
            <button
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all ${
                activeCount > 0
                  ? "bg-ink text-white"
                  : "bg-ink/10 text-ink-faded cursor-not-allowed"
              } ${sendPulse ? "scale-[1.04]" : ""}`}
              style={{
                boxShadow: sendPulse
                  ? "0 0 0 4px rgba(20,20,19,0.10)"
                  : undefined,
              }}
            >
              <span>
                Dispatch {activeCount || 0} agent{activeCount === 1 ? "" : "s"}
              </span>
              <span>↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
