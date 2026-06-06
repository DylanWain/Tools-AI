"use client";

/**
 * Right-pane project tree for multi-agent CODE mode. Renders the
 * files parsed out of every agent's output, grouped under their
 * directory paths. Each file shows:
 *
 *   - Filename + tiny size badge
 *   - Owner agent (which slot wrote it)
 *   - Status: 🟡 streaming, 🟢 done, 🔴 conflict (two agents wrote it)
 *   - Click to expand inline and show the code
 *
 * Bottom of the panel has a "Copy all" button that flattens every
 * file into a single text dump with file delimiters — quick way to
 * paste the whole virtual project into a new repo.
 */

import { useMemo, useState } from "react";
import type { ProjectFile } from "@/lib/compare/sessions";
import { sizeOf } from "@/lib/compare/projectFiles";

type Props = {
  project: Record<string, ProjectFile>;
  /** slotId → friendly label, e.g. "Agent 3 · Claude Sonnet" */
  slotLabels: Record<string, string>;
};

export function ProjectView({ project, slotLabels }: Props) {
  const files = useMemo(
    () => Object.values(project).sort((a, b) => a.path.localeCompare(b.path)),
    [project],
  );
  const [openPath, setOpenPath] = useState<string | null>(null);
  const conflicts = files.filter((f) => (f.conflictingSlotIds ?? []).length > 0).length;

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#161616] p-5 text-center">
        <div className="text-[12px] uppercase tracking-wider text-white/35 font-mono mb-2">
          Project tree
        </div>
        <p className="text-white/40 text-[13px] leading-[1.5]">
          Files will appear here as agents write them.
          Each agent should output blocks like
          <code className="block mt-2 text-white/60 font-mono text-[11px]">
            ```ts:path/to/file.ts
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="text-[12px] uppercase tracking-wider text-white/60 font-mono">
          Project tree
          <span className="ml-2 text-white/35">·</span>
          <span className="ml-2 text-white/35">
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
          {conflicts > 0 && (
            <>
              <span className="ml-2 text-white/35">·</span>
              <span className="ml-2 text-red-400/90">
                {conflicts} conflict{conflicts === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
        <CopyAllButton files={files} />
      </header>

      <ul className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
        {files.map((f) => {
          const hasConflict = (f.conflictingSlotIds ?? []).length > 0;
          const ownerLabel = slotLabels[f.ownerSlotId] ?? f.ownerSlotId;
          const isOpen = openPath === f.path;
          return (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setOpenPath(isOpen ? null : f.path)}
                className={[
                  "w-full text-left flex items-center justify-between gap-3 px-4 py-2 hover:bg-white/[0.03] transition-colors",
                  hasConflict && "bg-red-500/[0.06]",
                ].filter(Boolean).join(" ")}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <StatusDot complete={f.complete} conflict={hasConflict} />
                  <span className="text-[13px] text-white/90 font-mono truncate">
                    {f.path}
                  </span>
                  <span className="text-[10px] text-white/30 font-mono shrink-0">
                    {sizeOf(f.content)}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono shrink-0">
                  {hasConflict
                    ? `${ownerLabel} + ${(f.conflictingSlotIds ?? []).length} other${(f.conflictingSlotIds ?? []).length === 1 ? "" : "s"}`
                    : ownerLabel}
                </div>
              </button>
              {isOpen && (
                <FileContent file={f} hasConflict={hasConflict} conflictingSlotIds={f.conflictingSlotIds} slotLabels={slotLabels} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusDot({ complete, conflict }: { complete: boolean; conflict: boolean }) {
  const color = conflict ? "#f87171" : complete ? "#22c55e" : "#eab308";
  const pulse = !complete && !conflict;
  return (
    <span
      aria-hidden
      className={[
        "inline-block w-2 h-2 rounded-full shrink-0",
        pulse && "animate-pulse",
      ].filter(Boolean).join(" ")}
      style={{ backgroundColor: color }}
    />
  );
}

function FileContent({
  file, hasConflict, conflictingSlotIds, slotLabels,
}: {
  file: ProjectFile;
  hasConflict: boolean;
  conflictingSlotIds?: string[];
  slotLabels: Record<string, string>;
}) {
  return (
    <div className="px-4 pb-3 pt-1">
      {hasConflict && (
        <div className="mb-2 text-[11px] text-red-300/90 leading-[1.4]">
          ⚠ Two or more agents wrote to this path. Showing
          <span className="font-medium"> {slotLabels[file.ownerSlotId] ?? file.ownerSlotId}</span>'s version.
          {" "}Also written by:{" "}
          {(conflictingSlotIds ?? [])
            .map((sid) => slotLabels[sid] ?? sid)
            .join(", ")}
        </div>
      )}
      <pre className="rounded-md bg-black/60 border border-white/5 px-3 py-2.5 overflow-x-auto text-[12px] leading-[1.5] text-white/85 font-mono whitespace-pre">
        {file.content || (file.complete ? "(empty file)" : "Streaming…")}
      </pre>
    </div>
  );
}

function CopyAllButton({ files }: { files: ProjectFile[] }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const text = files
      .map((f) =>
        `===== ${f.path} =====\n${f.content}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-[11px] uppercase tracking-wider text-white/60 hover:text-white font-mono px-2 py-1 rounded hover:bg-white/[0.06] transition-colors"
    >
      {copied ? "Copied!" : "Copy all"}
    </button>
  );
}
