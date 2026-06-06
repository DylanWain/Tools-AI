"use client";

/**
 * Version history modal — UI port of veronum-chat-localhost/public/
 * app.js's "Save / revert versions (git)" block (lines ~2120-2370).
 * Same surface: a name input + Save at the top, then a list of past
 * versions, each with a Revert button. Click a version's name to
 * rename it inline.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Version history                              ×           │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ [ name this save…                  ]  [ Save ]           │
 *   │                                                           │
 *   │ ┌── current ──────────────────────────────────────────┐  │
 *   │ │ Login form + Stripe wiring                          │  │
 *   │ │ 14 files · 2m ago               [ Rename ] [ ← ]   │  │
 *   │ └─────────────────────────────────────────────────────┘  │
 *   │ ┌── older ────────────────────────────────────────────┐  │
 *   │ │ Initial scaffolding                                 │  │
 *   │ │ 9 files · 7m ago                [ Rename ] [ ← ]   │  │
 *   │ └─────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The first row is marked "current" because it represents the most
 * recently saved state. Revert applies that snapshot back to the
 * live workspace via the same fileEdits overlay we use for typing,
 * so a revert is itself undoable through the editor's Undo button.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CompareVersion, VersionFile } from "@/lib/compare/versions";
import type { BridgeGitStatus } from "@/lib/compare/bridgeGit";

type Props = {
  open: boolean;
  onClose: () => void;
  versions: CompareVersion[];
  /** Snapshot of the current project — what we'd save if the user
   *  clicks Save. Disable Save if it's empty. */
  currentFiles: Record<string, VersionFile>;
  onSave: (name: string) => void;
  onRevert: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, name: string) => void;
  /** When the user has a paired Veronum Bridge that's reachable,
   *  saves also fire a real git commit + GitHub push on their Mac.
   *  Shown as a badge in the modal header so users know which
   *  backend is recording this save. */
  bridgeStatus: BridgeGitStatus;
  bridgeSyncing: boolean;
};

export function VersionHistoryModal({
  open, onClose, versions, currentFiles,
  onSave, onRevert, onDelete, onRename,
  bridgeStatus, bridgeSyncing,
}: Props) {
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setRenamingId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const fileCount = Object.keys(currentFiles).length;
  const canSave = fileCount > 0;

  function handleSave() {
    if (!canSave) return;
    onSave(name);
    setName("");
  }

  function commitRename(id: string) {
    const v = renameDraft.trim();
    if (v) onRename(id, v);
    setRenamingId(null);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] max-h-[100vh] sm:max-h-[88vh] bg-[#161616] sm:rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white text-[16px] font-medium">Version history</h2>
              <BackendBadge status={bridgeStatus} syncing={bridgeSyncing} />
            </div>
            <p className="text-white/40 text-[12px] mt-0.5">
              {bridgeStatus.available
                ? "Saves commit to git on your Mac and push to GitHub via gh."
                : "Saves stay in this browser's localStorage."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-[22px] leading-none w-8 h-8 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Save row */}
        <div className="px-5 pt-4 pb-3 border-b border-white/5 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder={canSave
                ? `Name this save — e.g. "Login form + Stripe wiring"`
                : "Nothing to save yet — agents haven't written any files"}
              disabled={!canSave}
              className="flex-1 bg-[#0f0f0f] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white/95 placeholder:text-white/30 outline-none focus:border-white/30 transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-md text-[13px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
          {canSave && (
            <p className="text-[11px] text-white/35 mt-2 font-mono">
              {fileCount} file{fileCount === 1 ? "" : "s"} in current state
            </p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {versions.length === 0 ? (
            <p className="text-[12.5px] text-white/40 px-2 py-6 text-center leading-[1.5]">
              No versions saved yet. Name this state above and tap Save to create your first one.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {versions.map((v, idx) => {
                const isCurrent = idx === 0;
                const isRenaming = renamingId === v.id;
                return (
                  <li
                    key={v.id}
                    className={[
                      "rounded-lg border px-3 py-2.5 transition-colors",
                      isCurrent
                        ? "border-[#d97757]/35 bg-[#d97757]/[0.06]"
                        : "border-white/8 bg-[#1f1f1f]",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <input
                            type="text"
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => commitRename(v.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitRename(v.id); }
                              if (e.key === "Escape") { setRenamingId(null); }
                            }}
                            className="w-full bg-black/40 border border-white/15 rounded px-2 py-1 text-[13.5px] text-white outline-none focus:border-white/35"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setRenamingId(v.id); setRenameDraft(v.name); }}
                            title="Click to rename"
                            className="text-left text-[13.5px] text-white/95 hover:text-white font-medium truncate w-full"
                          >
                            {v.name}
                          </button>
                        )}
                        <div className="text-[10.5px] text-white/40 font-mono mt-0.5">
                          {Object.keys(v.files).length} file{Object.keys(v.files).length === 1 ? "" : "s"}
                          {" · "}
                          {humanAgo(v.createdAt)}
                          {isCurrent && <span className="ml-2 text-[#d97757]">current</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Revert to "${v.name}"?\n\nThis overlays the saved snapshot on top of your current files. You can Undo the revert from the editor.`)) {
                              onRevert(v.id);
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1 rounded text-[11.5px] text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors font-medium"
                          title="Revert workspace to this version"
                        >
                          Revert
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete "${v.name}"? This can't be undone.`)) {
                              onDelete(v.id);
                            }
                          }}
                          className="w-7 h-7 inline-flex items-center justify-center rounded text-white/35 hover:text-white hover:bg-white/[0.08] transition-colors"
                          title="Delete this version"
                          aria-label={`Delete ${v.name}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                            <path d="M3 3l6 6M9 3l-6 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Small chip showing where saves are landing. Green when the
 *  Bridge passthrough is live (real git + GitHub), grey otherwise
 *  (localStorage only). */
function BackendBadge({
  status, syncing,
}: { status: BridgeGitStatus; syncing: boolean }) {
  if (status.available) {
    return (
      <span
        title={syncing ? "Syncing to your Mac…" : "Saves run real git + gh push on your paired Mac"}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
        style={{
          background: "rgba(126,180,114,0.14)",
          color: "#7eb472",
          border: "1px solid rgba(126,180,114,0.35)",
        }}
      >
        <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: syncing ? "#d6b15b" : "#7eb472" }} />
        {syncing ? "syncing" : "GitHub-backed"}
      </span>
    );
  }
  const label = status.reason === "not_signed_in"
    ? "local only"
    : status.reason === "no_bridge_paired"
      ? "no Bridge"
      : "Bridge offline";
  const tip = status.reason === "not_signed_in"
    ? "Sign in + pair a Veronum Bridge to back saves with real git + GitHub."
    : status.reason === "no_bridge_paired"
      ? "Pair a Veronum Bridge on your Mac to back saves with real git + GitHub."
      : "Your paired Bridge isn't reachable. Saves stay local until it comes back.";
  return (
    <span
      title={tip}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
      style={{
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
      {label}
    </span>
  );
}

function humanAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
