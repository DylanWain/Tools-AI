"use client";

/**
 * LinkedSources — sidebar section that surfaces the user's coding-tool
 * sessions (Claude Code, Cursor, Codex) read straight off disk through
 * the desktop bridge (window.veronumDesktop.{claudeCode,cursor,codex}).
 *
 * Renders nothing in a plain browser or an old desktop build (sessionReaders()
 * returns null). Lazy: a source loads its projects only when expanded, a
 * project loads its sessions only when expanded. Clicking a session opens a
 * read-only viewer. Read-only — Veronum never writes to ~/.claude/.cursor/.codex.
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

type Viewing = { title: string; loading: boolean; messages: LinkedMessage[]; error?: string };
type OpenFn = (load: () => Promise<LinkedSessionContent>, title: string) => void;

const ROW = "w-full text-left truncate rounded-md px-2 py-1 text-[12.5px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors";

export function LinkedSources() {
  const [readers] = useState(sessionReaders);
  const [open, setOpen] = useState(true);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  if (!readers) return null;

  const openSession: OpenFn = async (load, title) => {
    setViewing({ title, loading: true, messages: [] });
    try {
      const r = await load();
      setViewing(r.ok
        ? { title: r.title || title, loading: false, messages: r.messages || [] }
        : { title, loading: false, messages: [], error: r.error || "could not read session" });
    } catch (e) {
      setViewing({ title, loading: false, messages: [], error: e instanceof Error ? e.message : "error" });
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
          {readers.claudeCode && <ProjectTree label="Claude Code" source={readers.claudeCode} onOpen={openSession} />}
          {readers.cursor && <ProjectTree label="Cursor" source={readers.cursor} onOpen={openSession} />}
          {readers.codex && <FlatTree label="Codex" source={readers.codex} onOpen={openSession} />}
        </div>
      )}
      {viewing && <SessionViewer v={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** Claude Code / Cursor — project → sessions. */
function ProjectTree({ label, source, onOpen }: { label: string; source: ProjectSessionSource; onOpen: OpenFn }) {
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
            <ProjectNode key={p.id} project={p} source={source} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

type LinkedProjectish = { id: string; name: string };

function ProjectNode({ project, source, onOpen }: { project: LinkedProjectish; source: ProjectSessionSource; onOpen: OpenFn }) {
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
            <button key={s.id} className={ROW} title={s.title} onClick={() => onOpen(() => source.getSession(project.id, s.id), s.title)}>
              {s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Codex — flat sessions, no projects. */
function FlatTree({ label, source, onOpen }: { label: string; source: GlobalSessionSource; onOpen: OpenFn }) {
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
            <button key={s.id} className={ROW} title={s.title} onClick={() => onOpen(() => source.getSession(s.id), s.title)}>
              {s.title}
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

function SessionViewer({ v, onClose }: { v: Viewing; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-[760px] max-h-[82vh] flex flex-col rounded-2xl bg-[#161616] border border-white/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="text-white/90 text-[14px] font-medium truncate pr-4">{v.title}</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-[15px] leading-none">✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {v.loading && <div className="text-white/40 text-[13px]">loading…</div>}
          {v.error && <div className="text-red-300/90 text-[13px]">{v.error}</div>}
          {!v.loading && !v.error && v.messages.length === 0 && <div className="text-white/40 text-[13px]">empty session</div>}
          {v.messages.map((m, i) => (
            <div key={m.id ?? i}>
              <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">{m.role}</div>
              <div className="text-white/85 text-[13.5px] leading-[1.55] whitespace-pre-wrap break-words">{m.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
