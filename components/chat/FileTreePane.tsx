"use client";

/**
 * File tree pane — direct visual port of Cursor's explorer, with full
 * file-management parity (add, rename, delete, upload, drag-drop).
 *
 * Visual atoms sourced from Cursor.app/Contents/Resources/app/out/vs/
 * workbench/workbench.desktop.main.css:
 *
 *   .explorer-item       → height:22px; line-height:22px
 *   .monaco-tl-twistie   → width:16px; font-size:10px; padding-right:6px
 *   .monaco-tl-row:hover → rgba(255,255,255,0.07) bg
 *
 * Operations:
 *   - Header bar: New File, New Folder, Collapse All (matches VS Code's
 *     title-bar action set in the Explorer view).
 *   - Right-click on any row OR empty space → context menu with
 *     New File / New Folder / Rename / Delete (Cursor parity).
 *   - F2 or single-click on selected row → inline rename.
 *   - Drag files from Finder anywhere onto the tree → upload as
 *     ProjectFile entries (text/code only; binaries are rejected).
 *
 * State the parent owns: the actual project map. We only hold UI
 * state (which row is being renamed, which row's context menu is
 * open, where we're creating a new file). Mutations bubble up via
 * the on{Create,Rename,Delete,Upload} props so CompareChat can
 * layer them into the same overlay editsByPath uses.
 *
 * Folders are virtual — derived from path slashes. Creating an empty
 * folder writes a .gitkeep stub (the standard convention) so the
 * folder shows in the tree.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectFile } from "@/lib/compare/sessions";
import { FileIcon } from "./FileIcon";

type Props = {
  project: Record<string, ProjectFile>;
  slotLabels: Record<string, string>;
  openPath: string | null;
  onOpen: (path: string) => void;
  /** Create or overwrite a file at the given path. CompareChat
   *  records it in the fileEdits overlay. Used for new files,
   *  uploads, and the post-creation step of new folders (.gitkeep). */
  onCreateFile?: (path: string, content: string) => void;
  /** Move a file. Parent removes the old path (tombstone), writes
   *  the new path with the same content. Folder renames are
   *  decomposed here into N file-renames before the call. */
  onRename?: (oldPath: string, newPath: string) => void;
  /** Tombstone a path. Folder deletes are decomposed into N file
   *  deletes before the call. */
  onDelete?: (path: string) => void;
};

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  file?: ProjectFile;
};

type FlatRow = { node: TreeNode; depth: number };

type ContextTarget =
  | { kind: "row"; path: string; isDir: boolean }
  | { kind: "empty" };

type ContextMenuState = {
  x: number;
  y: number;
  target: ContextTarget;
};

type CreatingState = {
  /** Folder path the new entry will live inside. "" = root. */
  parent: string;
  kind: "file" | "folder";
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

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0, out: FlatRow[] = []): FlatRow[] {
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.isDir && expanded.has(n.path) && n.children) {
      flatten(n.children, expanded, depth + 1, out);
    }
  }
  return out;
}

export function FileTreePane({
  project, openPath, onOpen, onCreateFile, onRename, onDelete,
}: Props) {
  const files = useMemo(() => Object.values(project), [project]);
  const tree = useMemo(() => buildTree(files), [files]);

  // Hidden OS file pickers — one for files, one for folders. Click the
  // header buttons to trigger them. webkitdirectory makes the picker
  // accept whole directory trees and preserves relative paths under
  // file.webkitRelativePath so we can rebuild folder structure.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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

  // ── UI state (parent-agnostic) ─────────────────────────────────
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // VS Code pattern: while creating a new file/folder, the input
  // appears INLINE inside the target folder — not at the bottom of
  // the tree. We splice a synthetic row at the right index + depth
  // into the flat list. The row renderer special-cases path
  // "__creating__" by rendering <CreateInput> instead of <ExplorerRow>.
  const CREATING_PATH = "__creating__";
  const rowsWithCreating = useMemo<FlatRow[]>(() => {
    if (!creating) return rows;
    const parent = creating.parent;
    const parentDepth = parent ? parent.split("/").length - 1 : -1;
    const newDepth = parentDepth + 1;
    const synthetic: FlatRow = {
      node: { name: "", path: CREATING_PATH, isDir: false },
      depth: newDepth,
    };
    if (!parent) {
      // Root-level new file: append after all rows.
      return [...rows, synthetic];
    }
    const parentIdx = rows.findIndex((r) => r.node.path === parent);
    if (parentIdx === -1) return [...rows, synthetic];
    // Walk past the parent's children. The parent's children are
    // every following row at depth > parentDepth, until we hit a
    // row at depth <= parentDepth (that's a sibling/uncle).
    let i = parentIdx + 1;
    while (i < rows.length && rows[i].depth > parentDepth) i++;
    return [...rows.slice(0, i), synthetic, ...rows.slice(i)];
  }, [rows, creating]);
  // Drop targeting. `dropTargetPath` is the path of the folder that
  // will receive the upload — "" means root, null means no drag in
  // progress. VS Code's pattern: drop on a folder targets that
  // folder; drop on a file targets its parent.
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the context menu on any global click. (Click on a menu
  // item closes the menu via its own handler, which fires before
  // this listener picks up the bubbled click.)
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  // F2 → rename the selected row (matches VS Code shortcut).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedPath) return;
      if (renamingPath || creating) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "F2") {
        e.preventDefault();
        setRenamingPath(selectedPath);
      } else if ((e.key === "Backspace" || e.key === "Delete") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        confirmAndDelete(selectedPath);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, renamingPath, creating]);

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(allDirs));
  }

  /** Resolve the parent folder for a "new file" / "new folder" action
   *  triggered from `target`. Folder targets nest inside themselves;
   *  file targets nest beside themselves. Empty target = root. */
  function parentFor(target: ContextTarget): string {
    if (target.kind === "empty") return "";
    if (target.isDir) return target.path;
    const slash = target.path.lastIndexOf("/");
    return slash === -1 ? "" : target.path.slice(0, slash);
  }

  function beginCreate(target: ContextTarget, kind: "file" | "folder") {
    const parent = parentFor(target);
    // Expand the parent folder so the new row is visible.
    if (parent) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(parent);
        return next;
      });
    }
    setCreating({ parent, kind });
  }

  function confirmCreate(name: string) {
    if (!creating) return;
    const clean = name.trim();
    setCreating(null);
    if (!clean) return;
    if (!isValidName(clean)) return;
    const fullPath = creating.parent ? `${creating.parent}/${clean}` : clean;
    if (creating.kind === "file") {
      onCreateFile?.(fullPath, "");
      setSelectedPath(fullPath);
      onOpen(fullPath);
    } else {
      // Empty folder = write a .gitkeep so the tree has something
      // to anchor the folder node onto.
      onCreateFile?.(`${fullPath}/.gitkeep`, "");
    }
  }

  function confirmRename(oldPath: string, newName: string) {
    const clean = newName.trim();
    setRenamingPath(null);
    if (!clean) return;
    if (!isValidName(clean)) return;
    const slash = oldPath.lastIndexOf("/");
    const newPath = slash === -1 ? clean : `${oldPath.slice(0, slash + 1)}${clean}`;
    if (newPath === oldPath) return;
    // Folder rename: re-key every file under the prefix.
    const isFolder = files.every((f) => f.path !== oldPath) && files.some((f) => f.path.startsWith(`${oldPath}/`));
    if (isFolder) {
      const prefix = `${oldPath}/`;
      for (const f of files) {
        if (f.path.startsWith(prefix)) {
          onRename?.(f.path, `${newPath}/${f.path.slice(prefix.length)}`);
        }
      }
    } else {
      onRename?.(oldPath, newPath);
    }
    if (selectedPath === oldPath) setSelectedPath(newPath);
  }

  function confirmAndDelete(path: string) {
    // Real apps would show a confirmation modal. For v1 we use the
    // browser confirm — same as VS Code's default Delete behavior
    // before they added the trash setting.
    const isFolder = files.every((f) => f.path !== path) && files.some((f) => f.path.startsWith(`${path}/`));
    const label = isFolder ? `folder ${path} and all files inside` : `file ${path}`;
    if (!window.confirm(`Delete ${label}?`)) return;
    if (isFolder) {
      const prefix = `${path}/`;
      for (const f of files) {
        if (f.path.startsWith(prefix)) onDelete?.(f.path);
      }
    } else {
      onDelete?.(path);
    }
    if (selectedPath === path) setSelectedPath(null);
  }

  /** Read a FileList and write each into the project at parent/.
   *  Used by all three upload paths: header button, right-click menu,
   *  and drag-drop. Honors webkitRelativePath so folder uploads
   *  preserve their tree structure. Skips obvious binaries. */
  async function ingestFileList(parent: string, list: FileList) {
    let firstPath: string | null = null;
    for (const f of Array.from(list)) {
      if (isBinaryLikeName(f.name)) continue;
      const text = await f.text().catch(() => null);
      if (text === null) continue;
      // webkitRelativePath is set when the file came from a
      // <input webkitdirectory> picker or a folder drag-drop. It
      // includes the picked folder's name as the first segment so
      // dropping ~/Foo gives us "Foo/bar.txt", "Foo/sub/baz.ts" etc.
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const path = parent ? `${parent}/${rel}` : rel;
      onCreateFile?.(path, text);
      if (!firstPath) firstPath = path;
    }
    // Open the first uploaded file so the user immediately sees
    // something in the editor — VS Code does the same for new files.
    if (firstPath) {
      setSelectedPath(firstPath);
      onOpen(firstPath);
    }
  }

  /** Trigger the appropriate hidden OS file picker. */
  function triggerUpload(kind: "file" | "folder") {
    const el = kind === "file" ? fileInputRef.current : folderInputRef.current;
    if (!el) return;
    // Reset value so picking the same file twice still fires onChange.
    el.value = "";
    el.click();
  }

  /** Resolve the effective drop target for a drag event landing on
   *  this row. Folders accept directly; files retarget to their
   *  parent (VS Code's FileDragAndDrop pattern). */
  function dropTargetForNode(n: TreeNode): string {
    if (n.isDir) return n.path;
    const slash = n.path.lastIndexOf("/");
    return slash === -1 ? "" : n.path.slice(0, slash);
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 flex flex-col"
      style={{
        background: "#000",
        color: "#cccccc",
        fontFamily: "var(--font-sans)",
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          // Default target = root. Row-level handlers override this
          // when the cursor is over a specific row.
          if (dropTargetPath === null) setDropTargetPath("");
        }
      }}
      onDragLeave={(e) => {
        // Only clear when leaving the whole pane — internal moves
        // between rows would otherwise flicker the target off.
        if (e.currentTarget === e.target) setDropTargetPath(null);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        // Use whatever target a row handler set; default to root.
        const target = dropTargetPath ?? "";
        setDropTargetPath(null);
        ingestFileList(target, e.dataTransfer.files);
      }}
    >
      {/* Hidden OS pickers triggered by the header Upload buttons.
          One picker per shape — webkitdirectory has to be on a
          dedicated input or it picks files in single-file mode too. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) ingestFileList("", e.target.files);
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error — webkitdirectory is a non-standard but
        // Chromium / Safari / WebKit-iOS attribute that lets a file
        // input accept directory trees. Firefox supports it as of 50.
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) ingestFileList("", e.target.files);
        }}
      />
      <header
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          height: 35,
          borderBottom: "1px solid #1a1918",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#cccccc",
          }}
        >
          Explorer
          <span style={{ marginLeft: 8, fontWeight: 400, color: "#7f7f7f" }}>
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <HeaderAction title="New File" onClick={() => beginCreate({ kind: "empty" }, "file")}>
            <span className="codicon codicon-new-file" style={{ fontSize: 14 }} />
          </HeaderAction>
          <HeaderAction title="New Folder" onClick={() => beginCreate({ kind: "empty" }, "folder")}>
            <span className="codicon codicon-new-folder" style={{ fontSize: 14 }} />
          </HeaderAction>
          <HeaderAction title="Upload Files…" onClick={() => triggerUpload("file")}>
            <span className="codicon codicon-cloud-upload" style={{ fontSize: 14 }} />
          </HeaderAction>
          <HeaderAction title="Upload Folder…" onClick={() => triggerUpload("folder")}>
            <span className="codicon codicon-folder-active" style={{ fontSize: 14 }} />
          </HeaderAction>
          <HeaderAction title="Collapse All" onClick={collapseAll}>
            <span className="codicon codicon-collapse-all" style={{ fontSize: 14 }} />
          </HeaderAction>
        </div>
      </header>

      <div
        className="flex-1 min-h-0 overflow-auto py-1 relative"
        onContextMenu={(e) => {
          // Right-click in the empty area below the rows.
          if (e.target === e.currentTarget) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, target: { kind: "empty" } });
          }
        }}
        onClick={(e) => {
          // Click in empty area clears selection (matches VS Code).
          if (e.target === e.currentTarget) setSelectedPath(null);
        }}
      >
        {rowsWithCreating.length === 0 ? (
          <div
            className="px-4 py-3"
            style={{ fontSize: 12, color: "#7f7f7f", lineHeight: 1.6 }}
          >
            <p>This workspace is empty.</p>
            <ul style={{ paddingLeft: 16, marginTop: 6, listStyle: "disc" }}>
              <li>
                Click <span className="codicon codicon-new-file" style={{ fontSize: 11 }} /> to create a file
              </li>
              <li>
                Click <span className="codicon codicon-cloud-upload" style={{ fontSize: 11 }} /> to upload from your computer
              </li>
              <li>Drag files from Finder anywhere onto this pane</li>
              <li>Or generate code in the chat</li>
            </ul>
          </div>
        ) : (
          rowsWithCreating.map(({ node, depth }) => {
            if (node.path === CREATING_PATH && creating) {
              return (
                <CreateInput
                  key={CREATING_PATH}
                  parent={creating.parent}
                  depth={depth}
                  kind={creating.kind}
                  onConfirm={confirmCreate}
                  onCancel={() => setCreating(null)}
                />
              );
            }
            const isDropTarget = dropTargetPath !== null && dropTargetForNode(node) === dropTargetPath;
            return (
              <RowOrRename
                key={node.path}
                node={node}
                depth={depth}
                isOpen={!node.isDir && node.file?.path === openPath}
                isSelected={selectedPath === node.path}
                isExpanded={expanded.has(node.path)}
                isRenaming={renamingPath === node.path}
                isDropTarget={isDropTarget}
                onToggle={() => toggle(node.path)}
                onClick={() => {
                  if (selectedPath === node.path && !node.isDir) {
                    onOpen(node.file?.path ?? node.path);
                  } else {
                    setSelectedPath(node.path);
                    if (!node.isDir) onOpen(node.file?.path ?? node.path);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedPath(node.path);
                  setContextMenu({
                    x: e.clientX, y: e.clientY,
                    target: { kind: "row", path: node.path, isDir: node.isDir },
                  });
                }}
                onConfirmRename={(newName) => confirmRename(node.path, newName)}
                onCancelRename={() => setRenamingPath(null)}
                onDragOverRow={(e) => {
                  if (!e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setDropTargetPath(dropTargetForNode(node));
                }}
                onDropRow={(e) => {
                  if (!e.dataTransfer.files.length) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const parent = dropTargetForNode(node);
                  setDropTargetPath(null);
                  ingestFileList(parent, e.dataTransfer.files);
                }}
              />
            );
          })
        )}

        {dropTargetPath === "" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              border: "2px dashed rgba(217,119,87,0.45)",
              background: "rgba(217,119,87,0.04)",
            }}
          />
        )}
      </div>

      {contextMenu && (
        <ContextMenuPopover
          state={contextMenu}
          onNewFile={() => beginCreate(contextMenu.target, "file")}
          onNewFolder={() => beginCreate(contextMenu.target, "folder")}
          onUploadFiles={() => triggerUpload("file")}
          onUploadFolder={() => triggerUpload("folder")}
          onRename={() => {
            if (contextMenu.target.kind === "row") setRenamingPath(contextMenu.target.path);
          }}
          onDelete={() => {
            if (contextMenu.target.kind === "row") confirmAndDelete(contextMenu.target.path);
          }}
        />
      )}
    </div>
  );
}

// ─── small components ────────────────────────────────────────────

function HeaderAction({ title, onClick, children }: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-6 h-6 flex items-center justify-center rounded transition-colors"
      style={{ color: "#cccccc" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

function RowOrRename(props: RowProps) {
  if (props.isRenaming) {
    return <RenameRow {...props} />;
  }
  return <ExplorerRow {...props} />;
}

type RowProps = {
  node: TreeNode;
  depth: number;
  isOpen: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  isRenaming: boolean;
  isDropTarget?: boolean;
  onToggle: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onConfirmRename: (newName: string) => void;
  onCancelRename: () => void;
  onDragOverRow?: (e: React.DragEvent) => void;
  onDropRow?: (e: React.DragEvent) => void;
};

function ExplorerRow({
  node, depth, isOpen, isSelected, isExpanded, isDropTarget,
  onClick, onToggle, onContextMenu, onDragOverRow, onDropRow,
}: RowProps) {
  const indent = depth * 8;
  const isDir = node.isDir;
  return (
    <div
      onClick={(e) => {
        if (isDir) {
          onToggle();
        } else {
          onClick();
        }
        e.stopPropagation();
      }}
      onContextMenu={onContextMenu}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      title={node.path}
      role="treeitem"
      aria-expanded={isDir ? isExpanded : undefined}
      aria-selected={isSelected}
      className="cursor-pointer select-none whitespace-nowrap"
      style={{
        display: "flex",
        alignItems: "center",
        height: 22,
        lineHeight: "22px",
        paddingLeft: 4 + indent,
        paddingRight: 8,
        color: isOpen ? "#ffffff" : isSelected ? "#ffffff" : "#cccccc",
        background:
          isDropTarget ? "rgba(217,119,87,0.18)"
          : isOpen ? "rgba(221,130,101,0.16)"
          : isSelected ? "rgba(255,255,255,0.06)"
          : "transparent",
        outline: isDropTarget ? "1px dashed rgba(217,119,87,0.55)" : "none",
        outlineOffset: -1,
        fontSize: 13,
      }}
      onMouseEnter={(e) => {
        if (!isOpen && !isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.07)";
      }}
      onMouseLeave={(e) => {
        if (!isOpen && !isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
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
            color: "#c09553",
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

      <span className="truncate min-w-0" style={{ fontFamily: "var(--font-sans)" }}>
        {node.name}
      </span>
    </div>
  );
}

function RenameRow({ node, depth, onConfirmRename, onCancelRename }: RowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // Select just the basename (without extension) — same default as
    // Finder / VS Code. Lets users rename "foo.tsx" to "bar.tsx" in
    // two keystrokes instead of having to mouse-pick the dot.
    const dot = node.name.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : node.name.length);
  }, [node.name]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 22,
        paddingLeft: 4 + depth * 8 + 16 + 22 + 6, // align under file glyph
        paddingRight: 8,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <input
        ref={inputRef}
        defaultValue={node.name}
        onBlur={(e) => onConfirmRename(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirmRename(e.currentTarget.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancelRename();
          }
        }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          background: "#1e1e1e",
          color: "#f0eee6",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          padding: "0 4px",
          border: "1px solid #d97757",
          borderRadius: 2,
          outline: "none",
          width: "100%",
        }}
      />
    </div>
  );
}

function CreateInput({ parent, depth, kind, onConfirm, onCancel }: {
  parent: string;
  depth: number;
  kind: "file" | "folder";
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  void parent;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 22,
        paddingLeft: 4 + depth * 8,
        paddingRight: 8,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ width: 16 }} />
      <span
        aria-hidden
        className={`codicon ${kind === "folder" ? "codicon-folder" : "codicon-new-file"}`}
        style={{
          width: 22, fontSize: 16,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          color: kind === "folder" ? "#c09553" : "#cccccc",
          marginRight: 6,
        }}
      />
      <input
        ref={inputRef}
        placeholder={kind === "folder" ? "folder name" : "filename.ext"}
        onBlur={(e) => onConfirm(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm(e.currentTarget.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          background: "#1e1e1e",
          color: "#f0eee6",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          padding: "0 4px",
          border: "1px solid #d97757",
          borderRadius: 2,
          outline: "none",
          flex: 1,
        }}
      />
    </div>
  );
}

function ContextMenuPopover({
  state, onNewFile, onNewFolder, onUploadFiles, onUploadFolder, onRename, onDelete,
}: {
  state: ContextMenuState;
  onNewFile: () => void;
  onNewFolder: () => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const onRow = state.target.kind === "row";
  return (
    <div
      role="menu"
      style={{
        position: "fixed",
        top: state.y,
        left: state.x,
        background: "#252526",
        border: "1px solid #454545",
        boxShadow: "0 4px 18px rgba(0,0,0,0.55)",
        minWidth: 200,
        padding: 4,
        zIndex: 200,
        fontSize: 13,
        color: "#cccccc",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem onClick={onNewFile}>New File</MenuItem>
      <MenuItem onClick={onNewFolder}>New Folder</MenuItem>
      <MenuDivider />
      <MenuItem onClick={onUploadFiles}>Upload Files…</MenuItem>
      <MenuItem onClick={onUploadFolder}>Upload Folder…</MenuItem>
      {onRow && (
        <>
          <MenuDivider />
          <MenuItem onClick={onRename} shortcut="F2">Rename</MenuItem>
          <MenuItem onClick={onDelete} shortcut="⌘⌫" destructive>Delete</MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({ onClick, children, shortcut, destructive }: {
  onClick: () => void;
  children: React.ReactNode;
  shortcut?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left flex items-center justify-between"
      style={{
        padding: "4px 10px",
        background: "transparent",
        color: destructive ? "#ff8a96" : "#cccccc",
        borderRadius: 2,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#04395e"; e.currentTarget.style.color = "#ffffff"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = destructive ? "#ff8a96" : "#cccccc"; }}
    >
      <span>{children}</span>
      {shortcut && <span style={{ marginLeft: 24, fontSize: 11, color: "#888888", fontFamily: "var(--font-mono)" }}>{shortcut}</span>}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: "#454545", margin: "4px 0" }} />;
}

// ─── helpers ────────────────────────────────────────────────────

function isValidName(name: string): boolean {
  if (!name) return false;
  if (name.includes("/")) return false;
  if (name === "." || name === "..") return false;
  // Block leading dot? VS Code allows .gitignore etc, so we do too.
  return true;
}

function isBinaryLikeName(name: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|tar|gz|mp3|mp4|mov|wav|woff|woff2|ttf|eot|exe|dll|so|dylib)$/i.test(name);
}
