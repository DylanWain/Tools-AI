"use client";

/**
 * LinkedSources — sidebar section that surfaces the user's coding-tool
 * sessions (Claude Code, Cursor, Codex) read straight off disk through
 * the desktop bridge (window.veronumDesktop.{claudeCode,cursor,codex}).
 *
 * Renders nothing in a plain browser or an old desktop build (sessionReaders()
 * returns null). Lazy: a source loads its projects only when expanded, a
 * project loads its sessions only when expanded. Clicking a session calls
 * `onOpen` so the parent loads the whole conversation INTO the chat (where
 * it can be continued) — no popup. Read-only on disk.
 */
import { useState } from "react";
import {
  sessionReaders,
  type GlobalSessionSource,
  type LinkedMessage,
  type LinkedSession,
  type LinkedSessionContent,
  type ProjectSessionSource,
} from "@/lib/desktop";

export type LinkedOpen = { title: string; messages: LinkedMessage[]; sourceLabel: string; model?: string | null };
type OpenFn = (load: () => Promise<LinkedSessionContent>, title: string, sourceLabel: string, model?: string | null) => void;

const ROW = "w-full text-left truncate rounded-md px-2 py-1 text-[12.5px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors";

export function LinkedSources({ onOpen }: { onOpen: (c: LinkedOpen) => void }) {
  const [readers] = useState(sessionReaders);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (!readers) return null;

  const handleOpen: OpenFn = async (load, title, sourceLabel, model) => {
    setError(null);
    setLoadingId(title);
    try {
      const r = await load();
      if (r.ok) onOpen({ title: r.title || title, messages: r.messages || [], sourceLabel, model });
      else setError(r.error || "could not open session");
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not open session");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="px-2 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors"
      >
        <span>Linked sessions</span>
        <span className={"transition-transform " + (open ? "rotate-90" : "")}>›</span>
      </button>
      {open && (
        <div className="mt-1 space-y-px">
          {error && <div className="px-2 py-1 text-[11px] text-red-300/80">{error}</div>}
          {readers.claudeCode && <ProjectTree label="Claude Code" source={readers.claudeCode} onOpen={handleOpen} loadingId={loadingId} />}
          {readers.cursor && <ProjectTree label="Cursor" source={readers.cursor} onOpen={handleOpen} loadingId={loadingId} />}
          {readers.codex && <FlatTree label="Codex" source={readers.codex} onOpen={handleOpen} loadingId={loadingId} />}
        </div>
      )}
    </div>
  );
}

/** Claude Code / Cursor — project → sessions. */
function ProjectTree({ label, source, onOpen, loadingId }: { label: string; source: ProjectSessionSource; onOpen: OpenFn; loadingId: string | null }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<LinkedProjectish[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && projects === null) {
      const r = await source.listProjects();
      if (r.ok) setProjects((r.projects ?? []).map((p) => ({ id: p.id, name: p.name })));
      else setErr(r.error || "unavailable");
    }
  };

  return (
    <div>
      <Header label={label} open={open} onClick={toggle} />
      {open && (
        <div className="ml-2 border-l border-white/[0.06] pl-1.5">
          {err && <div className="px-2 py-1 text-[11px] text-white/30">{err}</div>}
          {projects?.length === 0 && !err && <div className="px-2 py-1 text-[11px] text-white/30">no projects</div>}
          {projects?.map((p) => (
            <ProjectNode key={p.id} project={p} source={source} label={label} onOpen={onOpen} loadingId={loadingId} />
          ))}
        </div>
      )}
    </div>
  );
}

type LinkedProjectish = { id: string; name: string };

function ProjectNode({ project, source, label, onOpen, loadingId }: { project: LinkedProjectish; source: ProjectSessionSource; label: string; onOpen: OpenFn; loadingId: string | null }) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<LinkedSession[] | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && sessions === null) {
      const r = await source.listSessions(project.id);
      setSessions(r.ok ? (r.sessions ?? []) : []);
    }
  };

  return (
    <div>
      <Header label={project.name} open={open} onClick={toggle} dim />
      {open && (
        <div className="ml-2 border-l border-white/[0.06] pl-1.5">
          {sessions?.length === 0 && <div className="px-2 py-1 text-[11px] text-white/30">no sessions</div>}
          {sessions?.map((s) => (
            <button key={s.id} className={ROW} title={s.title} disabled={loadingId === s.title} onClick={() => onOpen(() => source.getSession(project.id, s.id), s.title, label, s.model)}>
              {loadingId === s.title ? "opening…" : s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Codex — flat sessions, no projects. */
function FlatTree({ label, source, onOpen, loadingId }: { label: string; source: GlobalSessionSource; onOpen: OpenFn; loadingId: string | null }) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<LinkedSession[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && sessions === null) {
      const r = await source.listSessions();
      if (r.ok) setSessions(r.sessions ?? []);
      else setErr(r.error || "unavailable");
    }
  };

  return (
    <div>
      <Header label={label} open={open} onClick={toggle} />
      {open && (
        <div className="ml-2 border-l border-white/[0.06] pl-1.5">
          {err && <div className="px-2 py-1 text-[11px] text-white/30">{err}</div>}
          {sessions?.length === 0 && !err && <div className="px-2 py-1 text-[11px] text-white/30">no sessions</div>}
          {sessions?.map((s) => (
            <button key={s.id} className={ROW} title={s.title} disabled={loadingId === s.title} onClick={() => onOpen(() => source.getSession(s.id), s.title, label, s.model)}>
              {loadingId === s.title ? "opening…" : s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ label, open, onClick, dim }: { label: string; open: boolean; onClick: () => void; dim?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={"w-full flex items-center gap-1.5 truncate rounded-md px-2 py-1 text-[12.5px] transition-colors hover:bg-white/[0.05] " + (dim ? "text-white/55 hover:text-white/85" : "text-white/75 hover:text-white font-medium")}
    >
      <span className={"text-white/30 transition-transform " + (open ? "rotate-90" : "")}>›</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
