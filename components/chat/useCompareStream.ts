"use client";

/**
 * useCompareStream — fires N parallel POSTs to /api/compare (one per
 * slot) and exposes per-slot streaming state to the UI.
 *
 * A "slot" is one dispatch — { id, modelId, prompt }. The id is the
 * stable key the response box subscribes to.
 *   - Compare mode: id === modelId, every slot has the same prompt
 *   - Multi-agent mode: id is `agent-${idx}`, each slot has its own task
 *
 * Same underlying machinery for both — independent parallel fetches,
 * Promise.allSettled so one failure doesn't kill the others.
 */

import { useCallback, useRef, useState } from "react";
import type { WireAttachment } from "@/lib/compare/attachments";
import type { ChatMessage } from "@/lib/compare/stream";
import { getBrowserSupabase } from "@/lib/supabase";

export type RunState = {
  status: "idle" | "streaming" | "done" | "error";
  text: string;
  error?: string;
  /** Distinct error codes the UI cares about. "over_quota" / "auth"
   *  flip the workspace into paywall / sign-in mode. Generic upstream
   *  errors leave it alone — the card shows the error inline. */
  errorKind?: "auth" | "over_quota" | "upstream" | "network";
  /** Server-supplied paywall context — present iff errorKind === "over_quota". */
  consumedCents?: number;
  freeTrialCents?: number;
  userId?: string;
  startedAt?: number;
  finishedAt?: number;
  modelId?: string;   // recorded per-slot so loaded sessions can re-render properly
  task?: string;      // the prompt that was sent (per-slot in multi-agent)
};

export type RunSlot = {
  id: string;       // stable key for the response box
  modelId: string;  // upstream model identifier
  prompt: string;   // this slot's prompt / task
  /** Optional: pre-built system prompt. Multi-agent workflow mode uses
   *  this to inject peer-awareness + master goal context. Falls back
   *  to the default helpful-assistant system prompt when absent. */
  systemPrompt?: string;
  /** Multi-agent workflow only: distinguishes worker slots from the
   *  appended synthesizer slot in the response grid. */
  role?: "worker" | "synthesizer";
  /** User-supplied files / images for this slot. Each provider builds
   *  its own multimodal payload from these on the server side. */
  attachments?: WireAttachment[];
  /** Multi-turn history BEFORE the current prompt. In compare mode the
   *  caller builds this per slot — for each prior assistant turn that
   *  had a "picked" winner card, only that winner's text is included.
   *  When omitted/empty, the request collapses to single-turn behavior. */
  prevTurns?: ChatMessage[];
  /** Analytics — the compare-session id this Send belongs to. Lets the
   *  /admin dashboard group the N parallel-fanout events back into a
   *  single logical user Send. */
  sessionId?: string;
  /** Analytics — 0-indexed turn number within the session. */
  turnIndex?: number;
  /** Analytics — mode label for the event ('compare' or 'agents'). */
  mode?: "compare" | "agents";
};

type RunsBySlot = Record<string, RunState>;
const EMPTY: RunState = { status: "idle", text: "" };

export function useCompareStream() {
  const [runs, setRuns] = useState<RunsBySlot>({});
  const [lastSlots, setLastSlots] = useState<RunSlot[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (slots: RunSlot[]) => {
    if (slots.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLastSlots(slots);

    // Reset run state for this batch.
    setRuns(() => {
      const next: RunsBySlot = {};
      for (const s of slots) {
        next[s.id] = {
          status: "streaming",
          text: "",
          startedAt: Date.now(),
          modelId: s.modelId,
          task: s.prompt,
        };
      }
      return next;
    });

    await Promise.allSettled(
      slots.map((s) => runOne(s, ac.signal, setRuns)),
    );
  }, []);

  /**
   * Multi-agent workflow run. Pattern lifted from the Tools-AI VS Code
   * extension v2.0.9 (extension.js runHierarchy):
   *
   *   1. Fan out N "worker" slots in parallel — each gets a system
   *      prompt that names the master goal + every peer's task, so
   *      every model knows what the others are doing.
   *   2. If synthesize=true, after all workers finish, append one
   *      "synthesizer" slot that gets the goal + every worker's full
   *      output and produces ONE unified final answer.
   *
   * Each phase streams independently into the runs map keyed by slot.id,
   * so the UI sees live tokens as they arrive.
   */
  const startWorkflow = useCallback(async (input: {
    goal: string;
    /** Analytics — the compare session this multi-agent run belongs to.
     *  Used to group worker rows in the admin dashboard. */
    sessionId?: string;
    workers: Array<{
      id: string;
      modelId: string;
      modelLabel: string;
      task: string;
      /** Code mode: file paths this agent owns. Listed in every peer's
       *  system prompt so others stay out of these. */
      files?: string[];
      /** Code mode: optional fine-grained ownership (e.g. "lines 1-50"). */
      lineRange?: string;
      /** User-attached files / images. Every agent in a batch gets
       *  the same set (they share the master goal). */
      attachments?: WireAttachment[];
    }>;
    synthesize: boolean;
    synthesizerModelId?: string;     // defaults to the first worker's model
    synthesizerModelLabel?: string;
    /** Code mode toggle. When true, system prompts instruct agents to
     *  output strictly via ```lang:path code blocks, AND each agent is
     *  told which files every peer owns so it stays out of their lane. */
    codeMode?: boolean;
  }) => {
    if (input.workers.length === 0 || !input.goal.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Peer list — what each teammate is tasked with. In code mode we
    // also list each peer's owned files + line ranges so every agent
    // knows where it MUST NOT trespass.
    const peerLines = input.workers
      .map((w, i) => {
        const head = `- Agent ${i + 1} (${w.modelLabel}): ${w.task}`;
        if (!input.codeMode) return head;
        const files = (w.files ?? []).filter((f) => f.trim()).join(", ");
        const lines = w.lineRange ? ` (lines: ${w.lineRange.trim()})` : "";
        return files
          ? `${head}\n    Owns files: ${files}${lines}`
          : `${head}\n    (no files declared)`;
      })
      .join("\n");

    const codeOutputSpec = input.codeMode
      ? `\n\nOUTPUT FORMAT (strict):\n` +
        `Produce one or more Markdown code blocks. EVERY block MUST have a "language:filepath" header so the system can route the code to the right file in the shared project tree. Example:\n\n` +
        "```ts:app/login/page.tsx\nexport default function LoginPage() { ... }\n```\n\n" +
        "```css:app/globals.css\n.container { ... }\n```\n\n" +
        `RULES:\n` +
        `- Only write to files you OWN (listed below). Touching another agent's files will be flagged as a conflict.\n` +
        `- If you realize you need to modify a peer's file, do NOT do it — instead, end your response with a short note explaining what the peer should change.\n` +
        `- Prose between code blocks is fine — it won't be parsed into files.\n`
      : "";

    // Phase 1: workers, each with peer-aware system prompt.
    const workerSlots: RunSlot[] = input.workers.map((w, i) => {
      const myFiles = (w.files ?? []).filter((f) => f.trim());
      const ownership = input.codeMode
        ? `\n\nYour owned files: ${myFiles.length ? myFiles.join(", ") : "(none — output prose only)"}` +
          (w.lineRange ? `\nYour line range within shared files: ${w.lineRange.trim()}` : "")
        : "";
      return {
        id: w.id,
        modelId: w.modelId,
        prompt: w.task,
        role: "worker",
        attachments: w.attachments,
        sessionId: input.sessionId,
        turnIndex: 0,
        mode: "agents",
        systemPrompt:
          `You are Agent ${i + 1} (${w.modelLabel}) on a multi-model team working toward the SAME common goal.\n\n` +
          `Common goal:\n${input.goal.trim()}\n\n` +
          `Your peers are running in parallel right now. Their tasks and ownership:\n${peerLines}\n\n` +
          `YOUR specific task: ${w.task}` +
          ownership +
          codeOutputSpec +
          (input.codeMode
            ? `\n\nFocus entirely on your owned files. Every other agent is told the same thing — trust them to handle their slice.`
            : `\n\nFocus entirely on your slice. Be thorough. Your output will be read by a master synthesizer who will integrate every agent's response into one final answer for the user.`),
      };
    });

    const synthesizerSlot: RunSlot | null = input.synthesize
      ? {
          id: "synthesizer",
          modelId: input.synthesizerModelId ?? input.workers[0].modelId,
          modelLabel: undefined as never,
          prompt: input.goal.trim(),
          role: "synthesizer",
          systemPrompt: "",  // filled in after workers finish (needs their outputs)
        } as RunSlot
      : null;

    // Seed the runs map with all slots up front so the UI lays out the
    // grid before any tokens arrive. Synthesizer starts as 'idle' and
    // flips to 'streaming' only after workers complete.
    const allSlots: RunSlot[] = synthesizerSlot ? [...workerSlots, synthesizerSlot] : workerSlots;
    setLastSlots(allSlots);
    setRuns(() => {
      const next: RunsBySlot = {};
      for (const s of workerSlots) {
        next[s.id] = {
          status: "streaming", text: "", startedAt: Date.now(),
          modelId: s.modelId, task: s.prompt,
        };
      }
      if (synthesizerSlot) {
        next[synthesizerSlot.id] = {
          status: "idle", text: "",
          modelId: synthesizerSlot.modelId, task: input.goal.trim(),
        };
      }
      return next;
    });

    // Run workers.
    await Promise.allSettled(workerSlots.map((s) => runOne(s, ac.signal, setRuns)));

    if (ac.signal.aborted || !synthesizerSlot) return;

    // Phase 2: synthesizer. Build a system prompt that contains every
    // worker's actual output, so the synthesizer can't make things up.
    // Read the just-finished worker outputs from the *current* state by
    // snapshotting via a functional setRuns call.
    let workerOutputs: Array<{ label: string; task: string; text: string; error?: string }> = [];
    setRuns((prev) => {
      workerOutputs = input.workers.map((w, i) => ({
        label: `Agent ${i + 1} (${w.modelLabel})`,
        task: w.task,
        text: prev[w.id]?.text ?? "",
        error: prev[w.id]?.error,
      }));
      // Flip the synth slot to streaming
      return {
        ...prev,
        [synthesizerSlot.id]: {
          ...(prev[synthesizerSlot.id] ?? EMPTY),
          status: "streaming",
          startedAt: Date.now(),
          text: "",
        },
      };
    });

    const outputsBlock = workerOutputs
      .map((w) =>
        w.error
          ? `=== ${w.label} ===\nTask: ${w.task}\n\n(failed: ${w.error})`
          : `=== ${w.label} ===\nTask: ${w.task}\n\n${w.text || "(no output)"}`,
      )
      .join("\n\n---\n\n");

    const synthSys =
      `You are the master synthesizer for a multi-model AI team. Your team has just completed their assigned sub-tasks toward this common goal:\n\n` +
      `${input.goal.trim()}\n\n` +
      `Here is every team member's full output, verbatim:\n\n` +
      `${outputsBlock}\n\n` +
      `Your job: review every output critically and produce ONE unified final answer that addresses the common goal. ` +
      `Reconcile any conflicts between team members. Integrate the best of each output. ` +
      `Do NOT hallucinate — only use what the team actually produced above. ` +
      `If the team's work is contradictory or incomplete, say so honestly.`;

    const synthRunSlot: RunSlot = {
      ...synthesizerSlot,
      prompt: input.goal.trim(),
      systemPrompt: synthSys,
    };
    await runOne(synthRunSlot, ac.signal, setRuns);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setRuns((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].status === "streaming") {
          next[id] = { ...next[id], status: "done", finishedAt: Date.now() };
        }
      }
      return next;
    });
  }, []);

  const replaceState = useCallback((newRuns: RunsBySlot, newSlots: RunSlot[]) => {
    abortRef.current?.abort();
    setRuns(newRuns);
    setLastSlots(newSlots);
  }, []);

  return {
    runs,
    start,
    startWorkflow,
    cancel,
    replaceState,
    lastSlots,
    getRun: (id: string) => runs[id] ?? EMPTY,
  };
}

async function runOne(
  slot: RunSlot,
  signal: AbortSignal,
  setRuns: React.Dispatch<React.SetStateAction<RunsBySlot>>,
) {
  const patch = (p: Partial<RunState>) =>
    setRuns((prev) => ({
      ...prev,
      [slot.id]: { ...(prev[slot.id] ?? EMPTY), ...p },
    }));

  try {
    // Attach the Supabase access token so /api/compare can validate
    // the caller, look up their billing state, and either gate or
    // charge them. Anonymous calls get a 401 back, which we surface
    // to the UI as `errorKind: "auth"` so the workspace can flip to
    // the sign-in prompt.
    const supabase = getBrowserSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const r = await fetch("/api/compare", {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: slot.prompt,
        modelId: slot.modelId,
        ...(slot.systemPrompt ? { systemPrompt: slot.systemPrompt } : {}),
        ...(slot.attachments && slot.attachments.length
          ? { attachments: slot.attachments }
          : {}),
        ...(slot.prevTurns && slot.prevTurns.length
          ? { prevTurns: slot.prevTurns }
          : {}),
        ...(slot.sessionId ? { sessionId: slot.sessionId } : {}),
        ...(typeof slot.turnIndex === "number" ? { turnIndex: slot.turnIndex } : {}),
        ...(slot.mode ? { mode: slot.mode } : {}),
      }),
      signal,
    });
    if (!r.ok || !r.body) {
      // Try to parse the structured error body — auth and paywall
      // responses carry context the UI uses to render its prompts.
      let errBody: {
        error?: string;
        detail?: string;
        userId?: string;
        consumedCents?: number;
        freeTrialCents?: number;
      } = {};
      try { errBody = await r.json(); } catch { /* non-JSON error */ }
      const code = errBody.error ?? "";
      let errorKind: RunState["errorKind"] = "upstream";
      if (r.status === 401 || code === "unauthenticated" || code === "invalid_token") {
        errorKind = "auth";
      } else if (r.status === 402 || code === "over_quota") {
        errorKind = "over_quota";
      }
      // Prefer the detailed actionable message when the server sent one
      // (e.g. lookup_failed → "SUPABASE_SERVICE_ROLE_KEY missing …").
      // Falls back to the bare code so the user always sees something.
      const message = errBody.detail
        ? `${code}: ${errBody.detail}`
        : code || `HTTP ${r.status}`;
      patch({
        status: "error",
        error: message,
        errorKind,
        consumedCents: errBody.consumedCents,
        freeTrialCents: errBody.freeTrialCents,
        userId: errBody.userId,
        finishedAt: Date.now(),
      });
      return;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let acc = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim()) as { text?: string; error?: string; done?: boolean };
            if (json.error) {
              patch({ status: "error", error: json.error, finishedAt: Date.now() });
              return;
            }
            if (json.text) {
              acc += json.text;
              patch({ text: acc });
            }
            if (json.done) {
              patch({ status: "done", finishedAt: Date.now() });
              return;
            }
          } catch { /* skip malformed frame */ }
        }
      }
    }
    patch({ status: "done", finishedAt: Date.now() });
  } catch (err) {
    if (signal.aborted) return;
    patch({
      status: "error",
      error: err instanceof Error ? err.message : "network_failed",
      errorKind: "network",
      finishedAt: Date.now(),
    });
  }
}
