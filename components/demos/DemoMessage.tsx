/**
 * DemoMessage — exact recreation of MessageBubble.tsx from the Veronum
 * app's chat tab (renderer/src/components/MessageBubble.tsx).
 *
 * Layout matches the running app verbatim:
 *   - Top metadata row: 22px avatar + uppercase mono author name +
 *     optional "· teammate" / "· source-app" tags + relative timestamp
 *     pinned right
 *   - Body: prose text rendered at 13px, line-height 1.55. Optional
 *     image gallery (thumbs max 360px, click-to-expand in real app)
 *   - Optional pulse state: opacity 0.7 + 3-dot streaming indicator
 *     after the author tag, used while Claude is replying.
 */

import type { ReactNode } from "react";

type Props = {
  authorName: string;
  authorColor?: string;
  isAi?: boolean;
  /** "now", "2m ago", "yesterday" etc. — pre-formatted */
  ts?: string;
  /** Plain string OR rich children (markdown-ish formatting). */
  body: ReactNode;
  /** Optional remote-teammate label */
  teammate?: boolean;
  /** Optional source-app pill ("Claude Desktop", "Cursor", …) */
  sourceApp?: string;
  /** Streaming dots after author */
  streaming?: boolean;
  /** Lower opacity for pending state */
  pulse?: boolean;
  /** Inline image data URLs for image-paste demo */
  images?: string[];
};

export function DemoMessage({
  authorName,
  authorColor = "#1a1a18",
  isAi = false,
  ts,
  body,
  teammate,
  sourceApp,
  streaming,
  pulse,
  images,
}: Props) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-[7px] mb-1 text-[11px] font-mono text-ink-faded">
        {/* Avatar: 22px circle with initial OR the V mark for AI */}
        <span
          className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            background: isAi ? "#1a1a18" : authorColor,
            color: "#ffffff",
          }}
        >
          {isAi ? (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2L13 13H10.5L9.7 11H6.3L5.5 13H3L8 2Z" />
            </svg>
          ) : (
            authorName.charAt(0).toUpperCase()
          )}
        </span>
        <span
          className="font-medium uppercase tracking-[0.04em]"
          style={{ color: "#3d3d3a" }}
        >
          {authorName}
        </span>
        {streaming && (
          <span className="inline-flex items-center gap-[3px] ml-[2px]">
            <span
              className="w-[3px] h-[3px] rounded-full bg-ink-faded animate-[demoPulseDot_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="w-[3px] h-[3px] rounded-full bg-ink-faded animate-[demoPulseDot_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="w-[3px] h-[3px] rounded-full bg-ink-faded animate-[demoPulseDot_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: "0.3s" }}
            />
          </span>
        )}
        {teammate && <span>· teammate</span>}
        {sourceApp && <span>· {sourceApp}</span>}
        {ts && <span className="ml-auto cursor-default">{ts}</span>}
      </div>
      <div
        className="text-[13px] text-ink leading-[1.55] break-words"
        style={pulse ? { opacity: 0.7 } : undefined}
      >
        {body}
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {images.map((src, i) => (
              <span
                key={i}
                className="block border border-ink/[0.10] rounded-md overflow-hidden bg-ivory"
                style={{ maxWidth: 280 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="block max-w-full h-auto" />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
