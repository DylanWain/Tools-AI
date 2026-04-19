/*
 * /api/v1/chat-tools — structured tool-calling endpoint.
 *
 * This is the Claude-Code-parity surface alongside the existing
 * /api/v1/chat (which stays untouched so current users aren't broken).
 * Unlike /chat, this endpoint speaks the native structured protocols
 * of each upstream provider:
 *
 *   - Anthropic Claude: `tools[]`, `tool_choice`, `cache_control`,
 *     native `tool_use` + `tool_result` content blocks.
 *   - OpenAI ChatGPT & xAI Grok: OpenAI function-calling
 *     (`tools: [{type: "function", function: {...}}]`, `tool_calls` in
 *     the streamed deltas).
 *   - Google Gemini: `tools: [{functionDeclarations: [...]}]`,
 *     `functionCall` parts in the stream.
 *   - Perplexity: does NOT support function calling upstream, so we
 *     fall back to injecting the tool schemas into the system prompt
 *     and parsing `<tool_call>` XML from the text stream. The client
 *     can't tell the difference — same normalized event shape out.
 *
 * All four paths emit the SAME normalized SSE events, so the client
 * parser in apps/desktop/src/agent/agentLoop.ts only has to learn one
 * shape:
 *
 *   data: {"event":"text","text":"..."}
 *   data: {"event":"tool_use","id":"...","name":"...","input":{...}}
 *   data: {"event":"done","stop_reason":"end_turn"|"tool_use"|"max_tokens"}
 *   data: {"event":"error","message":"..."}
 *
 * Auth + cap checking mirror /api/v1/chat exactly: Bearer tai-* in
 * Authorization header → looked up in Supabase `tai_keys` (must be
 * active=true). $10 cap enforced via `tai_usage.cost_cents`.
 *
 * Cache control (Anthropic only):
 *   The `system` string is marked with `cache_control: {type: "ephemeral"}`
 *   automatically. This is effectively free and cuts cost ~90% on the
 *   static prompt for agents that turn repeatedly.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://synpjcammfjebwsmtfpz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const OPENAI_KEY      = process.env.OPENAI_KEY!;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_KEY!;
const GEMINI_KEYS     = (process.env.GEMINI_KEYS || '').split(',').filter(Boolean);
const XAI_KEY         = process.env.XAI_KEY!;
const PERPLEXITY_KEY  = process.env.PERPLEXITY_KEY!;

const CAP_CENTS = 1000; // $10/month silent cap — matches /api/v1/chat
const MODEL_COST_CENTS: Record<string, number> = {
  chatgpt: 3, claude: 3, gemini: 1, grok: 3, perplexity: 2,
};

type ModelId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

/* ── Request shape ─────────────────────────────────────────────── */

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ChatToolsBody {
  model: ModelId;
  messages: Message[];
  system?: string;
  tools?: ToolDef[];
  tool_choice?: 'auto' | 'any' | { name: string };
  stream?: boolean;
  max_tokens?: number;
}

/* ── Auth + cap ────────────────────────────────────────────────── */

async function validateKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('tai-')) return false;
  const url = `${SUPABASE_URL}/rest/v1/tai_keys?api_key=eq.${encodeURIComponent(key)}&active=eq.true&select=active&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function checkCap(key: string): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await supabase
    .from('tai_usage')
    .select('cost_cents')
    .eq('api_key', key)
    .eq('month', month)
    .maybeSingle();
  return (data?.cost_cents || 0) < CAP_CENTS;
}

async function trackUsage(key: string, model: ModelId): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  const cost = MODEL_COST_CENTS[model] || 2;
  try { await supabase.rpc('increment_usage', { p_key: key, p_month: month, p_cost: cost }); }
  catch {
    await supabase.from('tai_usage').upsert(
      { api_key: key, month, cost_cents: cost },
      { onConflict: 'api_key,month', ignoreDuplicates: false },
    );
  }
}

/* ── Normalized SSE writer ─────────────────────────────────────── */

type SseEvent =
  | { event: 'text'; text: string }
  | { event: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { event: 'done'; stop_reason: string }
  | { event: 'error'; message: string };

function makeSender(res: NextApiResponse): (ev: SseEvent) => void {
  return (ev) => { res.write(`data: ${JSON.stringify(ev)}\n\n`); };
}

/* ── Message → provider-specific translation ───────────────────── */

/** Convert our canonical message shape to Anthropic's native content blocks. */
function toAnthropicMessages(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: unknown }> {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const blocks = m.content.map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      /* tool_result blocks go under a `user` message in Anthropic's protocol. */
      return { type: 'tool_result', tool_use_id: b.tool_use_id, content: b.content, is_error: b.is_error ?? false };
    });
    return { role: m.role, content: blocks };
  });
}

/** Convert our canonical shape to OpenAI's. Tool-result blocks become role='tool' messages. */
function toOpenAiMessages(messages: Message[], system?: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  if (system) out.push({ role: 'system', content: system });
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    /* Split multi-block messages: OpenAI only tolerates one shape per
     * entry, so we flatten per-block. */
    const textParts = m.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text');
    const toolUses = m.content.filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use');
    const toolResults = m.content.filter((b): b is { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean } => b.type === 'tool_result');

    if (m.role === 'assistant' && (textParts.length > 0 || toolUses.length > 0)) {
      out.push({
        role: 'assistant',
        content: textParts.map((t) => t.text).join('') || null,
        ...(toolUses.length > 0
          ? {
              tool_calls: toolUses.map((t) => ({
                id: t.id,
                type: 'function',
                function: { name: t.name, arguments: JSON.stringify(t.input) },
              })),
            }
          : {}),
      });
    }
    for (const r of toolResults) {
      out.push({ role: 'tool', tool_call_id: r.tool_use_id, content: r.content });
    }
    if (m.role === 'user' && textParts.length > 0 && toolResults.length === 0) {
      out.push({ role: 'user', content: textParts.map((t) => t.text).join('') });
    }
  }
  return out;
}

/** Convert to Gemini's `contents` format. Gemini uses 'user' + 'model' roles and
 * encodes tool results as functionResponse parts. */
function toGeminiContents(messages: Message[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (typeof m.content === 'string') {
      out.push({ role, parts: [{ text: m.content }] });
      continue;
    }
    const parts: Array<Record<string, unknown>> = [];
    for (const b of m.content) {
      if (b.type === 'text') parts.push({ text: b.text });
      else if (b.type === 'tool_use') parts.push({ functionCall: { name: b.name, args: b.input } });
      else if (b.type === 'tool_result') {
        let parsed: unknown = b.content;
        try { parsed = JSON.parse(b.content); } catch { /* keep string */ }
        parts.push({ functionResponse: { name: b.tool_use_id, response: parsed } });
      }
    }
    if (parts.length > 0) out.push({ role, parts });
  }
  return out;
}

/* ── Per-provider streamers ────────────────────────────────────── */

async function streamAnthropicTools(
  body: ChatToolsBody,
  send: (ev: SseEvent) => void,
): Promise<void> {
  const sysBlocks: Array<Record<string, unknown>> = [];
  if (body.system) {
    /* cache_control: ephemeral caches the system prompt for 5 minutes
     * across turns. ~90% cost reduction on the scaffolding when an
     * agent fires multiple turns in a row. */
    sysBlocks.push({ type: 'text', text: body.system, cache_control: { type: 'ephemeral' } });
  }

  const req: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    max_tokens: body.max_tokens ?? 8192,
    system: sysBlocks,
    messages: toAnthropicMessages(body.messages),
    stream: true,
  };
  if (body.tools && body.tools.length > 0) {
    req.tools = body.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  }
  if (body.tool_choice) {
    req.tool_choice = body.tool_choice === 'auto'
      ? { type: 'auto' }
      : body.tool_choice === 'any'
        ? { type: 'any' }
        : { type: 'tool', name: body.tool_choice.name };
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    send({ event: 'error', message: `Anthropic HTTP ${res.status}: ${text.slice(0, 200)}` });
    return;
  }

  /* Accumulate partial tool_use input JSON — Anthropic streams it as
   * `input_json_delta` chunks that must be concatenated and parsed
   * once the content block stops. */
  const toolUseStash = new Map<number, { id: string; name: string; input: string }>();
  let stopReason = 'end_turn';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() || '';
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const p = JSON.parse(raw) as Record<string, unknown>;
          if (p.type === 'content_block_start' && p.content_block) {
            const block = p.content_block as Record<string, unknown>;
            const idx = p.index as number;
            if (block.type === 'tool_use') {
              toolUseStash.set(idx, { id: String(block.id), name: String(block.name), input: '' });
            }
          } else if (p.type === 'content_block_delta' && p.delta) {
            const delta = p.delta as Record<string, unknown>;
            const idx = p.index as number;
            if (delta.type === 'text_delta' && typeof delta.text === 'string') {
              send({ event: 'text', text: delta.text });
            } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
              const stash = toolUseStash.get(idx);
              if (stash) stash.input += delta.partial_json;
            }
          } else if (p.type === 'content_block_stop') {
            const idx = p.index as number;
            const stash = toolUseStash.get(idx);
            if (stash) {
              let input: Record<string, unknown> = {};
              try { input = stash.input ? (JSON.parse(stash.input) as Record<string, unknown>) : {}; }
              catch { /* empty args */ }
              send({ event: 'tool_use', id: stash.id, name: stash.name, input });
              toolUseStash.delete(idx);
            }
          } else if (p.type === 'message_delta' && p.delta) {
            const delta = p.delta as Record<string, unknown>;
            if (typeof delta.stop_reason === 'string') stopReason = delta.stop_reason;
          }
        } catch { /* ignore malformed frame */ }
      }
    }
  }
  send({ event: 'done', stop_reason: stopReason });
}

async function streamOpenAiTools(
  body: ChatToolsBody,
  send: (ev: SseEvent) => void,
  key: string,
  url: string,
  model: string,
): Promise<void> {
  const req: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(body.messages, body.system),
    max_tokens: body.max_tokens ?? 4096,
    temperature: 0.7,
    stream: true,
  };
  if (body.tools && body.tools.length > 0) {
    req.tools = body.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }
  if (body.tool_choice) {
    req.tool_choice = body.tool_choice === 'auto'
      ? 'auto'
      : body.tool_choice === 'any'
        ? 'required'
        : { type: 'function', function: { name: body.tool_choice.name } };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    send({ event: 'error', message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
    return;
  }

  /* OpenAI streams tool_calls deltas with partial .function.arguments;
   * we accumulate per index and emit a tool_use event on the first
   * content_delta that doesn't extend that index (or on finish). */
  const pendingTools = new Map<number, { id: string; name: string; args: string }>();
  let stopReason = 'end_turn';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() || '';
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') {
          for (const [, t] of pendingTools) {
            let input: Record<string, unknown> = {};
            try { input = t.args ? (JSON.parse(t.args) as Record<string, unknown>) : {}; }
            catch { /* drop */ }
            send({ event: 'tool_use', id: t.id, name: t.name, input });
          }
          pendingTools.clear();
          continue;
        }
        try {
          const p = JSON.parse(raw) as Record<string, unknown>;
          const choices = p.choices as Array<Record<string, unknown>> | undefined;
          if (!choices || choices.length === 0) continue;
          const c0 = choices[0]!;
          const delta = (c0.delta as Record<string, unknown> | undefined) ?? {};
          if (typeof delta.content === 'string' && delta.content) {
            send({ event: 'text', text: delta.content });
          }
          const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
          if (toolCalls) {
            for (const tc of toolCalls) {
              const idx = (tc.index as number | undefined) ?? 0;
              const stash = pendingTools.get(idx) ?? { id: '', name: '', args: '' };
              if (typeof tc.id === 'string' && tc.id) stash.id = tc.id;
              const fn = tc.function as Record<string, unknown> | undefined;
              if (fn) {
                if (typeof fn.name === 'string' && fn.name) stash.name = fn.name;
                if (typeof fn.arguments === 'string') stash.args += fn.arguments;
              }
              pendingTools.set(idx, stash);
            }
          }
          if (typeof c0.finish_reason === 'string' && c0.finish_reason) {
            stopReason = c0.finish_reason === 'tool_calls' ? 'tool_use' : c0.finish_reason;
            for (const [, t] of pendingTools) {
              let input: Record<string, unknown> = {};
              try { input = t.args ? (JSON.parse(t.args) as Record<string, unknown>) : {}; }
              catch { /* drop */ }
              send({ event: 'tool_use', id: t.id, name: t.name, input });
            }
            pendingTools.clear();
          }
        } catch { /* ignore */ }
      }
    }
  }
  send({ event: 'done', stop_reason: stopReason });
}

async function streamGeminiTools(
  body: ChatToolsBody,
  send: (ev: SseEvent) => void,
): Promise<void> {
  const req: Record<string, unknown> = {
    contents: toGeminiContents(body.messages),
    generationConfig: { maxOutputTokens: body.max_tokens ?? 8192, temperature: 0.7 },
  };
  if (body.system) req.system_instruction = { parts: [{ text: body.system }] };
  if (body.tools && body.tools.length > 0) {
    req.tools = [{
      functionDeclarations: body.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      })),
    }];
  }

  let lastErr = 'No keys configured';
  for (const key of GEMINI_KEYS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) },
      );
      if (!res.ok || !res.body) {
        const text = await res.text();
        lastErr = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        if (res.status === 429 || /quota/i.test(text)) continue;
        send({ event: 'error', message: lastErr });
        return;
      }

      let stopReason = 'end_turn';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop() || '';
        for (const frame of frames) {
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const p = JSON.parse(raw) as Record<string, unknown>;
              const candidates = p.candidates as Array<Record<string, unknown>> | undefined;
              if (!candidates || candidates.length === 0) continue;
              const cand = candidates[0]!;
              const content = cand.content as Record<string, unknown> | undefined;
              const parts = (content?.parts as Array<Record<string, unknown>> | undefined) ?? [];
              for (const part of parts) {
                if (typeof part.text === 'string' && part.text) {
                  send({ event: 'text', text: part.text });
                } else if (part.functionCall) {
                  const fc = part.functionCall as Record<string, unknown>;
                  send({
                    event: 'tool_use',
                    id: `gemini_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                    name: String(fc.name),
                    input: (fc.args as Record<string, unknown>) ?? {},
                  });
                  stopReason = 'tool_use';
                }
              }
              if (typeof cand.finishReason === 'string') {
                stopReason = cand.finishReason === 'STOP' ? 'end_turn' : stopReason;
              }
            } catch { /* ignore */ }
          }
        }
      }
      send({ event: 'done', stop_reason: stopReason });
      return;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  send({ event: 'error', message: `Gemini: ${lastErr}` });
}

/** Perplexity doesn't have native function calling, so we inject the
 * tool schemas as a system-prompt appendix and parse `<tool_call>` XML
 * from the text stream. Client doesn't see a difference — same events. */
async function streamPerplexityTools(
  body: ChatToolsBody,
  send: (ev: SseEvent) => void,
): Promise<void> {
  const toolBlock = (body.tools && body.tools.length > 0)
    ? '\n\n# Tool-call fallback (Perplexity has no native tools)\n'
      + 'To use a tool, emit EXACTLY this format (one per turn, then wait):\n\n'
      + '<tool_call name="TOOL_NAME">{"arg":"value"}</tool_call>\n\n'
      + '# Available tools\n'
      + body.tools.map((t) => ` - **${t.name}** — ${t.description}\n   schema: ${JSON.stringify(t.input_schema)}`).join('\n')
    : '';

  const system = (body.system ?? '') + toolBlock;

  /* Flatten messages for Perplexity's simple chat API. */
  const plainMessages: Array<{ role: string; content: string }> = [];
  if (system) plainMessages.push({ role: 'system', content: system });
  for (const m of body.messages) {
    if (typeof m.content === 'string') {
      plainMessages.push({ role: m.role, content: m.content });
    } else {
      const text = m.content.map((b) => {
        if (b.type === 'text') return b.text;
        if (b.type === 'tool_use') return `<tool_call name="${b.name}">${JSON.stringify(b.input)}</tool_call>`;
        if (b.type === 'tool_result') return `[tool result for ${b.tool_use_id}]\n${b.content}`;
        return '';
      }).join('\n');
      plainMessages.push({ role: m.role, content: text });
    }
  }

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PERPLEXITY_KEY}` },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: plainMessages,
      max_tokens: body.max_tokens ?? 4096,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    send({ event: 'error', message: `Perplexity HTTP ${res.status}: ${text.slice(0, 200)}` });
    return;
  }

  /* Stream text through; buffer so we can detect a complete
   * <tool_call> block before forwarding it as text. Once we see one,
   * emit a tool_use event and stop forwarding text from that point. */
  let streamBuf = '';
  let foundToolCall = false;
  const TOOL_RE = /<tool_call\s+name\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/tool_call>/;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let netBuf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    netBuf += decoder.decode(value, { stream: true });
    const frames = netBuf.split('\n\n');
    netBuf = frames.pop() || '';
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const p = JSON.parse(raw) as Record<string, unknown>;
          const choices = p.choices as Array<Record<string, unknown>> | undefined;
          const chunk = choices?.[0] && (choices[0] as Record<string, unknown>).delta
            ? ((choices[0] as Record<string, unknown>).delta as Record<string, unknown>).content
            : undefined;
          if (typeof chunk === 'string' && chunk && !foundToolCall) {
            streamBuf += chunk;
            const m = TOOL_RE.exec(streamBuf);
            if (m) {
              /* Flush any leading prose, emit the tool_use, stop forwarding. */
              const before = streamBuf.slice(0, m.index);
              if (before) send({ event: 'text', text: before });
              let input: Record<string, unknown> = {};
              try { input = JSON.parse((m[2] ?? '').trim()) as Record<string, unknown>; }
              catch { /* empty args */ }
              send({
                event: 'tool_use',
                id: `ppx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                name: m[1]!,
                input,
              });
              foundToolCall = true;
            } else {
              send({ event: 'text', text: chunk });
            }
          }
        } catch { /* ignore */ }
      }
    }
  }
  send({ event: 'done', stop_reason: foundToolCall ? 'tool_use' : 'end_turn' });
}

/* ── Handler ───────────────────────────────────────────────────── */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!(await validateKey(key))) return res.status(401).json({ error: 'Invalid or inactive API key' });
  if (!(await checkCap(key))) return res.status(503).json({ error: 'Service temporarily unavailable' });

  const body = (req.body ?? {}) as Partial<ChatToolsBody>;
  const model = body.model as ModelId | undefined;
  const messages = body.messages;
  const stream = body.stream !== false; /* default streaming on */

  const VALID: ModelId[] = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity'];
  if (!model || !VALID.includes(model)) return res.status(400).json({ error: '`model` must be one of ' + VALID.join(', ') });
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: '`messages` array is required' });

  if (!stream) {
    /* Non-streaming support: collect events into a single response.
     * Most clients should stream, but this makes testing easier. */
    return res.status(400).json({ error: 'non-streaming mode not yet supported; pass stream:true' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = makeSender(res);

  const fullBody: ChatToolsBody = {
    model,
    messages,
    ...(body.system !== undefined ? { system: body.system } : {}),
    ...(body.tools !== undefined ? { tools: body.tools } : {}),
    ...(body.tool_choice !== undefined ? { tool_choice: body.tool_choice } : {}),
    ...(body.max_tokens !== undefined ? { max_tokens: body.max_tokens } : {}),
    stream: true,
  };

  try {
    if (model === 'claude') {
      await streamAnthropicTools(fullBody, send);
    } else if (model === 'chatgpt') {
      await streamOpenAiTools(fullBody, send, OPENAI_KEY, 'https://api.openai.com/v1/chat/completions', 'gpt-4o');
    } else if (model === 'grok') {
      await streamOpenAiTools(fullBody, send, XAI_KEY, 'https://api.x.ai/v1/chat/completions', 'grok-3-latest');
    } else if (model === 'gemini') {
      await streamGeminiTools(fullBody, send);
    } else if (model === 'perplexity') {
      await streamPerplexityTools(fullBody, send);
    }
    trackUsage(key, model);
  } catch (e) {
    send({ event: 'error', message: (e as Error).message });
  }
  res.end();
}

export const config = { api: { bodyParser: { sizeLimit: '2mb' }, responseLimit: false } };
