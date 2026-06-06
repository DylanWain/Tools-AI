"use client";

/**
 * File tree pane — direct visual port of Cursor's explorer, sourced
 * from Cursor.app/Contents/Resources/app/out/vs/workbench/
 * workbench.desktop.main.css. Specifically matches:
 *
 *   .explorer-item       → height:22px; line-height:22px
 *   .monaco-tl-twistie   → width:16px; font-size:10px; padding-right:6px
 *   .monaco-tl-indent    → 1px guide line at the left of each depth column
 *   .monaco-tl-row:hover → rgba(255,255,255,0.07) bg (vscode-list-hoverBackground in dark)
 *
 * Folder glyphs come from Cursor's codicon.ttf (chevron-right/down
 * for the twistie, folder/folder-opened for the icon column). File
 * glyphs come from VS Code's seti.woff icon theme via FileIcon. Both
 * woff/ttf files ship under /Tools-AI/public/seti/ — byte-identical
 * to the assets inside the Cursor and Veronum app bundles.
 */

import { useMemo, useState } from "react";
import type { ProjectFile } from "@/lib/compare/sessions";
import { FileIcon } from "./FileIcon";

type Props = {
  project: Record<string, ProjectFile>;
  slotLabels: Record<string, string>;
  openPath: string | null;
  onOpen: (path: string) => void;
};

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  file?: ProjectFile;
};

function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let parent = root;
    let cursor = "";
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      cursor = cursor ? `${cursor}/${seg}` : seg;
      const isLeaf = i === parts.length - 1;
      let next = parent.children!.find((c) => c.name === seg);
      if (!next) {
        next = {
          name: seg,
          path: cursor,
          isDir: !isLeaf,
          children: isLeaf ? undefined : [],
          file: isLeaf ? f : undefined,
        };
        parent.children!.push(next);
      } else if (isLeaf) {
        next.file = f;
      }
      parent = next;
    }
  }
  const sortRec = (n: TreeNode) => {
    if (!n.children) return;
    n.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children ?? [];
}

type FlatRow = { node: TreeNode; depth: number };

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0, out: FlatRow[] = []): FlatRow[] {
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.isDir && expanded.has(n.path) && n.children) {
      flatten(n.children, expanded, depth + 1, out);
    }
  }
  return out;
}

export function FileTreePane({ project, openPath, onOpen }: Props) {
  const files = useMemo(() => Object.values(project), [project]);
  const tree = useMemo(() => buildTree(files), [files]);

  // Default: every folder open. Users can collapse; state lives only
  // for the lifetime of this view (intentional — new agent files
  // streaming in should be visible immediately).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allDirs = useMemo(() => {
    const set = new Set<string>();
    const walk = (ns: TreeNode[]) => {
      for (const n of ns) {
        if (n.isDir) {
          set.add(n.path);
          if (n.children) walk(n.children);
        }
      }
    };
    walk(tree);
    return set;
  }, [tree]);
  const expanded = useMemo(() => {
    const set = new Set<string>();
    for (const d of allDirs) if (!collapsed.has(d)) set.add(d);
    return set;
  }, [allDirs, collapsed]);

  const rows = useMemo(() => flatten(tree, expanded), [tree, expanded]);

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col"
      style={{
        background: "#000",
        color: "#cccccc",                       // vscode-foreground (dark theme)
        fontFamily: "var(--font-sans)",
      }}
    >
      <header
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          height: 35,                            // VS Code panel title height
          borderBottom: "1px solid #1a1918",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#cccccc",                    // vs-dark sideBarTitle.foreground
          }}
        >
          Explorer
          <span style={{ marginLeft: 8, fontWeight: 400, color: "#7f7f7f" }}>
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto py-1">
        {rows.length === 0 ? (
          <p
            className="px-4 py-3"
            style={{
              fontSize: 12,
              color: "#7f7f7f",
              lineHeight: 1.5,
            }}
          >
            Files appear here as agents emit{" "}
            <code style={{ color: "#cccccc", fontFamily: "var(--font-mono)" }}>
              ```lang:path
            </code>{" "}
            blocks.
          </p>
        ) : (
          rows.map(({ node, depth }) => (
            <ExplorerRow
              key={node.path}
              node={node}
              depth={depth}
              isOpen={!node.isDir && node.file?.path === openPath}
              isExpanded={expanded.has(node.path)}
              onToggle={() => toggle(node.path)}
              onOpen={() => node.file && onOpen(node.file.path)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ExplorerRow({
  node, depth, isOpen, isExpanded, onToggle, onOpen,
}: {
  node: TreeNode;
  depth: number;
  isOpen: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  // Cursor/VS Code indent: 8px per depth column.
  const indent = depth * 8;
  const isDir = node.isDir;

  return (
    <div
      onClick={isDir ? onToggle : onOpen}
      title={node.path}
      role="treeitem"
      aria-expanded={isDir ? isExpanded : undefined}
      className="cursor-pointer select-none whitespace-nowrap"
      style={{
        display: "flex",
        alignItems: "center",
        height: 22,                                                  // .explorer-item
        lineHeight: "22px",
        paddingLeft: 4 + indent,
        paddingRight: 8,
        color: isOpen ? "#ffffff" : "#cccccc",
        background: isOpen ? "rgba(221,130,101,0.16)" : "transparent",
        fontSize: 13,
      }}
      onMouseEnter={(e) => {
        if (!isOpen) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; // list.hoverBackground
      }}
      onMouseLeave={(e) => {
        if (!isOpen) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Twistie column — 16px wide, codicon chevron for folders, blank for files */}
      <span
        aria-hidden
        className={isDir ? `codicon ${isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}` : ""}
        style={{
          width: 16,
          fontSize: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#cccccc",
        }}
      />

      {/* Icon column — 22px wide, codicon folder for dirs, seti for files */}
      {isDir ? (
        <span
          aria-hidden
          className={`codicon ${isExpanded ? "codicon-folder-opened" : "codicon-folder"}`}
          style={{
            width: 22,
            fontSize: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#c09553",                    // vs-dark folder icon color (warm tan)
            marginRight: 6,
          }}
        />
      ) : (
        <span
          style={{
            width: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginRight: 6,
          }}
        >
          <FileIcon filePath={node.path} size={16} />
        </span>
      )}

      <span
        className="truncate min-w-0"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {node.name}
      </span>
    </div>
  );
}
