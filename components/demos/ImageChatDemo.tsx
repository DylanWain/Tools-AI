"use client";

/**
 * ImageChatDemo — auto-playing recreation of the new image-paste flow
 * in the Veronum composer (v0.1.47). Shows a screenshot being pasted,
 * the auto-resize chip showing in the composer, the message sending
 * with the image inline, and Claude responding with content that
 * references what's in the image.
 *
 * Visual references (verified against veronum-overlay@v0.1.47):
 *   - Composer paste handler (Composer.tsx 264-275)
 *   - resizeImageForClaude (Composer.tsx, 2000 px max edge JPEG @0.92)
 *   - MessageBubble image gallery (MessageBubble.tsx new MessageImages
 *     component — thumbs 360 px max, click-to-expand)
 *   - main.js sendInSession stream-json input path (1218-1290)
 *
 * Phase machine:
 *   1. idle           — chat thread visible, composer empty (1.4 s)
 *   2. paste          — image chip animates into the composer (0.5 s)
 *   3. resize         — chip shows "Resizing… → 2000 px" beat (1.4 s)
 *   4. typeText       — short prompt types in (~2 s)
 *   5. send           — Send pulses (0.5 s)
 *   6. userBubble     — user bubble lands with image attached (0.7 s)
 *   7. claudeStreams  — Claude reply streams referencing the image (~3 s)
 *   8. reset          — fade everything (1 s) → loop
 */

import { useEffect, useState } from "react";
import { DemoShell } from "./DemoShell";
import { DemoHeader } from "./DemoHeader";
import { DemoComposer } from "./DemoComposer";
import { DemoMessage } from "./DemoMessage";

type Phase =
  | "idle"
  | "paste"
  | "resize"
  | "typeText"
  | "send"
  | "userBubble"
  | "claudeStreams"
  | "reset";

const USER_PROMPT = "What's wrong with this build error?";
const CLAUDE_REPLY =
  "That stack trace is showing a TypeScript error in apps/server/src/middleware/session.ts at line 47 — `Property 'cookie' does not exist on type 'Headers'`. It's from the rewrite I just made — I'll switch to req.headers.get('cookie') so it works with the Fetch-style Headers wrapper.";

/**
 * Inline SVG that stands in for the pasted screenshot. Drawn to look
 * like a terminal showing a TypeScript build error (matches the
 * Claude reply that references a TS error). Encoded as data URL so
 * MessageBubble renders it through the same <img src="data:…"> path
 * as a real image content block.
 */
const SCREENSHOT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380" width="640" height="380">
  <rect width="640" height="380" fill="#1a1a18" rx="10"/>
  <g transform="translate(0,0)">
    <rect width="640" height="32" fill="#0f0e0d"/>
    <circle cx="16" cy="16" r="5" fill="#ff5f57"/>
    <circle cx="34" cy="16" r="5" fill="#febc2e"/>
    <circle cx="52" cy="16" r="5" fill="#28c840"/>
    <text x="320" y="20" font-family="ui-monospace, monospace" font-size="11" fill="#87867f" text-anchor="middle">apps/server — bun build</text>
  </g>
  <g font-family="ui-monospace, JetBrains Mono, monospace" font-size="13" fill="#e8e6dc">
    <text x="20" y="68">$ bun run build</text>
    <text x="20" y="92" fill="#87867f">[~] type-checking apps/server</text>
    <text x="20" y="116" fill="#cc785c" font-weight="600">error TS2339:</text>
    <text x="116" y="116" fill="#e8e6dc">Property 'cookie' does not exist on type 'Headers'.</text>
    <text x="20" y="140" fill="#87867f">  apps/server/src/middleware/session.ts:47:36</text>
    <g fill="#87867f">
      <text x="20" y="172">  45 |   export async function resolveSession(req) {</text>
      <text x="20" y="192">  46 |     const bearer = req.headers.authorization?.slice(7);</text>
    </g>
    <g fill="#fff">
      <text x="20" y="212">→ 47 |     const cookie = req.headers.cookie;</text>
    </g>
    <g fill="#cc785c">
      <text x="20" y="232">                                ~~~~~~</text>
    </g>
    <g fill="#87867f">
      <text x="20" y="252">  48 |     if (cookie) return resolveLegacy(cookie);</text>
      <text x="20" y="272">  49 |     return store.lookup(bearer);</text>
      <text x="20" y="292">  50 |   }</text>
    </g>
    <text x="20" y="324" fill="#cc785c">1 error · 0 warnings</text>
    <text x="20" y="346" fill="#87867f">$ █</text>
  </g>
</svg>
`.trim();

const SCREENSHOT_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SCREENSHOT_SVG)}`;

export function ImageChatDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [textTyped, setTextTyped] = useState("");
  const [claudeStreamed, setClaudeStreamed] = useState("");

  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("paste"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "paste") {
      const t = setTimeout(() => setPhase("resize"), 500);
      return () => clearTimeout(t);
    }
    if (phase === "resize") {
      const t = setTimeout(() => {
        setTextTyped("");
        setPhase("typeText");
      }, 1400);
      return () => clearTimeout(t);
    }
    if (phase === "typeText") {
      let i = 0;
      const id = setInterval(() => {
        if (i <= USER_PROMPT.length) {
          setTextTyped(USER_PROMPT.slice(0, i));
          i++;
        } else {
          clearInterval(id);
          setPhase("send");
        }
      }, 30);
      return () => clearInterval(id);
    }
    if (phase === "send") {
      const t = setTimeout(() => setPhase("userBubble"), 500);
      return () => clearTimeout(t);
    }
    if (phase === "userBubble") {
      const t = setTimeout(() => {
        setClaudeStreamed("");
        setPhase("claudeStreams");
      }, 700);
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
          setTimeout(() => setPhase("reset"), 2000);
        }
      }, 14);
      return () => clearInterval(id);
    }
    if (phase === "reset") {
      const t = setTimeout(() => {
        setTextTyped("");
        setClaudeStreamed("");
        setPhase("idle");
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const showSentBubble =
    phase === "userBubble" ||
    phase === "claudeStreams" ||
    phase === "reset";
  const showClaudeReply =
    phase === "claudeStreams" || phase === "reset";
  const chipVisible =
    phase === "paste" ||
    phase === "resize" ||
    phase === "typeText" ||
    phase === "send";

  return (
    <DemoShell
      cwd="T3 Tools"
      sessionTitle="Refactor session middleware"
      activeProjectName="T3 Tools"
      activeSessionTitle="Refactor session middleware"
    >
      <DemoHeader
        title="Refactor session middleware"
        shared
        turnCount={showClaudeReply ? 5 : showSentBubble ? 4 : 3}
        cwd="~/T3 Tools"
        activeTab="chat"
      />

      <div className="px-7 pb-2 overflow-hidden flex flex-col gap-4 h-[calc(100%-220px)]">
        <DemoMessage
          authorName="dylan"
          authorColor="#7d7d76"
          ts="2m ago"
          body="The auth refactor broke the build — let me show you the error."
        />
        <DemoMessage
          isAi
          authorName="claude"
          ts="1m ago"
          body="Paste a screenshot or drop the file directly into the composer — I'll read the error and patch it."
        />
        {showSentBubble && (
          <DemoMessage
            authorName="dylan"
            authorColor="#7d7d76"
            ts="now"
            body={USER_PROMPT}
            images={[SCREENSHOT_DATA_URL]}
            pulse={phase === "userBubble"}
          />
        )}
        {showClaudeReply && (
          <DemoMessage
            isAi
            authorName="claude"
            ts="now"
            streaming={phase === "claudeStreams" && claudeStreamed.length < CLAUDE_REPLY.length}
            body={
              <>
                {claudeStreamed}
                {phase === "claudeStreams" &&
                  claudeStreamed.length < CLAUDE_REPLY.length && (
                    <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                  )}
              </>
            }
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-7 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
        <DemoComposer
          value={
            phase === "typeText" ||
            phase === "send" ||
            phase === "paste" ||
            phase === "resize"
              ? textTyped
              : ""
          }
          cursor={phase === "typeText"}
          sendPulse={phase === "send"}
          attachments={
            chipVisible && (
              <ImageAttachmentChip
                phase={phase}
                src={SCREENSHOT_DATA_URL}
              />
            )
          }
          dragOver={phase === "paste"}
        />
      </div>
    </DemoShell>
  );
}

/**
 * Composer attachment chip — recreates AttachmentChip from Composer.tsx
 * for image attachments (line 456-470 in real source).
 */
function ImageAttachmentChip({
  phase,
  src,
}: {
  phase: Phase;
  src: string;
}) {
  const status =
    phase === "paste"
      ? "Paste detected"
      : phase === "resize"
        ? "Resizing → 2000 px"
        : "Ready · 1.2 MB";
  return (
    <div
      className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg border border-ink/[0.10] bg-ivory animate-[demoPopIn_0.18s_cubic-bezier(0.32,0.72,0,1)_forwards]"
      style={{ maxWidth: 240 }}
    >
      <span className="block w-[28px] h-[28px] rounded-md overflow-hidden bg-ink/5 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full h-full object-cover" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] text-ink leading-tight truncate font-medium">
          screenshot.png
        </div>
        <div className="text-[10.5px] text-ink-faded font-mono leading-tight truncate">
          {status}
        </div>
      </div>
      <button
        aria-label="Remove attachment"
        className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-ink-faded hover:bg-ink/[0.06] flex-shrink-0"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          width={9}
          height={9}
        >
          <path d="M4 4l8 8M12 4L4 12" />
        </svg>
      </button>
    </div>
  );
}
