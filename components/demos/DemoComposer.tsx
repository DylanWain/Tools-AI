/**
 * DemoComposer — exact recreation of Composer.tsx in the Veronum app.
 *
 * Visual reference: renderer/src/components/Composer.tsx +
 * `.code-prompt-*` class system (T3 PromptInput port).
 *
 * Structure:
 *   .code-prompt-wrap  — outer 22px-radius transparent halo wrapper
 *     .code-prompt     — inner 20px-radius card with 1px border
 *       textarea (.code-prompt-input) — placeholder + typed text
 *       .code-prompt-toolbar
 *         .code-prompt-left  — paperclip, multi-agent (3-figures), accept-edits
 *         .code-prompt-right — model picker, send button
 *
 * The agent button shows the small "lock" badge when tier !== "pro" (Composer.tsx
 * lines 384-401). The send button is .code-send-btn — 28×28 dark fill.
 */

import type { ReactNode } from "react";

type Props = {
  /** Text currently typed into the composer */
  value: string;
  /** Cursor visibility for typing animation */
  cursor?: boolean;
  /** Pulse the multi-agent button (used when AgentSlots is opening) */
  agentPulse?: boolean;
  /** Pulse the send button */
  sendPulse?: boolean;
  /** Render the streaming/Stop variant of the send button */
  streaming?: boolean;
  /** Optional attachment chip(s) rendered above the textarea */
  attachments?: ReactNode;
  /** Show "/files" / "/activity" slash menu hover (for image demo) */
  dragOver?: boolean;
};

export function DemoComposer({
  value,
  cursor = true,
  agentPulse,
  sendPulse,
  streaming,
  attachments,
  dragOver,
}: Props) {
  return (
    <div className="relative pointer-events-auto">
      {/* code-prompt-wrap — 22px radius outer halo. Becomes ringed when
          dragOver is true (drop-target highlight). */}
      <div
        className="rounded-[22px] p-[1px] transition-colors duration-200"
        style={{
          background: dragOver
            ? "rgba(217,119,87,0.20)"
            : "transparent",
        }}
      >
        {/* code-prompt — inner card, 20px radius, white bg, 1px border. */}
        <div
          className="bg-white rounded-[20px] border transition-colors duration-200"
          style={{
            borderColor: dragOver ? "#d97757" : "rgba(20,20,19,0.10)",
            boxShadow:
              "0 1px 0 0 rgba(20,20,19,0.02), 0 6px 14px -8px rgba(20,20,19,0.06)",
          }}
        >
          {/* Optional attachment chip strip */}
          {attachments && (
            <div
              className="flex flex-wrap gap-1.5"
              style={{ padding: "8px 10px 0" }}
            >
              {attachments}
            </div>
          )}

          {/* Textarea — code-prompt-input. Real one is a <textarea>; we
              render a fake div to simulate typing. */}
          <div
            className="px-[14px] pt-[12px] pb-[6px] min-h-[38px] text-[14px] text-ink leading-[1.5]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {value ? (
              <>
                {value}
                {cursor && (
                  <span className="inline-block w-[1.5px] h-[1em] bg-ink ml-[1px] align-middle animate-[demoBlink_1s_steps(2)_infinite]" />
                )}
              </>
            ) : (
              <span className="text-ink-faded">
                Reply to Claude — Enter to send, Shift+Enter for newline.
                Type / for commands.
              </span>
            )}
          </div>

          {/* code-prompt-toolbar */}
          <div className="flex items-center px-[10px] pt-[2px] pb-[8px] gap-[2px]">
            {/* code-prompt-left */}
            <ToolbarButton title="Attach a file">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.5 4.5L7.05 8.95a2.121 2.121 0 1 0 3 3l4.45-4.45a4.243 4.243 0 1 0-6-6L4 6" />
              </svg>
            </ToolbarButton>

            {/* Multi-agent button — pulses when AgentSlots is opening */}
            <ToolbarButton
              title="Dispatch multiple agents in parallel"
              pulse={agentPulse}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="5" cy="5.5" r="1.6" />
                <path d="M2 12.5c0-1.5 1.4-2.7 3-2.7s3 1.2 3 2.7" />
                <circle cx="11" cy="5.5" r="1.6" />
                <path d="M8.4 12.5c0-1.5 1.4-2.7 2.6-2.7s2.6 1.2 2.6 2.7" />
              </svg>
            </ToolbarButton>

            <ToolbarButton title="Accept edits mode">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8l3 3 7-7" />
              </svg>
            </ToolbarButton>

            {/* code-prompt-right */}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                className="px-2 h-[22px] rounded-md hover:bg-ink/[0.04] flex items-center gap-1 text-[11.5px] text-ink-faded font-mono"
                disabled
              >
                <span>Opus 4.7</span>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M3 5l3 3 3-3z" />
                </svg>
              </button>
              {/* Send button — code-send-btn 28×28 dark fill when content
                  present; Stop variant during streaming. */}
              <button
                aria-label={streaming ? "Stop reply" : "Send"}
                className={`flex items-center justify-center rounded-full transition-all duration-200 ${
                  sendPulse ? "scale-[1.06]" : ""
                }`}
                style={{
                  width: 28,
                  height: 28,
                  background: streaming
                    ? "transparent"
                    : value || sendPulse
                      ? "#1a1a18"
                      : "rgba(20,20,19,0.15)",
                  color: streaming
                    ? "#3d3d3a"
                    : value || sendPulse
                      ? "#ffffff"
                      : "rgba(20,20,19,0.45)",
                  border: streaming ? "1.5px solid #3d3d3a" : "none",
                  boxShadow: sendPulse
                    ? "0 0 0 4px rgba(20,20,19,0.10)"
                    : undefined,
                }}
              >
                {streaming ? (
                  <span
                    className="block"
                    style={{
                      width: 8,
                      height: 8,
                      background: "#3d3d3a",
                      borderRadius: 1,
                    }}
                  />
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M8 3L13 8H9.5V13H6.5V8H3L8 3Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  title,
  pulse,
}: {
  children: ReactNode;
  title: string;
  pulse?: boolean;
}) {
  return (
    <button
      title={title}
      className={`flex items-center justify-center rounded-md transition-all ${
        pulse
          ? "bg-ink/[0.06] text-ink"
          : "text-ink-faded hover:bg-ink/[0.04] hover:text-ink/80"
      }`}
      style={{
        width: 22,
        height: 22,
        boxShadow: pulse ? "0 0 0 3px rgba(20,20,19,0.06)" : undefined,
      }}
    >
      <span className="block w-[14px] h-[14px]">{children}</span>
    </button>
  );
}
