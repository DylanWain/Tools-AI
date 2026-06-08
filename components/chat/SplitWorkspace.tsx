"use client";

/**
 * Right-side workspace: file tree + code editor + terminal pane,
 * with drag-resize splitters between each region.
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ ┌─ tree ─┐ ┃ ┌─ editor ─────────────────────────────┐ │
 *   │ │ src/   │ ┃ │ // edit code right here              │ │
 *   │ │   ...  │ ┃ │                                      │ │
 *   │ │        │ ┃ │                                      │ │
 *   │ └────────┘ ┃ └──────────────────────────────────────┘ │
 *   │  ━━━━━━━━ horizontal splitter ━━━━━━━━━━━━━━━━━━━━━━ │
 *   │ ┌─ terminal ────────────────────────────────────────┐ │
 *   │ │ $                                                 │ │
 *   │ └───────────────────────────────────────────────────┘ │
 *   └────────────────────────────────────────────────────────┘
 *
 * Both splitters are draggable. The vertical splitter resizes the
 * file-tree column width; the horizontal splitter resizes the
 * editor row height vs. the terminal row height.
 *
 * Files come from the parsed agent outputs (project map). Selecting a
 * file in the tree loads its content into the editor. Local edits
 * stay in the editor's draft buffer and are echoed back to the
 * project map via onFileEdit so they persist with the session and
 * show up in the right place if a future agent rewrites the file.
 *
 * The terminal is a stub on web (browsers can't spawn processes).
 * When the desktop bridge is paired, it will websocket into the
 * daemon's node-pty + xterm.js terminal (already implemented in
 * veronum-chat-localhost). For now it shows a fake $ prompt and
 * records commands locally so the UX shape is correct.
 */

import { useEffect, useRef, useState } from "react";
import type { ProjectFile } from "@/lib/compare/sessions";
import { FileTreePane } from "./FileTreePane";
import { CodeEditor } from "./CodeEditor";
import { TerminalPane } from "./TerminalPane";
import { SandboxPreview, type SandboxPreviewHandle } from "./SandboxPreview";

type Props = {
  project: Record<string, ProjectFile>;
  slotLabels: Record<string, string>;
  /** Persists user edits back into the parent project map. */
  onFileEdit: (path: string, content: string) => void;
  /** Undo/redo + Save buttons in the editor header. CompareChat
   *  owns the edit log + version state and just hands the actions
   *  down so SplitWorkspace stays a layout component. */
  canUndo: boolean;
  canRedo: boolean;
  undoTooltip: string;
  redoTooltip: string;
  onUndo: () => void;
  onRedo: () => void;
  onOpenVersionHistory: () => void;
  /** True when the signed-in user is on a paid tier (chad/payg/admin).
   *  Gates the "▶ Preview" tab — free users see it but it's locked,
   *  clicking opens an upsell. */
  canPreview?: boolean;
};

export function SplitWorkspace({
  project, slotLabels, onFileEdit,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory,
  canPreview = false,
}: Props) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  // Editor pane has two views — code editor vs the live sandbox preview.
  // The toggle lives in a tab strip at the top of the right column.
  const [view, setView] = useState<"editor" | "preview">("editor");
  // Percentages of the workspace container — drag-resize updates these.
  const [topPct, setTopPct] = useState(70);          // top row vs terminal
  const [treePct, setTreePct] = useState(34);        // tree vs editor inside top row
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Imperative handle to SandboxPreview so the Preview-tab click can
  // open the browser popup synchronously (preserving the user-gesture
  // context that popup blockers check for) and hand it to the preview
  // component in one atomic call. No "click Preview, then click
  // Launch" two-step.
  const previewRef = useRef<SandboxPreviewHandle | null>(null);

  /** Handle a click on the Preview tab. If it's a FRESH click (we
   *  were on the editor view), open the browser popup right now and
   *  fire the launch — all inside the user-gesture context. If the
   *  user is just toggling back to the preview tab on an
   *  already-running preview, just switch views. */
  function onPreviewTabClick() {
    if (view === "preview") return;          // no-op, already there
    if (!canPreview) { setView("preview"); return; }  // locked → show upsell
    // Open the popup synchronously in the click handler. The popup
    // shows a loading shim until the SandboxPreview redirects it to
    // the live preview URL when the sandbox is ready.
    const popup = window.open("about:blank", "_blank");
    setView("preview");
    // Defer ONE tick so the SandboxPreview is in the DOM (we mount
    // it always via display swap, so the ref should already be live,
    // but a microtask makes it bulletproof in cases where the first
    // render hasn't flushed).
    queueMicrotask(() => previewRef.current?.launchNow(popup));
  }

  // Auto-select the first file when the project gains its first entry.
  useEffect(() => {
    if (openPath) return;
    const first = Object.keys(project)[0];
    if (first) setOpenPath(first);
  }, [project, openPath]);

  const openFile = openPath ? project[openPath] : undefined;

  return (
    <div
      ref={containerRef}
      // Full-bleed Veronum dark surface — no outer card border, no
      // rounded corners. The pane reads as a single workspace surface
      // that lives next to the chat, not a card floating inside it.
      className="bg-black overflow-hidden flex flex-col"
      style={{
        height: "calc(100vh - 5rem)",
        minHeight: 480,
        fontFamily: "var(--font-sans), -apple-system, system-ui, sans-serif",
        color: "#f0eee6",
      }}
    >
      {/* TOP ROW: file tree | editor */}
      <div className="flex min-h-0" style={{ flexBasis: `${topPct}%`, flexGrow: 0, flexShrink: 0 }}>
        <div
          className="min-w-0 min-h-0"
          style={{ flexBasis: `${treePct}%`, flexGrow: 0, flexShrink: 0 }}
        >
          <FileTreePane
            project={project}
            slotLabels={slotLabels}
            openPath={openPath}
            onOpen={setOpenPath}
          />
        </div>

        <VerticalSplitter
          onDrag={(clientX) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const pct = ((clientX - rect.left) / rect.width) * 100;
            setTreePct(Math.min(70, Math.max(15, pct)));
          }}
        />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* View tabs — Editor vs Preview. The preview tab is locked
              for free users with a tooltip pointing to the upgrade.
              Clicking Preview also fires the sandbox launch in one
              atomic gesture (no second "Launch" button to click). */}
          <div className="flex items-center gap-0 bg-[#1a1918] border-b border-white/[0.06] shrink-0 text-[12px]">
            <ViewTab
              active={view === "editor"}
              onClick={() => setView("editor")}
              label="Editor"
            />
            <ViewTab
              active={view === "preview"}
              onClick={onPreviewTabClick}
              label="▶ Preview"
              locked={!canPreview}
              tooltip={canPreview ? undefined : "Subscribe ($25/mo) or pay-as-you-go to unlock live preview — runs your code in an ephemeral sandbox"}
            />
          </div>
          {/*
            Both panels stay mounted; we just swap which is visible
            via `display`. Two reasons:
              1. SandboxPreview ref is always live, so onPreviewTabClick
                 can call launchNow() synchronously inside the click
                 handler (popup blockers require that).
              2. The editor preserves its scroll + cursor position
                 across view toggles.
          */}
          <div className="flex-1 min-h-0 relative">
            <div
              className="absolute inset-0"
              style={{ display: view === "editor" ? "block" : "none" }}
            >
              <CodeEditor
                file={openFile}
                onChange={(content) => {
                  if (openPath) onFileEdit(openPath, content);
                }}
                canUndo={canUndo}
                canRedo={canRedo}
                undoTooltip={undoTooltip}
                redoTooltip={redoTooltip}
                onUndo={onUndo}
                onRedo={onRedo}
                onOpenVersionHistory={onOpenVersionHistory}
              />
            </div>
            <div
              className="absolute inset-0"
              style={{ display: view === "preview" ? "block" : "none" }}
            >
              <SandboxPreview ref={previewRef} project={project} canPreview={canPreview} />
            </div>
          </div>
        </div>
      </div>

      <HorizontalSplitter
        onDrag={(clientY) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const pct = ((clientY - rect.top) / rect.height) * 100;
          setTopPct(Math.min(88, Math.max(25, pct)));
        }}
      />

      {/* BOTTOM ROW: terminal */}
      <div className="flex-1 min-h-0">
        <TerminalPane />
      </div>
    </div>
  );
}

/** Tab strip button. Active tab is highlighted; locked tab is greyed
 *  out with a tooltip explaining the gate. Used by the Editor/Preview
 *  toggle above the right-side editor pane. */
function ViewTab({
  active, onClick, label, locked, tooltip,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  locked?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !locked && onClick()}
      disabled={!!locked}
      title={tooltip}
      className={[
        "px-3.5 py-1.5 transition-colors inline-flex items-center gap-1.5 border-b-2",
        active
          ? "border-[#d97757] text-white"
          : locked
            ? "border-transparent text-white/25 cursor-not-allowed"
            : "border-transparent text-white/55 hover:text-white",
      ].join(" ")}
    >
      {locked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
          <path d="M4 5.5 V3.5 a2 2 0 0 1 4 0 V5.5" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}

/** Vertical splitter — drag left/right to resize the file-tree
 *  column. 5px hit area, 1px visible line so it feels light. */
function VerticalSplitter({ onDrag }: { onDrag: (clientX: number) => void }) {
  return (
    <SplitterBar
      orientation="vertical"
      onDrag={(_, x) => onDrag(x)}
    />
  );
}

/** Horizontal splitter — drag up/down to resize editor vs terminal. */
function HorizontalSplitter({ onDrag }: { onDrag: (clientY: number) => void }) {
  return (
    <SplitterBar
      orientation="horizontal"
      onDrag={(y) => onDrag(y)}
    />
  );
}

function SplitterBar({
  orientation, onDrag,
}: {
  orientation: "vertical" | "horizontal";
  onDrag: (clientY: number, clientX: number) => void;
}) {
  const draggingRef = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    function handleMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      onDrag(ev.clientY, ev.clientX);
    }
    function handleUp() {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      onMouseDown={onMouseDown}
      className={[
        "group relative shrink-0",
        orientation === "vertical"
          ? "w-[4px] cursor-col-resize"
          : "h-[4px] cursor-row-resize",
      ].join(" ")}
      style={{ background: "#1a1918" }}
    >
      <div
        aria-hidden
        className={[
          "absolute transition-colors",
          orientation === "vertical"
            ? "left-[1px] top-0 bottom-0 w-px"
            : "top-[1px] left-0 right-0 h-px",
        ].join(" ")}
        style={{ background: "#000" }}
      />
    </div>
  );
}
