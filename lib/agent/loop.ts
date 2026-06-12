/**
 * The agent loop — drives /api/agent/step, executes the returned tool
 * calls locally, feeds results back, repeats until the model stops.
 *
 * Stateless on the server, stateful here: this module owns the
 * growing message list and the per-step orchestration. It emits
 * events so the UI can render the transcript live (assistant text,
 * each tool call + its result, approvals, completion).
 *
 * Permission model mirrors Claude Code:
 *   - "accept-skip": every mutating tool (edit/write/bash) pauses for
 *     the user's OK via requestApproval. A skip returns a tool_result
 *     telling the model the user declined, so it can adapt.
 *   - "bypass": nothing pauses — edits and commands apply as the model
 *     emits them.
 * Read-only tools (read/grep/glob) never pause in either mode.
 */

import { AGENT_SYSTEM_PROMPT, MUTATING_TOOLS, type ToolName } from "./tools";
import { executeTool, type AgentContext, type ToolCall, type ToolResult } from "./executor";

export type PermissionMode = "accept-skip" | "bypass";

type AgentMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; calls: ToolCall[] }
  | { role: "tool"; results: ToolResult[] };

export type AgentEvent =
  | { type: "assistant"; text: string; calls: ToolCall[] }
  | { type: "approval-request"; call: ToolCall }
  | { type: "tool-result"; call: ToolCall; result: ToolResult; skipped: boolean }
  | { type: "done"; summary: string; steps: number }
  | { type: "error"; message: string };

export type RunAgentArgs = {
  modelId: string;
  task: string;
  /** Returns a FRESH auth token for each step. A long run (e.g. a 2-min
   *  npm install) can outlive a token grabbed once at the start, which
   *  is what caused mid-run `step 401: invalid_token`. Supabase's
   *  getSession() auto-refreshes, so calling it per step keeps the
   *  token valid the whole way through. */
  getToken: () => Promise<string | null>;
  context: AgentContext;
  mode: PermissionMode;
  /** Resolve true to run a mutating tool, false to skip. Only called
   *  in accept-skip mode. */
  requestApproval: (call: ToolCall) => Promise<boolean>;
  onEvent: (e: AgentEvent) => void;
  /** Optional extra system text (project rules) appended to the
   *  agent's house prompt. */
  systemExtra?: string;
  /** Safety cap on loop iterations. Default 25 — enough for a real
   *  multi-file task, low enough to bound a runaway. */
  maxSteps?: number;
  /** Abort signal so the UI can cancel a running agent. */
  signal?: AbortSignal;
};

async function fetchStep(args: {
  modelId: string;
  system: string;
  messages: AgentMsg[];
  token: string | null;
  signal?: AbortSignal;
}): Promise<{ text: string; calls: ToolCall[]; stopReason: string; error?: string }> {
  if (!args.token) {
    return { text: "", calls: [], stopReason: "error", error: "Signed out — sign in and try again." };
  }
  const r = await fetch("/api/agent/step", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({ modelId: args.modelId, system: args.system, messages: args.messages }),
    signal: args.signal,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    return { text: "", calls: [], stopReason: "error", error: `step ${r.status}: ${detail.slice(0, 200)}` };
  }
  return r.json();
}

export async function runAgent(args: RunAgentArgs): Promise<void> {
  const system = args.systemExtra
    ? `${AGENT_SYSTEM_PROMPT}\n\n# This project's conventions\n${args.systemExtra}`
    : AGENT_SYSTEM_PROMPT;
  const maxSteps = args.maxSteps ?? 25;
  const messages: AgentMsg[] = [{ role: "user", text: args.task }];

  for (let step = 0; step < maxSteps; step++) {
    if (args.signal?.aborted) {
      args.onEvent({ type: "error", message: "Cancelled." });
      return;
    }

    // Fresh token PER step — long runs (npm install, builds) outlive a
    // single token, which caused mid-run invalid_token. getToken()
    // returns an auto-refreshed token from the Supabase client.
    const token = await args.getToken().catch(() => null);
    const res = await fetchStep({
      modelId: args.modelId,
      system,
      messages,
      token,
      signal: args.signal,
    }).catch((e) => ({ text: "", calls: [], stopReason: "error", error: (e as Error).message }));

    if (res.stopReason === "error") {
      args.onEvent({ type: "error", message: res.error ?? "Agent step failed." });
      return;
    }

    messages.push({ role: "assistant", text: res.text, calls: res.calls });
    args.onEvent({ type: "assistant", text: res.text, calls: res.calls });

    // No tool calls → the model is done. Its text is the summary.
    if (res.stopReason !== "tool_use" || res.calls.length === 0) {
      args.onEvent({ type: "done", summary: res.text, steps: step + 1 });
      return;
    }

    const results: ToolResult[] = [];
    for (const call of res.calls) {
      const mutating = MUTATING_TOOLS.has(call.name as ToolName);
      if (args.mode === "accept-skip" && mutating) {
        args.onEvent({ type: "approval-request", call });
        const approved = await args.requestApproval(call);
        if (!approved) {
          const result: ToolResult = {
            id: call.id,
            name: call.name,
            content: "User skipped this action. Continue without it or propose an alternative.",
          };
          results.push(result);
          args.onEvent({ type: "tool-result", call, result, skipped: true });
          continue;
        }
      }
      const result = await executeTool(call, args.context);
      results.push(result);
      args.onEvent({ type: "tool-result", call, result, skipped: false });
    }
    messages.push({ role: "tool", results });
  }

  args.onEvent({ type: "error", message: `Reached the ${maxSteps}-step limit without finishing.` });
}
