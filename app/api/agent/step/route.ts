/**
 * POST /api/agent/step — one turn of the tool-use agent loop.
 *
 * This is the server half of Veronum's self-coding agent. The model's
 * API keys live here (server-side); the user's files live on their
 * disk (client-side). So the loop is STATELESS and turn-based, the
 * only architecture that keeps keys server-side while executing tools
 * on the client:
 *
 *   client → POST { provider, modelId, system, messages, tools }
 *   server → ONE provider round-trip
 *   server → { text, calls[], stopReason }
 *   client → executes calls locally (desktop bridge / in-memory),
 *            appends a tool turn, POSTs the next step
 *   …until stopReason !== "tool_use"
 *
 * Mirrors Claude Code's tool_use → tool_result loop exactly; we just
 * cut it at the HTTP boundary so each step is one request.
 *
 * Providers: Anthropic (Messages API `tools`) and the OpenAI family —
 * OpenAI, xAI, DeepSeek — (Chat Completions `tools`). Gemini is a
 * separate follow-up. Perplexity is search-grounded, not a coding
 * agent, so it's intentionally excluded from agent mode.
 */

import { findModel, providerKey, type ProviderId } from "@/lib/compare/models";
import { extractBearer, decideBilling } from "@/lib/compare/billing";
import { AGENT_TOOLS, type ToolDef } from "@/lib/agent/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Neutral wire types (client ⇄ server) ─────────────────────────
type ToolCall = { id: string; name: string; input: Record<string, unknown> };
type ToolResult = { id: string; name: string; content: string; isError?: boolean };
type AgentMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; calls: ToolCall[] }
  | { role: "tool"; results: ToolResult[] };

type StepResult = {
  text: string;
  calls: ToolCall[];
  stopReason: "tool_use" | "end" | "error";
  error?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Anthropic ────────────────────────────────────────────────────
async function stepAnthropic(
  model: string,
  key: string,
  system: string,
  messages: AgentMsg[],
  tools: ToolDef[],
): Promise<StepResult> {
  const anthropicMessages = messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "assistant") {
      const content: unknown[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const c of m.calls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      return { role: "assistant", content };
    }
    // tool results → a user turn carrying tool_result blocks
    return {
      role: "user",
      content: m.results.map((r) => ({
        type: "tool_result",
        tool_use_id: r.id,
        content: r.content,
        ...(r.isError ? { is_error: true } : {}),
      })),
    };
  });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system,
      messages: anthropicMessages,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    }),
  });
  if (!r.ok) {
    return { text: "", calls: [], stopReason: "error", error: `anthropic ${r.status}: ${(await r.text()).slice(0, 300)}` };
  }
  const data = (await r.json()) as {
    content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    stop_reason?: string;
  };
  let text = "";
  const calls: ToolCall[] = [];
  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text) text += block.text;
    else if (block.type === "tool_use" && block.id && block.name) {
      calls.push({ id: block.id, name: block.name, input: block.input ?? {} });
    }
  }
  return { text, calls, stopReason: data.stop_reason === "tool_use" ? "tool_use" : "end" };
}

// ── OpenAI family (openai / xai / deepseek) ──────────────────────
function openAIBase(provider: ProviderId): string {
  if (provider === "xai") return "https://api.x.ai/v1";
  if (provider === "deepseek") return "https://api.deepseek.com/v1";
  return "https://api.openai.com/v1";
}

async function stepOpenAIFamily(
  provider: ProviderId,
  model: string,
  key: string,
  system: string,
  messages: AgentMsg[],
  tools: ToolDef[],
): Promise<StepResult> {
  const oaMessages: unknown[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") oaMessages.push({ role: "user", content: m.text });
    else if (m.role === "assistant") {
      oaMessages.push({
        role: "assistant",
        content: m.text || null,
        ...(m.calls.length
          ? {
              tool_calls: m.calls.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      });
    } else {
      // one {role:tool} message per result, tool_call_id must match
      for (const r of m.results) {
        oaMessages.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
    }
  }

  const r = await fetch(`${openAIBase(provider)}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: oaMessages,
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      })),
    }),
  });
  if (!r.ok) {
    return { text: "", calls: [], stopReason: "error", error: `${provider} ${r.status}: ${(await r.text()).slice(0, 300)}` };
  }
  const data = (await r.json()) as {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
      finish_reason?: string;
    }>;
  };
  const msg = data.choices?.[0]?.message;
  const text = msg?.content ?? "";
  const calls: ToolCall[] = [];
  for (const tc of msg?.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(tc.function.arguments || "{}"); } catch { /* leave empty */ }
    calls.push({ id: tc.id, name: tc.function.name, input });
  }
  return { text, calls, stopReason: calls.length ? "tool_use" : "end" };
}

export async function POST(req: Request): Promise<Response> {
  let body: {
    modelId?: string;
    system?: string;
    messages?: AgentMsg[];
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // Auth + quota gate. Agent steps spend tokens, so the same billing
  // decision the compare route uses applies here — 401 if not signed
  // in, 402 if over the free-trial / plan quota. (Per-token tallying
  // for agent steps is a follow-up: bill at the model's price like
  // the compare route's after()-logged meter.)
  const token = extractBearer(req);
  const decision = await decideBilling(token);
  if (!decision.ok) {
    return json(
      { error: decision.reason, ...("detail" in decision && decision.detail ? { detail: decision.detail } : {}) },
      decision.httpStatus,
    );
  }

  const modelId = String(body.modelId ?? "").trim();
  const model = findModel(modelId);
  if (!model) return json({ error: "unknown_model", detail: modelId }, 400);

  if (model.provider === "perplexity" || model.provider === "gemini") {
    return json({ error: "provider_no_agent", detail: `${model.provider} is not wired for agent mode yet` }, 400);
  }

  const key = providerKey(model.provider);
  if (!key) return json({ error: "provider_key_missing", detail: model.provider }, 400);

  const system = typeof body.system === "string" && body.system ? body.system : "You are a coding agent.";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: "no_messages" }, 400);

  try {
    const result =
      model.provider === "anthropic"
        ? await stepAnthropic(model.model, key, system, messages, AGENT_TOOLS)
        : await stepOpenAIFamily(model.provider, model.model, key, system, messages, AGENT_TOOLS);
    return json(result);
  } catch (e) {
    return json({ text: "", calls: [], stopReason: "error", error: e instanceof Error ? e.message : "step_failed" }, 200);
  }
}
