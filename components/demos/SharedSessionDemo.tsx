"use client";

/**
 * SharedSessionDemo — auto-playing recreation of two teammates working
 * in the same Veronum session. Two DemoShells render side-by-side
 * (host on the left, teammate on the right) with synced state so it
 * reads as a real-time multiplayer scene.
 *
 * Visual references (verified against veronum-overlay@v0.1.47):
 *   - Share button states (App.tsx 985-1013)  — "Share" → "● Shared"
 *   - MemberPresence avatars (App.tsx 947-952)
 *   - TeamChatPanel slide-in (right side, 340 px wide)
 *   - "mirroring · bound to <cwd>" status line (App.tsx 1077-1090)
 *
 * Phase machine:
 *   1. idle           — host has session, teammate empty (1.4 s)
 *   2. share          — host clicks Share → invite link generated (0.9 s)
 *   3. teammateJoins  — teammate's window animates the joining state
 *                       (presence avatar pops in on host) (1.6 s)
 *   4. hostTypes      — host types prompt; teammate sees presence cursor (~3 s)
 *   5. send           — host hits Send; user bubble appears on BOTH (0.5 s)
 *   6. claudeStreams  — Claude reply streams; both see it concurrently (~3 s)
 *   7. teamChat       — teammate opens TeamChatPanel and posts a question
 *                       — host sees a notification (1.2 s + ~3 s typing)
 *   8. hostReplies    — host's TeamChatPanel slides in showing both messages (~2 s)
 *   9. reset          — fade everything (1 s) → loop
 */

import { useEffect, useState } from "react";
import { DemoShell } from "./DemoShell";
import { DemoHeader } from "./DemoHeader";
import { DemoComposer } from "./DemoComposer";
import { DemoMessage } from "./DemoMessage";

type Phase =
  | "idle"
  | "share"
  | "teammateJoins"
  | "hostTypes"
  | "send"
  | "claudeStreams"
  | "teamChat"
  | "hostReplies"
  | "reset";

const HOST_PROMPT = "Refactor the auth middleware to drop the legacy session cookie path.";
const KATYA_CHAT = "Heads up — once you've got the new middleware, the staging Stripe webhook needs the new session header.";
const DYLAN_CHAT_REPLY = "Got it. I'll add the header pass-through to the deploy script.";
const CLAUDE_REPLY =
  "I'll start by reading apps/server/src/middleware/session.ts to map the legacy cookie path…";

export function SharedSessionDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [hostTyping, setHostTyping] = useState("");
  const [katyaChatTyping, setKatyaChatTyping] = useState("");
  const [dylanChatTyping, setDylanChatTyping] = useState("");
  const [claudeStreamed, setClaudeStreamed] = useState("");

  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("share"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "share") {
      const t = setTimeout(() => setPhase("teammateJoins"), 900);
      return () => clearTimeout(t);
    }
    if (phase === "teammateJoins") {
      const t = setTimeout(() => {
        setHostTyping("");
        setPhase("hostTypes");
      }, 1600);
      return () => clearTimeout(t);
    }
    if (phase === "hostTypes") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= HOST_PROMPT.length) {
          setHostTyping(HOST_PROMPT.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setPhase("send");
        }
      }, 28);
      return () => clearInterval(id);
    }
    if (phase === "send") {
      const t = setTimeout(() => {
        setClaudeStreamed("");
        setPhase("claudeStreams");
      }, 500);
      return () => clearTimeout(t);
    }
    if (phase === "claudeStreams") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= CLAUDE_REPLY.length) {
          setClaudeStreamed(CLAUDE_REPLY.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setKatyaChatTyping("");
          setTimeout(() => setPhase("teamChat"), 600);
        }
      }, 22);
      return () => clearInterval(id);
    }
    if (phase === "teamChat") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= KATYA_CHAT.length) {
          setKatyaChatTyping(KATYA_CHAT.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setDylanChatTyping("");
          setPhase("hostReplies");
        }
      }, 22);
      return () => clearInterval(id);
    }
    if (phase === "hostReplies") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= DYLAN_CHAT_REPLY.length) {
          setDylanChatTyping(DYLAN_CHAT_REPLY.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setTimeout(() => setPhase("reset"), 1500);
        }
      }, 26);
      return () => clearInterval(id);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setHostTyping("");
        setKatyaChatTyping("");
        setDylanChatTyping("");
        setClaudeStreamed("");
        setPhase("idle");
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Derived UI state
  const hostShared =
    phase !== "idle" && phase !== "reset"; // shared once host clicks Share
  const teammateInRoom =
    phase === "teammateJoins" ||
    phase === "hostTypes" ||
    phase === "send" ||
    phase === "claudeStreams" ||
    phase === "teamChat" ||
    phase === "hostReplies";
  const showSentBubble =
    phase === "send" ||
    phase === "claudeStreams" ||
    phase === "teamChat" ||
    phase === "hostReplies";
  const showStreamingClaude =
    phase === "claudeStreams" ||
    phase === "teamChat" ||
    phase === "hostReplies";
  const teamChatOpen =
    phase === "teamChat" || phase === "hostReplies";

  // Presence avatars in each window
  const hostPresence = teammateInRoom
    ? [{ name: "Katya", color: "#cc785c" }]
    : [];
  const teammatePresence = [{ name: "Dylan", color: "#7d7d76" }];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
      {/* Host window (Dylan) */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em] text-ink-faded">
          <span
            aria-hidden
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: "#7d7d76" }}
          />
          <span>Dylan&apos;s Mac · host</span>
        </div>
        <DemoShell
          cwd="T3 Tools"
          sessionTitle="Refactor auth middleware"
          activeProjectName="T3 Tools"
          activeSessionTitle="Refactor auth middleware"
        >
          <DemoHeader
            title="Refactor auth middleware"
            shared={hostShared}
            turnCount={
              showSentBubble
                ? showStreamingClaude
                  ? 4
                  : 3
                : 2
            }
            cwd="~/T3 Tools"
            activeTab="chat"
            pulse={
              phase === "share"
                ? "share"
                : phase === "hostReplies"
                  ? "chat"
                  : null
            }
            presence={hostPresence}
          />
          <SharedConversation
            window="host"
            sentText={showSentBubble ? HOST_PROMPT : ""}
            sentPulse={phase === "send"}
            claudeStreamed={showStreamingClaude ? claudeStreamed : ""}
            streamingDots={phase === "claudeStreams"}
          />
          <div className="absolute bottom-0 left-0 right-0 px-7 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
            <DemoComposer
              value={phase === "hostTypes" ? hostTyping : ""}
              cursor={phase === "hostTypes"}
              sendPulse={phase === "send"}
              streaming={
                phase === "claudeStreams" || phase === "teamChat"
              }
            />
          </div>

          {/* Team chat slide-in (right side, 340 px). Open from
              "teamChat" phase onwards on the host window so Dylan
              sees Katya's incoming message. */}
          {teamChatOpen && (
            <TeamChatPanelOverlay
              ownerLabel="you"
              messages={[
                {
                  who: "Katya",
                  whoColor: "#cc785c",
                  body: katyaChatTyping,
                  typing:
                    phase === "teamChat" &&
                    katyaChatTyping.length < KATYA_CHAT.length,
                  ts: "now",
                },
                ...(phase === "hostReplies"
                  ? [
                      {
                        who: "Dylan",
                        whoColor: "#7d7d76",
                        body: dylanChatTyping,
                        typing:
                          dylanChatTyping.length < DYLAN_CHAT_REPLY.length,
                        ts: "now",
                      },
                    ]
                  : []),
              ]}
              composerValue={
                phase === "hostReplies" ? dylanChatTyping : ""
              }
              composerCursor={phase === "hostReplies"}
            />
          )}
        </DemoShell>
      </div>

      {/* Teammate window (Katya) */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em] text-ink-faded">
          <span
            aria-hidden
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: "#cc785c" }}
          />
          <span>Katya&apos;s Mac · joined</span>
        </div>
        <DemoShell
          cwd="T3 Tools"
          sessionTitle="Refactor auth middleware"
          activeProjectName="T3 Tools"
          activeSessionTitle="Refactor auth middleware"
        >
          {teammateInRoom ? (
            <>
              <DemoHeader
                title="Refactor auth middleware"
                shared
                turnCount={
                  showSentBubble
                    ? showStreamingClaude
                      ? 4
                      : 3
                    : 2
                }
                cwd="~/T3 Tools"
                activeTab="chat"
                presence={teammatePresence}
              />
              <SharedConversation
                window="teammate"
                sentText={showSentBubble ? HOST_PROMPT : ""}
                sentPulse={false}
                claudeStreamed={showStreamingClaude ? claudeStreamed : ""}
                streamingDots={phase === "claudeStreams"}
              />
              <div className="absolute bottom-0 left-0 right-0 px-7 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
                <DemoComposer
                  value=""
                  cursor={false}
                  streaming={
                    phase === "claudeStreams" || phase === "teamChat"
                  }
                />
              </div>

              {/* Teammate's TeamChat panel — opens during teamChat
                  phase as Katya types into the panel. */}
              {teamChatOpen && (
                <TeamChatPanelOverlay
                  ownerLabel="you"
                  composerValue={
                    phase === "teamChat" ? katyaChatTyping : ""
                  }
                  composerCursor={phase === "teamChat"}
                  messages={[
                    {
                      who: "Katya",
                      whoColor: "#cc785c",
                      body: katyaChatTyping,
                      typing:
                        phase === "teamChat" &&
                        katyaChatTyping.length < KATYA_CHAT.length,
                      ts: "now",
                    },
                    ...(phase === "hostReplies"
                      ? [
                          {
                            who: "Dylan",
                            whoColor: "#7d7d76",
                            body: dylanChatTyping,
                            typing:
                              dylanChatTyping.length <
                              DYLAN_CHAT_REPLY.length,
                            ts: "now",
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            </>
          ) : (
            <JoinPlaceholder phase={phase} />
          )}
        </DemoShell>
      </div>
    </div>
  );
}

/**
 * Conversation body shared between both windows. The user's prompt
 * and Claude's reply mirror across windows in real time — that's
 * the differentiator the demo is selling.
 */
function SharedConversation({
  sentText,
  sentPulse,
  claudeStreamed,
  streamingDots,
}: {
  window: "host" | "teammate";
  sentText: string;
  sentPulse: boolean;
  claudeStreamed: string;
  streamingDots: boolean;
}) {
  return (
    <div className="px-7 pb-2 overflow-hidden flex flex-col gap-4 h-[calc(100%-200px)]">
      <DemoMessage
        authorName="dylan"
        authorColor="#7d7d76"
        ts="2m ago"
        body="Need to drop the legacy cookie path before next deploy."
      />
      <DemoMessage
        isAi
        authorName="claude"
        ts="1m ago"
        body="Sure. Want me to grep for getSessionFromCookie callers first or jump to the rewrite?"
      />
      {sentText && (
        <DemoMessage
          authorName="dylan"
          authorColor="#7d7d76"
          ts="now"
          pulse={sentPulse}
          body={sentText}
        />
      )}
      {claudeStreamed && (
        <DemoMessage
          isAi
          authorName="claude"
          ts="now"
          streaming={streamingDots}
          body={
            <>
              {claudeStreamed}
              {streamingDots && (
                <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
              )}
            </>
          }
        />
      )}
    </div>
  );
}

/** Empty state on the teammate window before they accept the invite. */
function JoinPlaceholder({ phase }: { phase: Phase }) {
  const incoming = phase === "share";
  return (
    <div className="absolute inset-0 flex items-center justify-center px-8">
      <div
        className="text-center max-w-[280px]"
        style={{ color: "#5e5d59" }}
      >
        <div className="font-serif text-[20px] font-medium text-ink mb-2 leading-[1.15]">
          {incoming ? "Incoming invite" : "Pick a session"}
        </div>
        <p className="text-[12.5px] leading-[1.55]">
          {incoming
            ? "Dylan just shared 'Refactor auth middleware'. Click to join the live session."
            : "Choose a Claude Code project from the left rail and click any of its sessions to open the conversation, activity feed, and shared file tree."}
        </p>
        {incoming && (
          <button
            className="mt-3 inline-flex items-center gap-1.5 bg-ink text-white px-3 py-1.5 rounded-full text-[12px] font-medium animate-[demoPopIn_0.18s_cubic-bezier(0.32,0.72,0,1)_forwards]"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6.5 9.5a3 3 0 0 0 4.243 0l2.121-2.121a3 3 0 1 0-4.243-4.243L7.55 4.207" />
              <path d="M9.5 6.5a3 3 0 0 0-4.243 0L3.136 8.62a3 3 0 1 0 4.243 4.243l1.071-1.072" />
            </svg>
            Join shared session
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * TeamChatPanel slide-in — recreates renderer/src/components/TeamChatPanel.tsx
 * Sits on the right edge of the window, 340 px wide.
 */
function TeamChatPanelOverlay({
  messages,
  composerValue,
  composerCursor,
}: {
  ownerLabel: string;
  messages: Array<{
    who: string;
    whoColor: string;
    body: string;
    typing: boolean;
    ts: string;
  }>;
  composerValue: string;
  composerCursor: boolean;
}) {
  return (
    <div
      className="absolute z-30 bg-white border-l border-ink/[0.10] flex flex-col animate-[demoSlideInRight_0.22s_cubic-bezier(0.32,0.72,0,1)_forwards]"
      style={{
        top: 32,
        right: 0,
        bottom: 0,
        width: 340,
        boxShadow: "-12px 0 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink/[0.10]">
        <span
          className="font-serif text-[15px] font-medium text-ink"
          style={{ letterSpacing: "-0.018em" }}
        >
          Team chat
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-faded">
          {messages.filter((m) => m.body.length > 0).length}
        </span>
        <button
          aria-label="Close team chat"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className="flex gap-2">
            <span
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
              style={{ background: m.whoColor }}
            >
              {m.who.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[11.5px] font-medium text-ink">
                  {m.who}
                </span>
                <span className="font-mono text-[10px] text-ink-faded">
                  {m.ts}
                </span>
              </div>
              <div className="text-[13px] text-ink leading-[1.5]">
                {m.body || (
                  <span className="text-ink-faded">…</span>
                )}
                {m.typing && (
                  <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-ink/[0.10] p-2.5">
        <div className="flex items-end gap-1.5">
          <div
            className="flex-1 bg-ivory border border-ink/[0.10] rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink min-h-[32px] leading-[1.5]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {composerValue || (
              <span className="text-ink-faded">
                Message the team — Enter to send
              </span>
            )}
            {composerCursor && composerValue && (
              <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
            )}
          </div>
          <button
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              background: composerValue ? "#1a1a18" : "rgba(20,20,19,0.15)",
              color: composerValue ? "#ffffff" : "rgba(20,20,19,0.45)",
            }}
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              width="14"
              height="14"
            >
              <path d="M8 3L13 8H9.5V13H6.5V8H3L8 3Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
