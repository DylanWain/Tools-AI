/**
 * VSCodeShell — recreation of VS Code's chrome at the level of detail
 * needed for a marketing demo. Dimensions verified against the real
 * VS Code source (vscode-main/src/vs/workbench/browser/parts/*).
 *
 * Verified specs:
 *   - Title bar:    36 px tall (Linux/Mac default), #181818 background
 *   - Activity bar: 48 px wide (--activity-bar-width: 48px)
 *   - Activity btn: 35 px tall (--activity-bar-icon-size area)
 *   - Tab strip:    35 px tall (--editor-group-tab-height)
 *   - Status bar:   22 px tall, 12 px font, padding 0 5px, item gap 5px
 *   - Explorer row: 22 px tall, 12 px font
 *   - Minimap:      ~64 px wide on right edge
 *   - Borders:      #2b2b2b 1px between panels
 *
 * Color tokens (Dark+ default theme):
 *   editor.background          #1f1f1f
 *   sideBar.background         #181818
 *   activityBar.background     #181818
 *   statusBar.background       #181818 (no folder open) / #007acc (debug)
 *   tab.activeBackground       #1f1f1f
 *   tab.inactiveBackground     #181818
 *   tab.activeBorderTop        #cccccc (or accent)
 *   foreground                 #cccccc
 */

import type { ReactNode } from "react";

type CodeLine = {
  /** Indent depth in tabs (each = 14 px). */
  indent?: number;
  /** Tokenized line content. */
  tokens: Array<{ text: string; kind?: TokenKind }>;
  /** Highlight modifier for animation states. */
  state?: "added" | "removed" | "edited" | null;
};

type TokenKind =
  | "keyword"
  | "string"
  | "comment"
  | "fn"
  | "type"
  | "var"
  | "punct"
  | "num";

type Props = {
  /** Active file name shown in the tab + breadcrumb. */
  fileName: string;
  /** Folder name shown at the top of the explorer + window title. */
  folderName: string;
  /** Active line for the cursor / highlight indicator. 1-indexed. */
  cursorLine?: number;
  /** Body lines of the file. */
  lines: CodeLine[];
  /** Optional badge — "Veronum • teammate editing" etc. */
  statusRight?: ReactNode;
};

// VS Code Dark+ token colors (from the default theme).
const TOKEN_COLOR: Record<TokenKind, string> = {
  keyword: "#c586c0",
  string: "#ce9178",
  comment: "#6a9955",
  fn: "#dcdcaa",
  type: "#4ec9b0",
  var: "#9cdcfe",
  punct: "#d4d4d4",
  num: "#b5cea8",
};

// Verified VS Code dimensions.
const TITLE_BAR_HEIGHT = 30;
const ACTIVITY_BAR_WIDTH = 48;
const SIDEBAR_WIDTH = 220;
const STATUS_BAR_HEIGHT = 22;
const TAB_STRIP_HEIGHT = 36;
const BREADCRUMB_HEIGHT = 22;
const MINIMAP_WIDTH = 64;
const BORDER = "1px solid #2b2b2b";

export function VSCodeShell({
  fileName,
  folderName,
  cursorLine = 1,
  lines,
  statusRight,
}: Props) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        aspectRatio: "1100 / 720",
        background: "#1f1f1f",
        boxShadow:
          "0 24px 56px -12px rgba(0,0,0,0.40), 0 4px 12px -6px rgba(0,0,0,0.30)",
        color: "#cccccc",
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        border: "1px solid rgba(0,0,0,0.5)",
      }}
    >
      {/* Title bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center"
        style={{
          height: TITLE_BAR_HEIGHT,
          background: "#181818",
          borderBottom: BORDER,
          color: "#cccccc",
          fontSize: 12,
        }}
      >
        <div
          className="flex items-center"
          style={{ paddingLeft: 12, gap: 8 }}
        >
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: "#ff5f57" }}
          />
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: "#febc2e" }}
          />
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: "#28c840" }}
          />
        </div>
        <div
          className="flex-1 text-center"
          style={{
            color: "#969696",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
          }}
        >
          {fileName} — {folderName}
        </div>
      </div>

      {/* Activity bar */}
      <ActivityBar />

      {/* Sidebar / Explorer */}
      <SideBar folderName={folderName} activeFile={fileName} />

      {/* Editor pane */}
      <div
        className="absolute"
        style={{
          top: TITLE_BAR_HEIGHT,
          left: ACTIVITY_BAR_WIDTH + SIDEBAR_WIDTH,
          right: 0,
          bottom: STATUS_BAR_HEIGHT,
          background: "#1f1f1f",
        }}
      >
        {/* Tab strip */}
        <div
          className="flex items-stretch"
          style={{
            height: TAB_STRIP_HEIGHT,
            background: "#181818",
            borderBottom: BORDER,
          }}
        >
          {/* Active tab */}
          <div
            className="flex items-center relative"
            style={{
              background: "#1f1f1f",
              borderRight: BORDER,
              color: "#ffffff",
              fontSize: 13,
              minWidth: 180,
              padding: "0 10px",
              gap: 8,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
            }}
          >
            {/* Top accent line on active tab */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background: "#cccccc",
              }}
            />
            <FileGlyph kind="ts" />
            <span className="flex-1 truncate">{fileName}</span>
            <CloseGlyph />
          </div>
          {/* Spacer to fill rest of strip */}
          <div className="flex-1" />
        </div>

        {/* Breadcrumb */}
        <div
          className="flex items-center"
          style={{
            height: BREADCRUMB_HEIGHT,
            padding: "0 16px",
            fontSize: 12,
            color: "#cccccc99",
            borderBottom: "1px solid #1a1a1a",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
          }}
        >
          {[folderName, "apps", "server", "src", "middleware", fileName].map(
            (seg, i, arr) => (
              <span key={i} className="flex items-center">
                <span
                  style={{
                    color: i === arr.length - 1 ? "#cccccc" : "#888888",
                  }}
                >
                  {seg}
                </span>
                {i < arr.length - 1 && (
                  <span style={{ margin: "0 6px", color: "#6e6e6e" }}>›</span>
                )}
              </span>
            )
          )}
        </div>

        {/* Code body + minimap */}
        <div
          className="absolute flex"
          style={{
            top: TAB_STRIP_HEIGHT + BREADCRUMB_HEIGHT,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <div className="flex-1 min-w-0">
            <CodeBody lines={lines} cursorLine={cursorLine} />
          </div>
          <Minimap lines={lines} />
        </div>
      </div>

      {/* Status bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center"
        style={{
          height: STATUS_BAR_HEIGHT,
          background: "#181818",
          color: "#cccccc",
          fontSize: 12,
          padding: "0 5px",
          borderTop: BORDER,
          lineHeight: `${STATUS_BAR_HEIGHT}px`,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
        }}
      >
        <StatusItem>
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden
          >
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="12" cy="11" r="1.5" />
            <path d="M4 5.5v3.5a2 2 0 0 0 2 2h4.5" />
          </svg>
          <span>main</span>
        </StatusItem>
        <StatusItem>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M7.5 1L1 8l6.5 7L9 13.5L4 8l5-5.5z" opacity="0.7" />
          </svg>
          <span>0</span>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M8 5v3.5M8 11v0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>0</span>
        </StatusItem>
        <span className="ml-auto flex items-center" style={{ gap: 0 }}>
          <StatusItem>Ln {cursorLine}, Col 1</StatusItem>
          <StatusItem>Spaces: 2</StatusItem>
          <StatusItem>UTF-8</StatusItem>
          <StatusItem>LF</StatusItem>
          <StatusItem>{"{}"} TypeScript</StatusItem>
          {statusRight}
        </span>
      </div>
    </div>
  );
}

function StatusItem({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "0 5px",
        height: STATUS_BAR_HEIGHT,
        gap: 4,
        cursor: "default",
      }}
    >
      {children}
    </span>
  );
}

function ActivityBar() {
  return (
    <div
      className="absolute flex flex-col items-stretch justify-between"
      style={{
        top: TITLE_BAR_HEIGHT,
        bottom: STATUS_BAR_HEIGHT,
        left: 0,
        width: ACTIVITY_BAR_WIDTH,
        background: "#181818",
        borderRight: BORDER,
      }}
    >
      <div className="flex flex-col">
        <ActivityIcon active label="Explorer">
          <path d="M14.5 3h-13l-.5.5v9l.5.5h13l.5-.5v-9zM14 12H2V4h12z" fill="currentColor" stroke="none" />
          <path d="M3 6h10v0.7H3zM3 8h10v0.7H3zM3 10h7v0.7H3z" fill="currentColor" stroke="none" />
        </ActivityIcon>
        <ActivityIcon label="Search">
          <circle cx="6.7" cy="6.7" r="4" />
          <path d="m13 13-3.5-3.5" strokeWidth="1.7" />
        </ActivityIcon>
        <ActivityIcon label="Source Control">
          <circle cx="4" cy="4" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <path d="M4 5.5v3a3 3 0 0 0 3 3h3.5" />
        </ActivityIcon>
        <ActivityIcon label="Run and Debug">
          <path d="M4.5 3.2L13 8L4.5 12.8z" fill="currentColor" />
          <circle cx="11.5" cy="11.5" r="2.5" stroke="currentColor" fill="none" strokeWidth="1.2" />
          <path d="M11.5 10v3M10 11.5h3" stroke="currentColor" strokeWidth="1.2" />
        </ActivityIcon>
        <ActivityIcon label="Extensions">
          <path d="M2 2h4v3h2V3h2v3h4v2h-3v2h3v4h-4v-2h-2v3H8v-3H6v3H2V8h3V6H2z" fill="currentColor" stroke="none" />
        </ActivityIcon>
      </div>
      <div className="flex flex-col">
        <ActivityIcon label="Account">
          <circle cx="8" cy="6" r="2.4" />
          <path d="M3 13.5c.7-2.5 2.7-4 5-4s4.3 1.5 5 4" />
        </ActivityIcon>
        <ActivityIcon label="Settings">
          <circle cx="8" cy="8" r="2" />
          <path d="M13.5 8c0-.4-.05-.8-.13-1.18l1.4-1.07-1.5-2.6-1.65.65a5.5 5.5 0 0 0-2.04-1.18L9.18 1H6.82l-.4 1.62a5.5 5.5 0 0 0-2.04 1.18l-1.65-.65-1.5 2.6 1.4 1.07c-.08.38-.13.78-.13 1.18s.05.8.13 1.18l-1.4 1.07 1.5 2.6 1.65-.65a5.5 5.5 0 0 0 2.04 1.18L6.82 15h2.36l.4-1.62a5.5 5.5 0 0 0 2.04-1.18l1.65.65 1.5-2.6-1.4-1.07c.08-.38.13-.78.13-1.18z" />
        </ActivityIcon>
      </div>
    </div>
  );
}

function ActivityIcon({
  children,
  active,
  label,
}: {
  children: ReactNode;
  active?: boolean;
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      className="relative flex items-center justify-center"
      style={{
        width: ACTIVITY_BAR_WIDTH,
        height: 35,
        color: active ? "#ffffff" : "#858585",
      }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute"
          style={{ left: 0, top: 0, bottom: 0, width: 2, background: "#ffffff" }}
        />
      )}
      <svg
        viewBox="0 0 16 16"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </div>
  );
}

function SideBar({
  folderName,
  activeFile,
}: {
  folderName: string;
  activeFile: string;
}) {
  return (
    <div
      className="absolute flex flex-col"
      style={{
        top: TITLE_BAR_HEIGHT,
        bottom: STATUS_BAR_HEIGHT,
        left: ACTIVITY_BAR_WIDTH,
        width: SIDEBAR_WIDTH,
        background: "#181818",
        borderRight: BORDER,
        color: "#cccccc",
        fontSize: 12,
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
      }}
    >
      {/* Sidebar header */}
      <div
        className="flex items-center justify-between"
        style={{
          height: 35,
          padding: "0 16px 0 20px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontSize: 11,
          fontWeight: 700,
          color: "#cccccc",
        }}
      >
        <span>Explorer</span>
        <span style={{ color: "#858585" }}>···</span>
      </div>

      {/* Folder section header */}
      <div
        className="flex items-center"
        style={{
          height: 22,
          padding: "0 8px",
          background: "#1a1a1a",
          textTransform: "uppercase",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <Caret expanded />
        <span style={{ marginLeft: 4 }}>{folderName}</span>
      </div>

      <div className="flex-1 overflow-hidden">
        <TreeRow name="apps" expanded depth={0} />
        <TreeRow name="server" expanded depth={1} />
        <TreeRow name="src" expanded depth={2} />
        <TreeRow name="middleware" expanded depth={3} />
        <FileRow name={activeFile} active depth={4} />
        <FileRow name="auth.ts" depth={4} />
        <FileRow name="rateLimit.ts" depth={4} />
        <TreeRow name="lib" depth={2} />
        <TreeRow name="web" depth={1} />
        <TreeRow name="packages" depth={0} />
        <FileRow name="package.json" depth={0} icon="json" />
        <FileRow name="README.md" depth={0} icon="md" />
      </div>
    </div>
  );
}

function Caret({ expanded }: { expanded?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      style={{ color: "#858585", flexShrink: 0 }}
    >
      {expanded ? <path d="M3 6l5 5 5-5z" /> : <path d="M6 3l5 5-5 5z" />}
    </svg>
  );
}

function TreeRow({
  name,
  depth,
  expanded,
}: {
  name: string;
  depth: number;
  expanded?: boolean;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        height: 22,
        paddingLeft: 8 + depth * 8,
        color: "#cccccc",
        fontSize: 13,
        gap: 4,
        cursor: "pointer",
      }}
    >
      <Caret expanded={expanded} />
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="#dcb67a"
        aria-hidden
        style={{ flexShrink: 0 }}
      >
        <path d="M2 4.5v8h12v-7H7L5.5 4H2.5z" />
      </svg>
      <span>{name}</span>
    </div>
  );
}

function FileRow({
  name,
  depth,
  active,
  icon = "ts",
}: {
  name: string;
  depth: number;
  active?: boolean;
  icon?: "ts" | "json" | "md";
}) {
  return (
    <div
      className="flex items-center"
      style={{
        height: 22,
        paddingLeft: 8 + depth * 8 + 14,
        background: active ? "#264f78" : "transparent",
        color: active ? "#ffffff" : "#cccccc",
        fontSize: 13,
        gap: 6,
        cursor: "pointer",
      }}
    >
      <FileGlyph kind={icon} />
      <span>{name}</span>
    </div>
  );
}

function FileGlyph({ kind }: { kind: "ts" | "json" | "md" }) {
  const colors = {
    ts: "#3178c6",
    json: "#cca700",
    md: "#519aba",
  };
  const labels = {
    ts: "TS",
    json: "{}",
    md: "MD",
  };
  return (
    <span
      className="inline-flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: 14,
        height: 14,
        borderRadius: 2,
        background: colors[kind],
        color: "#fff",
        fontSize: 8,
        letterSpacing: "0.04em",
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      {labels[kind]}
    </span>
  );
}

function CloseGlyph() {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: 16,
        height: 16,
        color: "#969696",
        borderRadius: 3,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 16 16"
        width="11"
        height="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      >
        <path d="M4 4l8 8M12 4L4 12" />
      </svg>
    </span>
  );
}

function CodeBody({
  lines,
  cursorLine,
}: {
  lines: CodeLine[];
  cursorLine: number;
}) {
  return (
    <div
      className="flex h-full"
      style={{ fontSize: 13, lineHeight: "20px" }}
    >
      {/* Line gutter */}
      <div
        className="flex flex-col items-end select-none flex-shrink-0"
        style={{
          width: 50,
          color: "#6e7681",
          paddingTop: 8,
          paddingRight: 12,
          background: "#1f1f1f",
          fontVariantNumeric: "tabular-nums",
          fontSize: 12.5,
        }}
      >
        {lines.map((_, i) => (
          <div
            key={i}
            style={{
              color: i + 1 === cursorLine ? "#cccccc" : "#6e7681",
              height: 20,
              lineHeight: "20px",
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code lines */}
      <div className="flex-1 relative overflow-hidden" style={{ paddingTop: 8 }}>
        {lines.map((line, i) => {
          const lineBg =
            line.state === "added"
              ? "rgba(64,162,109,0.18)"
              : line.state === "removed"
                ? "rgba(229,77,77,0.18)"
                : line.state === "edited"
                  ? "rgba(255,196,0,0.10)"
                  : i + 1 === cursorLine
                    ? "rgba(255,255,255,0.04)"
                    : "transparent";
          return (
            <div
              key={i}
              className="flex items-center transition-colors"
              style={{
                height: 20,
                background: lineBg,
                paddingLeft: (line.indent ?? 0) * 14 + 12,
                paddingRight: 12,
              }}
            >
              {line.tokens.map((t, ti) => (
                <span
                  key={ti}
                  style={{
                    color: t.kind ? TOKEN_COLOR[t.kind] : "#d4d4d4",
                    whiteSpace: "pre",
                  }}
                >
                  {t.text}
                </span>
              ))}
              {i + 1 === cursorLine && (
                <span
                  className="inline-block animate-[demoBlink_1s_steps(2)_infinite]"
                  style={{
                    width: 2,
                    height: 16,
                    background: "#aeafad",
                    marginLeft: 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Right-edge minimap — gives the demo the proper VS Code feel. */
function Minimap({ lines }: { lines: CodeLine[] }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: MINIMAP_WIDTH,
        background: "#1f1f1f",
        borderLeft: "1px solid #1a1a1a",
        position: "relative",
        overflow: "hidden",
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{ padding: "8px 6px", display: "flex", flexDirection: "column", gap: 2 }}
      >
        {lines.map((line, i) => {
          const totalLen = line.tokens.reduce((acc, t) => acc + t.text.length, 0);
          const widthPct = Math.min(100, totalLen * 1.4);
          const baseColor =
            line.state === "added"
              ? "rgba(64,162,109,0.55)"
              : line.state === "removed"
                ? "rgba(229,77,77,0.55)"
                : "rgba(122,122,122,0.55)";
          return (
            <div
              key={i}
              style={{
                marginLeft: (line.indent ?? 0) * 4,
                width: `${widthPct}%`,
                height: 2,
                background: baseColor,
                borderRadius: 0.5,
              }}
            />
          );
        })}
      </div>
      {/* Visible viewport indicator */}
      <div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: "100%",
          background: "rgba(255,255,255,0.04)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
