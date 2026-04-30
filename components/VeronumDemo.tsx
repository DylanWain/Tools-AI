"use client";

import { useEffect, useState } from "react";
import { VeronumMark } from "./VeronumMark";

/**
 * Live, scripted demo of Veronum. Shows the actual Mac app shell —
 * sidebar, trial banner, "How can I help you today?" hero, composer with
 * the Veronum multi-agent pill — and animates the canonical user flow:
 *
 *   1. Prompt types into the composer
 *   2. Composer pill expands into 5 parallel agents
 *   3. Each agent shows progress, then completes
 *   4. Loop
 *
 * Pixel proportions and colors are lifted from the desktop app's actual
 * dwc-toolbar / dwc-agents-ui / dwc-subscription source so this reads as
 * a real screenshot, not a mockup.
 */

type Phase = "typing" | "splitting" | "working" | "done" | "reset";

const PROMPT =
  "Add unit tests for the auth flow, refactor the session middleware, and write the changelog entry";

const AGENTS = [
  { name: "Tests", color: "#cc785c", task: "Writing unit tests for auth.ts" },
  { name: "Refactor", color: "#bcd1ca", task: "Refactoring session middleware" },
  { name: "Docs", color: "#ebdbbc", task: "Drafting changelog v1.4.0" },
  { name: "Review", color: "#cbcadb", task: "Cross-checking diffs" },
  { name: "Deploy", color: "#c46686", task: "Staging deploy preview" },
];

export function VeronumDemo() {
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");
  const [agentProgress, setAgentProgress] = useState<number[]>([0, 0, 0, 0, 0]);

  // Phase progression
  useEffect(() => {
    if (phase === "typing") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= PROMPT.length) {
          setTyped(PROMPT.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setTimeout(() => setPhase("splitting"), 700);
        }
      }, 28);
      return () => clearInterval(id);
    }
    if (phase === "splitting") {
      const t = setTimeout(() => setPhase("working"), 900);
      return () => clearTimeout(t);
    }
    if (phase === "working") {
      const id = setInterval(() => {
        setAgentProgress((prev) => {
          const next = prev.map(
            (p, i) => Math.min(100, p + 8 + ((i * 3) % 7))
          );
          if (next.every((p) => p >= 100)) {
            clearInterval(id);
            setTimeout(() => setPhase("done"), 600);
          }
          return next;
        });
      }, 220);
      return () => clearInterval(id);
    }
    if (phase === "done") {
      const t = setTimeout(() => setPhase("reset"), 3500);
      return () => clearTimeout(t);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setTyped("");
        setAgentProgress([0, 0, 0, 0, 0]);
        setPhase("typing");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const showAgents = phase === "splitting" || phase === "working" || phase === "done";

  return (
    <section
      className="u-container py-16 lg:py-24"
      id="composer"
      aria-label="Veronum composer demo"
    >
      <div className="mb-8 lg:mb-12 max-w-[60ch]">
        <p className="text-[14px] text-ink-faded uppercase tracking-[0.12em] mb-4">
          Live demo
        </p>
        <h2
          className="font-serif font-medium text-ink leading-[1.1]"
          style={{ fontSize: "var(--display-l)" }}
        >
          One prompt. Up to ten agents in parallel.
        </h2>
        <p
          className="mt-4 text-ink/80 leading-relaxed"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          This is the real Veronum composer running in your browser with
          scripted data. Watch the agent fan-out — every 12 seconds it loops.
        </p>
      </div>

      {/* Mac window frame */}
      <div className="bg-ivory-light rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_8px_16px_-8px_rgba(0,0,0,0.12)] border border-ink/10 overflow-hidden">
        {/* Title bar with macOS traffic lights */}
        <div className="flex items-center gap-2 px-4 h-9 bg-ivory-dark border-b border-ink/[0.08]">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-serif text-[13px] text-ink-faded">
            Veronum
          </span>
        </div>

        <div className="flex h-[560px]">
          {/* Sidebar — mimics claude.ai's left pane */}
          <aside className="w-[220px] border-r border-ink/[0.08] bg-ivory p-4 hidden md:flex flex-col">
            <div className="text-[13px] font-medium text-ink-faded mb-3">
              Chat
            </div>
            <ul className="space-y-2 mb-6 text-[13px] text-ink">
              <li className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink/[0.04]">
                <span>+</span> New session
              </li>
              <li className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink/[0.04]">
                <span>⚡</span> Routines
              </li>
              <li className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink/[0.04]">
                <span>⚙</span> Customize
              </li>
            </ul>
            <div className="text-[11px] uppercase tracking-wider text-ink-faded mb-2">
              Pinned
            </div>
            <ul className="space-y-1.5 mb-6 text-[12.5px] text-ink/80">
              <li className="px-2 py-1 truncate">○ Add unit tests for auth</li>
            </ul>
            <div className="text-[11px] uppercase tracking-wider text-ink-faded mb-2">
              Today
            </div>
            <ul className="space-y-1.5 text-[12.5px] text-ink/80 flex-1">
              <li className="px-2 py-1 truncate">○ Build full stack fitness app</li>
              <li className="px-2 py-1 truncate">○ Review and prepare frontend code</li>
              <li className="px-2 py-1 truncate">○ Study Cursor and Warp websites</li>
            </ul>
            <div className="mt-auto pt-4 border-t border-ink/10 text-[12px] text-ink-faded">
              Dylan
            </div>
          </aside>

          {/* Main chat area */}
          <main className="flex-1 relative bg-ivory">
            {/* Trial banner pill — top-right, exact spec from dwc-subscription */}
            <div className="absolute top-3 right-4 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ivory-light border border-ink/[0.12] text-[12px] font-medium text-ink shadow-sm">
              <VeronumMark className="w-3.5 h-3.5 rounded-sm" />
              <span>6 days left in trial</span>
              <button className="ml-1 px-2.5 py-0.5 bg-clay text-ivory rounded-full text-[11.5px] font-medium hover:bg-accent transition">
                Upgrade
              </button>
            </div>

            <div className="flex flex-col h-full p-8 pt-16">
              {/* "How can I help you today?" hero — only visible when no agents */}
              {!showAgents && (
                <div className="flex-1 flex items-center justify-center">
                  <h3
                    className="font-serif font-medium text-ink/80 text-center"
                    style={{ fontSize: "var(--display-m)" }}
                  >
                    How can I help you today?
                  </h3>
                </div>
              )}

              {/* Agent fan-out grid — visible during split/working/done */}
              {showAgents && (
                <div className="flex-1 overflow-hidden">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faded mb-3">
                    5 agents working in parallel
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {AGENTS.map((agent, i) => (
                      <div
                        key={agent.name}
                        className="bg-ivory-light border border-ink/[0.08] rounded-lg p-3 animate-[demoFadeIn_0.5s_ease-out_forwards] opacity-0"
                        style={{
                          animationDelay: `${i * 80}ms`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: agent.color }}
                          />
                          <span className="text-[12px] font-medium text-ink">
                            {agent.name}
                          </span>
                          {agentProgress[i] >= 100 ? (
                            <span className="ml-auto text-[11px] text-ink-faded">
                              ✓ Done
                            </span>
                          ) : (
                            <span className="ml-auto text-[11px] text-ink-faded">
                              {agentProgress[i]}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-ink/70 leading-snug mb-2 line-clamp-2 min-h-[2.5em]">
                          {agent.task}
                        </p>
                        <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${agentProgress[i]}%`,
                              background: agent.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {phase === "done" && (
                    <div className="mt-4 px-3 py-2 bg-ivory-light border border-ink/[0.08] rounded-lg text-[12.5px] text-ink animate-[demoFadeIn_0.4s_ease-out_forwards] opacity-0">
                      <span className="font-medium">Synthesis:</span>{" "}
                      All 5 tasks complete. PR drafted, tests passing, changelog updated.
                    </div>
                  )}
                </div>
              )}

              {/* Composer at bottom */}
              <div className="mt-auto">
                {/* Veronum agent pill toolbar */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 bg-ivory-light border border-ink/10 rounded-full text-[12px] text-ink">
                  <VeronumMark className="w-3.5 h-3.5 rounded-sm" />
                  <span className="font-medium">5 agents</span>
                  <span className="text-ink-faded">·</span>
                  <span className="text-ink-faded">parallel</span>
                </div>
                <div className="bg-ivory-light border border-ink/10 rounded-xl px-4 py-3 shadow-sm">
                  <div className="text-[14px] text-ink min-h-[1.5em] leading-relaxed">
                    {typed || (
                      <span className="text-ink-faded">
                        How can I help you today?
                      </span>
                    )}
                    {phase === "typing" && (
                      <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[2px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-ink/[0.06]">
                    <button className="w-7 h-7 rounded-md hover:bg-ink/[0.04] flex items-center justify-center text-ink-faded text-sm">
                      +
                    </button>
                    <button className="w-7 h-7 rounded-md hover:bg-ink/[0.04] flex items-center justify-center text-ink-faded text-sm">
                      ◐
                    </button>
                    <span className="ml-auto text-[12px] text-ink-faded">
                      Opus 4.7 · 1M · Max
                    </span>
                    <button className="w-7 h-7 rounded-full bg-ink text-ivory flex items-center justify-center text-sm">
                      ↑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

    </section>
  );
}
