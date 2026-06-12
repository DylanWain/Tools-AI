"use client";

/**
 * AgentRunner — Veronum's self-coding agent surface.
 *
 * Pick a model, type a task, choose a permission mode (Accept/Skip per
 * change, or Bypass = auto-accept everything — exactly Claude Code's
 * by-the-composer control), and the agent edits the loaded workspace
 * through the tool loop. Mutating tools pause for approval in
 * accept-skip mode; a Push-to-git button runs the Bash tool.
 *
 * Self-contained on purpose: it owns its composer + transcript and
 * never touches the compare-turn rendering, so it can't break the
 * other modes. It reads the workspace + writes edits through callbacks
 * the parent supplies (applyEdit goes to fileEdits AND, in desktop
 * mode, through to disk).
 */

import { useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { MODELS, type ProviderId } from "@/lib/compare/models";
import { runAgent, type AgentEvent, type PermissionMode } from "@/lib/agent/loop";
import type { AgentContext, ToolCall } from "@/lib/agent/executor";

// Agent mode runs against providers with a tool-use API wired in the
// step endpoint: Anthropic + the OpenAI family (OpenAI / xAI /
// DeepSeek). Perplexity and Gemini are excluded for now.
const AGENT_PROVIDERS: ReadonlySet<ProviderId> = new Set(["anthropic", "openai", "xai", "deepseek"]);

type Props = {
  /** path → content for the loaded workspace (source of truth for the
   *  agent's read/grep/glob). */
  files: Record<string, string>;
  /** Persist an edit: write to the in-memory workspace AND (desktop)
   *  through to disk. */
  applyEdit: (path: string, content: string) => void;
  /** Desktop bridge root id, or null in the browser (bash disabled). */
  desktopRootId: string | null;
  /** Provider keys available this server (to filter the model list). */
  availableProviders: ProviderId[];
  /** Optional project rules appended to the agent system prompt. */
  systemExtra?: string;
  /** Loaded folder/repo name, shown as a status pill. */
  projectName?: string;
  /** Re-pick the folder (desktop only). */
  onChangeFolder?: () => void | Promise<unknown>;
};

export function AgentRunner({ files, applyEdit, desktopRootId, availableProviders, systemExtra, projectName, onChangeFolder }: Props) {
  const availSet = new Set(availableProviders);
  const models = MODELS.filter((m) => AGENT_PROVIDERS.has(m.provider) && availSet.has(m.provider));
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<PermissionMode>("accept-skip");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<ToolCall | null>(null);
  const approvalRef = useRef<((ok: boolean) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fileCount = Object.keys(files).length;
  const canRun = !running && task.trim().length > 0 && modelId && fileCount > 0;

  async function getToken(): Promise<string | null> {
    const { data } = await getBrowserSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function run() {
    if (!canRun) return;
    const token = await getToken();
    if (!token) {
      setEvents([{ type: "error", message: "Sign in first — agent steps need an account." }]);
      return;
    }
    setRunning(true);
    setEvents([]);
    const abort = new AbortController();
    abortRef.current = abort;
    const context: AgentContext = {
      desktopRootId,
      files: () => files,
      applyEdit: async (path, content) => { applyEdit(path, content); return true; },
    };
    try {
      await runAgent({
        modelId,
        task: task.trim(),
        token,
        context,
        mode,
        systemExtra,
        signal: abort.signal,
        requestApproval: (call) =>
          new Promise<boolean>((resolve) => { setPending(call); approvalRef.current = resolve; }),
        onEvent: (e) => setEvents((prev) => [...prev, e]),
      });
    } finally {
      setRunning(false);
      setPending(null);
      abortRef.current = null;
    }
  }

  function decide(ok: boolean) {
    approvalRef.current?.(ok);
    approvalRef.current = null;
    setPending(null);
  }

  function stop() {
    abortRef.current?.abort();
    decide(false);
  }

  async function pushToGit() {
    if (running || !desktopRootId) return;
    setTask("Stage all changes, commit them with a clear conventional-commit message describing what changed, and push to the current git branch. Use the bash tool.");
    // Defer one tick so the task state lands before run reads it.
    setTimeout(() => { void run(); }, 0);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 lg:px-10 py-5 max-w-[1100px] mx-auto w-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-white font-serif text-[22px] mb-1">Agent</h2>
          <p className="text-white/55 text-[13px] leading-[1.5]">
            Editing <span className="font-mono text-white/80">{projectName ?? "your workspace"}</span> — reads + edits files with tools, runs git in the desktop app.
            {fileCount === 0 && <span className="text-[#d9a25f]"> Load a folder first — the agent has nothing to work on yet.</span>}
          </p>
        </div>
        {onChangeFolder && (
          <button
            onClick={() => { void onChangeFolder(); }}
            disabled={running}
            className="shrink-0 px-2.5 py-1.5 rounded-md text-[12px] text-white/65 border border-white/12 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Change folder
          </button>
        )}
      </div>

      {/* Transcript */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-4">
        {events.length === 0 && !running && (
          <div className="text-white/35 text-[13px] py-8 text-center">
            Describe a change. The agent will read files, propose edits you Accept or Skip, and can push to git.
          </div>
        )}
        {events.map((e, i) => (
          <AgentEventRow key={i} event={e} />
        ))}
        {running && !pending && <div className="text-white/45 text-[13px] animate-pulse">Thinking…</div>}
      </div>

      {/* Approval bar (accept-skip) */}
      {pending && (
        <div className="mb-3 rounded-xl border border-[#d9a25f]/40 bg-[#d9a25f]/[0.07] p-3">
          <div className="text-[12px] text-[#e7c690] mb-2 font-medium">
            {pending.name === "bash" ? "Run command?" : pending.name === "edit_file" ? "Apply edit?" : "Write file?"}
          </div>
          <pre className="text-[11.5px] text-white/80 font-mono bg-black/40 rounded-md p-2 mb-2 overflow-x-auto max-h-[160px] whitespace-pre-wrap">
            {describeCall(pending)}
          </pre>
          <div className="flex gap-2">
            <button onClick={() => decide(true)} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[#7eb472] text-black hover:bg-[#8fc283]">Accept</button>
            <button onClick={() => decide(false)} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-white/10 text-white/80 hover:bg-white/15">Skip</button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="rounded-2xl border border-white/12 bg-[#161616] p-3">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the change — e.g. 'add a dark-mode toggle to the header'"
          rows={2}
          disabled={running}
          className="w-full bg-transparent resize-none outline-none text-[14px] text-white/95 placeholder:text-white/30 px-1 py-1"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }}
        />
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={running}
            className="bg-[#0f0f0f] border border-white/10 rounded-md px-2.5 py-1.5 text-[12.5px] text-white/85 outline-none"
          >
            {models.length === 0 && <option value="">No agent-capable model available</option>}
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as PermissionMode)}
            disabled={running}
            title="Ask = approve each edit/command. Auto = it just does everything without asking."
            className="bg-[#0f0f0f] border border-white/10 rounded-md px-2.5 py-1.5 text-[12.5px] text-white/85 outline-none"
          >
            <option value="accept-skip">Ask — approve each action</option>
            <option value="bypass">Auto — just do it</option>
          </select>
          <div className="flex-1" />
          {desktopRootId && (
            <button
              onClick={pushToGit}
              disabled={running}
              title="Commit and push the current changes"
              className="px-3 py-1.5 rounded-md text-[13px] text-white/70 border border-white/12 hover:bg-white/[0.06] disabled:opacity-40"
            >
              Push to git
            </button>
          )}
          {running ? (
            <button onClick={stop} className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-white/10 text-white/80 hover:bg-white/15">Stop</button>
          ) : (
            <button onClick={run} disabled={!canRun} className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-[#d97757] text-white hover:bg-[#c6613f] disabled:opacity-40">
              Run
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function describeCall(call: ToolCall): string {
  if (call.name === "bash") return `$ ${String(call.input.command ?? "")}`;
  if (call.name === "edit_file") {
    return `${call.input.path}\n\n- ${String(call.input.old_string ?? "").slice(0, 400)}\n+ ${String(call.input.new_string ?? "").slice(0, 400)}`;
  }
  if (call.name === "write_file") {
    return `${call.input.path}\n\n${String(call.input.content ?? "").slice(0, 600)}`;
  }
  return JSON.stringify(call.input, null, 2);
}

function AgentEventRow({ event }: { event: AgentEvent }) {
  if (event.type === "assistant") {
    if (!event.text && event.calls.length === 0) return null;
    return (
      <div className="text-[14px] text-white/90 leading-[1.6] whitespace-pre-wrap">
        {event.text}
        {event.calls.map((c) => (
          <div key={c.id} className="mt-1 text-[12px] font-mono text-white/45">→ {c.name}({c.name === "bash" ? String(c.input.command ?? "") : String(c.input.path ?? c.input.pattern ?? "")})</div>
        ))}
      </div>
    );
  }
  if (event.type === "tool-result") {
    const bad = event.result.isError;
    return (
      <div className={`text-[11.5px] font-mono pl-3 border-l-2 ${event.skipped ? "border-white/20 text-white/40" : bad ? "border-red-400/50 text-red-300/80" : "border-[#7eb472]/40 text-white/55"}`}>
        {event.skipped ? "skipped" : event.result.content.slice(0, 300)}
      </div>
    );
  }
  if (event.type === "done") {
    return <div className="text-[12px] text-[#7eb472]/80 mt-1">✓ Done in {event.steps} step{event.steps === 1 ? "" : "s"}.</div>;
  }
  if (event.type === "error") {
    return <div className="text-[12.5px] text-red-300/90">⚠ {event.message}</div>;
  }
  return null;
}
