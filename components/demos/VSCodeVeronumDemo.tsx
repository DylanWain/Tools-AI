"use client";

/**
 * VSCodeVeronumDemo — two windows side by side, communicating live:
 *
 *   • LEFT  · VS Code (real chrome) — Dylan editing
 *   • RIGHT · Veronum               — teammate watching the same session
 *
 * Phase machine drives the animation:
 *   1.  idle           — both windows showing the file, cursor on line 4
 *   2.  promptType     — Veronum composer types the prompt
 *   3.  send           — composer Send pulses, message lands in Veronum thread
 *   4.  claudeStream   — Claude's reply streams in Veronum
 *   5.  edit           — Veronum diff card lights up; the linked line in
 *                        VS Code flashes "edited" and the new code lands
 *   6.  syncPulse      — tiny "synced" beat in Veronum statusRight
 *   7.  reset          — fade out → loop back to idle
 *
 * The thesis the demo sells: same session, different editors, real-time.
 */

import { useEffect, useState } from "react";
import { VSCodeShell } from "./VSCodeShell";
import { DemoShell } from "./DemoShell";
import { DemoHeader } from "./DemoHeader";
import { DemoComposer } from "./DemoComposer";
import { DemoMessage } from "./DemoMessage";

type Phase =
  | "idle"
  | "promptType"
  | "send"
  | "claudeStream"
  | "edit"
  | "syncPulse"
  | "reset";

const PROMPT = "Drop the legacy cookie path. Read the bearer token from the Authorization header.";
const CLAUDE_REPLY =
  "Rewriting apps/server/src/middleware/session.ts — the cookie fallback is gone, bearer token is the only path now.";

export function VSCodeVeronumDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [promptTyped, setPromptTyped] = useState("");
  const [claudeStreamed, setClaudeStreamed] = useState("");

  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("promptType"), 1500);
      return () => clearTimeout(t);
    }
    if (phase === "promptType") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= PROMPT.length) {
          setPromptTyped(PROMPT.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setPhase("send");
        }
      }, 22);
      return () => clearInterval(id);
    }
    if (phase === "send") {
      const t = setTimeout(() => {
        setClaudeStreamed("");
        setPhase("claudeStream");
      }, 500);
      return () => clearTimeout(t);
    }
    if (phase === "claudeStream") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= CLAUDE_REPLY.length) {
          setClaudeStreamed(CLAUDE_REPLY.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setTimeout(() => setPhase("edit"), 400);
        }
      }, 18);
      return () => clearInterval(id);
    }
    if (phase === "edit") {
      const t = setTimeout(() => setPhase("syncPulse"), 2200);
      return () => clearTimeout(t);
    }
    if (phase === "syncPulse") {
      const t = setTimeout(() => setPhase("reset"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setPromptTyped("");
        setClaudeStreamed("");
        setPhase("idle");
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Code body for the VS Code window. Pre-edit lines below; post-edit
  // lines become added during the "edit" phase.
  const editApplied =
    phase === "edit" || phase === "syncPulse" || phase === "reset";

  const codeLines = editApplied
    ? [
        { tokens: [{ text: "import ", kind: "keyword" as const }, { text: "{ HttpError }", kind: "var" as const }, { text: " from ", kind: "keyword" as const }, { text: "\"../errors\"", kind: "string" as const }, { text: ";", kind: "punct" as const }] },
        { tokens: [{ text: "" }] },
        { tokens: [{ text: "export async function ", kind: "keyword" as const }, { text: "resolveSession", kind: "fn" as const }, { text: "(", kind: "punct" as const }, { text: "req", kind: "var" as const }, { text: ": ", kind: "punct" as const }, { text: "Request", kind: "type" as const }, { text: ")", kind: "punct" as const }, { text: " {", kind: "punct" as const }], state: "added" as const },
        { indent: 1, tokens: [{ text: "const ", kind: "keyword" as const }, { text: "bearer", kind: "var" as const }, { text: " = ", kind: "punct" as const }, { text: "req.headers", kind: "var" as const }, { text: ".", kind: "punct" as const }, { text: "get", kind: "fn" as const }, { text: "(\"authorization\")?.", kind: "string" as const }, { text: "slice", kind: "fn" as const }, { text: "(7);", kind: "punct" as const }], state: "added" as const },
        { indent: 1, tokens: [{ text: "if ", kind: "keyword" as const }, { text: "(!bearer) ", kind: "punct" as const }, { text: "throw new ", kind: "keyword" as const }, { text: "HttpError", kind: "fn" as const }, { text: "(401, ", kind: "punct" as const }, { text: "\"missing bearer\"", kind: "string" as const }, { text: ");", kind: "punct" as const }], state: "added" as const },
        { indent: 1, tokens: [{ text: "return ", kind: "keyword" as const }, { text: "store", kind: "var" as const }, { text: ".", kind: "punct" as const }, { text: "lookup", kind: "fn" as const }, { text: "(bearer);", kind: "punct" as const }], state: "added" as const },
        { tokens: [{ text: "}", kind: "punct" as const }] },
        { tokens: [{ text: "" }] },
        { tokens: [{ text: "// teammate's edits land here in real time", kind: "comment" as const }] },
        { tokens: [{ text: "" }] },
        { tokens: [{ text: "" }] },
      ]
    : [
        { tokens: [{ text: "import ", kind: "keyword" as const }, { text: "{ HttpError }", kind: "var" as const }, { text: " from ", kind: "keyword" as const }, { text: "\"../errors\"", kind: "string" as const }, { text: ";", kind: "punct" as const }] },
        { tokens: [{ text: "" }] },
        { tokens: [{ text: "export async function ", kind: "keyword" as const }, { text: "getSession", kind: "fn" as const }, { text: "(", kind: "punct" as const }, { text: "req", kind: "var" as const }, { text: ") {", kind: "punct" as const }] },
        { indent: 1, tokens: [{ text: "const ", kind: "keyword" as const }, { text: "cookie", kind: "var" as const }, { text: " = ", kind: "punct" as const }, { text: "req.headers.cookie", kind: "var" as const }, { text: "?.", kind: "punct" as const }, { text: "match", kind: "fn" as const }, { text: "(/sid=([^;]+)/);", kind: "string" as const }] },
        { indent: 1, tokens: [{ text: "if ", kind: "keyword" as const }, { text: "(cookie) ", kind: "punct" as const }, { text: "return ", kind: "keyword" as const }, { text: "resolveLegacy", kind: "fn" as const }, { text: "(cookie[1]);", kind: "punct" as const }] },
        { indent: 1, tokens: [{ text: "return ", kind: "keyword" as const }, { text: "store", kind: "var" as const }, { text: ".", kind: "punct" as const }, { text: "lookup", kind: "fn" as const }, { text: "(req);", kind: "punct" as const }] },
        { tokens: [{ text: "}", kind: "punct" as const }] },
        { tokens: [{ text: "" }] },
        { tokens: [{ text: "// waiting on teammate's edit…", kind: "comment" as const }] },
        { tokens: [{ text: "" }] },
        { tokens: [{ text: "" }] },
      ];

  const sentText =
    phase === "send" ||
    phase === "claudeStream" ||
    phase === "edit" ||
    phase === "syncPulse"
      ? PROMPT
      : "";
  const showClaudeReply =
    phase === "claudeStream" || phase === "edit" || phase === "syncPulse";

  return (
    <div className="relative">
      {/* Sync indicator that floats between the two windows during edit
          phases. Only renders on lg+ where the windows are actually
          side-by-side. */}
      {(phase === "edit" || phase === "syncPulse") && (
        <div
          aria-hidden
          className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 items-center gap-2 px-3 py-1.5 rounded-full bg-ink text-ivory shadow-lg animate-[demoPopIn_0.18s_cubic-bezier(0.32,0.72,0,1)_forwards]"
          style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M3 8l3-3M3 8l3 3M13 8l-3-3M13 8l-3 3" />
          </svg>
          <span>SYNCED</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
      {/* Left — VS Code (Dylan's machine) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.10em] text-ink-faded">
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: "#7d7d76" }} />
          <span>Dylan · VS Code</span>
        </div>
        <div className="relative">
          <VSCodeShell
            fileName="session.ts"
            folderName="T3 Tools"
            cursorLine={3}
            lines={codeLines}
            statusRight={
              <span
                className="ml-3 px-2 py-[1px] rounded-full flex items-center gap-1.5"
                style={{
                  background:
                    phase === "syncPulse"
                      ? "rgba(94,255,150,0.35)"
                      : "rgba(255,255,255,0.15)",
                  fontSize: 10.5,
                  fontWeight: 500,
                  transition: "background 200ms",
                }}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full"
                  style={{
                    background: "#5eff96",
                    boxShadow:
                      phase === "syncPulse"
                        ? "0 0 0 4px rgba(94,255,150,0.35)"
                        : "0 0 0 0 transparent",
                    transition: "box-shadow 200ms",
                  }}
                />
                Veronum ↔ Katya
              </span>
            }
          />

          {/* Teammate (Katya) presence cursor inside VS Code. Sits roughly
              over the line where Claude is editing. Pulses during edit
              phases to show the teammate's cursor in real time. */}
          <div
            aria-hidden
            className="absolute pointer-events-none transition-all duration-300"
            style={{
              top: editApplied ? "30%" : "33%",
              left: "37%",
              opacity:
                phase === "claudeStream" ||
                phase === "edit" ||
                phase === "syncPulse"
                  ? 1
                  : 0.55,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
              <path d="M2 2L13 7L7.5 8.5L6 13Z" fill="#cc785c" stroke="#fff" strokeWidth="1" />
            </svg>
            <span
              className="ml-1 inline-block px-1.5 py-[1px] rounded text-[9px] font-medium text-white whitespace-nowrap"
              style={{
                background: "#cc785c",
                fontFamily: "ui-sans-serif, system-ui",
                marginTop: -1,
              }}
            >
              Katya
            </span>
          </div>
        </div>
      </div>

      {/* Right — Veronum (Katya's machine) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.10em] text-ink-faded">
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: "#cc785c" }} />
          <span>Katya · Veronum</span>
        </div>
        <DemoShell
          cwd="T3 Tools"
          sessionTitle="Refactor session middleware"
          activeProjectName="T3 Tools"
          activeSessionTitle="Refactor session middleware"
        >
          <DemoHeader
            title="Refactor session middleware"
            shared
            turnCount={showClaudeReply ? 4 : sentText ? 3 : 2}
            cwd="~/T3 Tools"
            activeTab="chat"
            presence={[{ name: "Dylan", color: "#7d7d76" }]}
          />

          <div className="px-7 pb-2 overflow-hidden flex flex-col gap-4 h-[calc(100%-200px)]">
            <DemoMessage
              authorName="dylan"
              authorColor="#7d7d76"
              ts="2m ago"
              teammate
              sourceApp="VS Code"
              body="The auth refactor is breaking the build. Want to drop the cookie path?"
            />
            {sentText && (
              <DemoMessage
                authorName="dylan"
                authorColor="#7d7d76"
                ts="now"
                teammate
                sourceApp="VS Code"
                body={sentText}
                pulse={phase === "send"}
              />
            )}
            {showClaudeReply && (
              <DemoMessage
                isAi
                authorName="claude"
                ts="now"
                streaming={
                  phase === "claudeStream" &&
                  claudeStreamed.length < CLAUDE_REPLY.length
                }
                body={
                  <div className="space-y-2">
                    <div>
                      {claudeStreamed}
                      {phase === "claudeStream" &&
                        claudeStreamed.length < CLAUDE_REPLY.length && (
                          <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                        )}
                    </div>
                    {(phase === "edit" || phase === "syncPulse") && (
                      <div className="rounded-md border border-ink/[0.10] overflow-hidden text-[11px] font-mono mt-2">
                        <div className="flex items-center justify-between px-3 py-1 bg-ink/[0.03] border-b border-ink/[0.06]">
                          <span className="uppercase tracking-[0.06em] text-ink-faded">
                            apps/server/src/middleware/session.ts
                          </span>
                          <span className="text-ink-faded">+5 / -4</span>
                        </div>
                        <div className="px-3 py-1.5 leading-[1.5]">
                          <div style={{ color: "#a04141" }}>- export async function getSession(req) {"{"}</div>
                          <div style={{ color: "#1f8c46" }}>+ export async function resolveSession(req: Request) {"{"}</div>
                          <div style={{ color: "#1f8c46" }}>+ &nbsp;&nbsp;const bearer = req.headers.get(&quot;authorization&quot;)?.slice(7);</div>
                        </div>
                      </div>
                    )}
                  </div>
                }
              />
            )}
          </div>

          {/* Composer */}
          <div className="absolute bottom-0 left-0 right-0 px-7 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
            <DemoComposer
              value={
                phase === "promptType"
                  ? promptTyped
                  : phase === "send"
                    ? PROMPT
                    : ""
              }
              cursor={phase === "promptType"}
              sendPulse={phase === "send"}
              streaming={phase === "claudeStream"}
            />
          </div>
        </DemoShell>
      </div>
      </div>
    </div>
  );
}
