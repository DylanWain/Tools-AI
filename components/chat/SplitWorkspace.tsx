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
};

export function SplitWorkspace({
  project, slotLabels, onFileEdit,
  canUndo, canRedo, undoTooltip, redoTooltip,
  onUndo, onRedo, onOpenVersionHistory,
}: Props) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  // Percentages of the workspace container — drag-resize updates these.
  const [topPct, setTopPct] = useState(70);          // top row vs terminal
  const [treePct, setTreePct] = useState(34);        // tree vs editor inside top row
  const containerRef = useRef<HTMLDivElement | null>(null);

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

        <div className="flex-1 min-w-0 min-h-0">
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
