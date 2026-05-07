/**
 * DemoShell — exact recreation of the Veronum desktop app's chrome.
 *
 * Visual references (verified 1:1 against veronum-overlay@v0.1.47):
 *   - renderer/src/styles/t3-tokens.css   (.dframe-root tokens)
 *   - renderer/src/styles/t3-shell.css    (.dframe-sidebar, .dframe-content)
 *   - renderer/src/layout/ProjectsSidebar.tsx
 *   - renderer/src/layout/MainPane.tsx
 *   - main.js BrowserWindow titleBarStyle: "hiddenInset" + trafficLightPosition
 *
 * Layout, in CSS-pixel terms (matches the running app exactly):
 *   - 32 px chrome stripe at top with three traffic-light dots at x=14,
 *     y=16 (center). Drag region starts at left:80 so the dots stay
 *     hit-testable.
 *   - Sidebar floats at top:40 (32 chrome + 8 inset), left:8, bottom:8,
 *     width:320, with the dframe-sidebar card shadow.
 *   - Main content fills the rest, padded 16 left/right of the
 *     sidebar (16 + 320 + 8 = 344px content offset).
 *
 * All children render inside the "main" slot. The sidebar is fixed (a
 * single project list with one active session) so demos read like the
 * real app without each one rebuilding the navigation.
 */

import type { ReactNode } from "react";
import { DemoSidebar } from "./DemoSidebar";

type Props = {
  /** What the conversation header shows in the bound-to status line */
  cwd: string;
  /** Shown in the top-bar session title */
  sessionTitle: string;
  /** Sidebar project + session highlighting */
  activeProjectName: string;
  activeSessionTitle: string;
  /** Chat tab content + composer + tabs go here */
  children: ReactNode;
  /** Optional dark badge under the chrome stripe — for "Pro tier" etc. */
  badge?: ReactNode;
  /** Optional override for the cream-card border color */
  className?: string;
};

export function DemoShell({
  cwd,
  sessionTitle,
  activeProjectName,
  activeSessionTitle,
  children,
  badge,
  className,
}: Props) {
  return (
    <div
      className={`relative w-full bg-white rounded-2xl border border-ink/[0.10] overflow-hidden shadow-[0_24px_56px_-12px_rgba(0,0,0,0.10),0_4px_12px_-6px_rgba(0,0,0,0.06)] ${className || ""}`}
      style={{
        // Aspect-ratio holds the demo at app-window proportions
        // (~1100×820 — Veronum's default BrowserWindow size).
        aspectRatio: "1100 / 820",
      }}
    >
      {/* Chrome stripe — 32px traffic-light region. */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center"
        style={{ height: 32 }}
      >
        {/* Traffic lights at x=14, y=16 (Veronum trafficLightPosition). */}
        <div className="flex items-center gap-[8px]" style={{ paddingLeft: 14 }}>
          <span
            aria-hidden
            className="w-[12px] h-[12px] rounded-full bg-[#ff5f57] border border-black/10"
          />
          <span
            aria-hidden
            className="w-[12px] h-[12px] rounded-full bg-[#febc2e] border border-black/10"
          />
          <span
            aria-hidden
            className="w-[12px] h-[12px] rounded-full bg-[#28c840] border border-black/10"
          />
        </div>
        {badge && (
          <div className="ml-auto pr-3 flex items-center">{badge}</div>
        )}
      </div>

      {/* Sidebar — floats at top:40 (32 chrome + 8), left:8, bottom:8. */}
      <DemoSidebar
        activeProjectName={activeProjectName}
        activeSessionTitle={activeSessionTitle}
      />

      {/* Main content — left padding 344 (8 inset + 320 sidebar + 16 gap),
          top padding 32 chrome + ~8 breathing room. */}
      <main
        className="absolute"
        style={{
          top: 32,
          left: 344,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="px-7 pt-6 pb-2">
          {/* Top-row header — breadcrumb + session title (matches
              ConversationScreen renders in App.tsx). */}
          <div className="flex items-center gap-2 mb-1.5 text-[13px] text-ink-faded">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="M2 4.5C2 3.948 2.448 3.5 3 3.5h3l1.5 1.5H13c.552 0 1 .448 1 1V12c0 .552-.448 1-1 1H3c-.552 0-1-.448-1-1V4.5Z" />
            </svg>
            <span className="font-medium text-ink">{cwd}</span>
            <span>/</span>
            <span className="truncate">{sessionTitle}</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 relative overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
