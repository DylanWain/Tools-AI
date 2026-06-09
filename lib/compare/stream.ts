/**
 * Provider-agnostic streaming. Each function takes a model id +
 * prompt and yields plain-text chunks as they arrive from the
 * upstream API. The /api/compare route adapts these into SSE.
 *
 * Why one file per concern instead of an SDK: keeps the bundle lean
 * (no @ai-sdk dep needed), keeps fetch-stream parsing transparent
 * for debugging, and lets each provider's quirks stay isolated.
 */

import { providerKey, type CompareModel } from "./models";
import type { WireAttachment } from "./attachments";

export type Chunk = { text?: string; done?: boolean; error?: string };

/** Multi-turn chat history. Direct port of the shape every provider
 *  accepts (`{role, content}` alternating user/assistant). The CURRENT
 *  user turn is the LAST entry; attachments + text preamble attach to it.
 *  See tools-ai-desktop popup.js:8124 for the pattern. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

// House voice — synthesized from Claude Code's own system prompt fragments
// (verbatim rules, not invented). Model-agnostic so every provider in the
// /compare grid follows the same tone: outcome-first, prose-not-fragments,
// no narration, no comment bloat. Source: Piebald-AI/claude-code-system-prompts
// (ccVersion 2.1.53–2.1.169). Override per-slot via `systemPrompt` in the
// request body when multi-agent / auto-research wants different framing.
const DEFAULT_SYSTEM_PROMPT = [
  "You help users with software engineering tasks: solving bugs, adding features, refactoring, explaining code. When an instruction is unclear or generic, interpret it in software-engineering context — if asked to rename `methodName` to snake_case, find the method in the code and modify it, don't just reply \"method_name\".",
  "",
  "Lead with the outcome. Your first sentence should answer \"what happened\" or \"what did you find\" — the thing the user would ask for if they said \"just give me the TLDR.\" Supporting detail and reasoning come after.",
  "",
  "Write for a teammate catching up cold, not for a log file. They don't know the shorthand you created along the way. Use complete sentences with technical terms spelled out — not fragments, abbreviations, or arrow chains like `A → B → fails`.",
  "",
  "Match the response to the question. A simple question gets a direct answer in prose, not headers and sections. Use tables only for short enumerable facts.",
  "",
  "When referencing code, use the pattern `file_path:line_number` so the user can navigate to the source.",
  "",
  "In code: default to writing NO comments. Only add one when the WHY is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. Don't explain WHAT the code does — well-named identifiers do that. Don't reference the current task (\"added for X flow\", \"handles issue #123\") — that belongs in the PR description.",
  "",
  "Don't add error handling, fallbacks, or validation for scenarios that can't happen. Only validate at system boundaries (user input, external APIs).",
  "",
  "Don't add features, refactor, or introduce abstractions beyond what the task requires. Three similar lines is better than a premature abstraction. No half-finished implementations.",
  "",
  "Don't introduce security vulnerabilities (injection, XSS, SQL injection, OWASP top 10). If you notice you wrote insecure code, immediately fix it.",
  "",
  "End-of-turn summary: one or two sentences. What changed and what's next. Nothing else.",
].join("\n");

/** Dispatch by provider. Throws if the provider's env key is missing.
 *  `systemPrompt` overrides DEFAULT_SYSTEM_PROMPT — used by multi-agent
 *  workflow mode to inject peer-awareness / synthesis instructions.
 *  `attachments` attach to the LAST user message (the current turn).
 *  `prevTurns` is the conversation history BEFORE the current prompt —
 *  user messages + previously-chosen compare card replies, in order.
 *  When empty (or undefined), this collapses to the single-turn shape
 *  the route used before the pick-as-main feature shipped.
 *  `projectContext` is the user's project rules (their THETOOLSWEBSITE.md
 *  equivalent) — appended to whichever system prompt is in play so the
 *  house voice and user-defined conventions both apply. */
export async function* streamCompletion(
  m: CompareModel,
  prompt: string,
  systemPrompt?: string,
  attachments?: WireAttachment[],
  prevTurns?: ChatMessage[],
  projectContext?: string,
): AsyncGenerator<Chunk> {
  const baseSys = systemPrompt && systemPrompt.trim() ? systemPrompt : DEFAULT_SYSTEM_PROMPT;
  const ctx = projectContext?.trim();
  const sys = ctx ? `${baseSys}\n\n# Project context (from this user's project rules)\n${ctx}` : baseSys;
  const atts = attachments ?? [];
  const history = prevTurns ?? [];
  // Always prepend any plain-text attachments to the user prompt — every
  // provider understands text, and this is simpler than building text
  // content blocks per provider. Image / PDF blobs are handled per
  // provider below.
  const textPreamble = buildTextPreamble(atts);
  const fullPrompt = textPreamble ? `${textPreamble}\n\n${prompt}` : prompt;
  switch (m.provider) {
    case "openai":     yield* streamOpenAI(m, fullPrompt, sys, atts, history); break;
    case "anthropic":  yield* streamAnthropic(m, fullPrompt, sys, atts, history); break;
    case "perplexity": yield* streamPerplexity(m, fullPrompt, sys, atts, history); break;
    case "gemini":     yield* streamGemini(m, fullPrompt, sys, atts, history); break;
    case "xai":        yield* streamXAI(m, fullPrompt, sys, atts, history); break;
  }
}

function buildTextPreamble(atts: WireAttachment[]): string {
  const textAtts = atts.filter((a) => !a.isImage && !a.isPdf && a.text);
  if (textAtts.length === 0) return "";
  return textAtts
    .map((a) => `===== ${a.name} (${a.bytes}B) =====\n${a.text}`)
    .join("\n\n");
}

// ──────────────────────────────────────────────────────────────
// OpenAI — Chat Completions API with stream=true.
// Returns Server-Sent Events lines: "data: {json}\n\n" + "data: [DONE]\n\n".
// We parse incrementally and yield content deltas.
// ──────────────────────────────────────────────────────────────
async function* streamOpenAI(m: CompareModel, prompt: string, sys: string, atts: WireAttachment[], history: ChatMessage[]): AsyncGenerator<Chunk> {
  const key = providerKey("openai");
  if (!key) { yield { error: "OPENAI_API_KEY (or OPENAI_KEY) not set on server" }; return; }
  const images = atts.filter((a) => a.isImage && a.image);
  const userContent: unknown = images.length === 0
    ? prompt
    : [
        { type: "text", text: prompt },
        ...images.map((a) => ({
          type: "image_url",
          image_url: { url: `data:${a.image!.mediaType};base64,${a.image!.data}` },
        })),
      ];
  // Multi-turn messages: system + prior turns + current user (with attachments).
  const messages: unknown[] = [
    { role: "system", content: sys },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];
  const body: Record<string, unknown> = {
    model: m.model,
    stream: true,
    messages,
  };
  // o1 family does NOT accept system prompts or stream=true at this
  // writing — fall back to non-streaming and emit a single chunk.
  if (m.model.startsWith("o1")) {
    body.messages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: typeof userContent === "string" ? prompt : userContent },
    ];
    body.stream = false;
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { yield { error: `openai ${r.status}: ${(await r.text()).slice(0, 200)}` }; return; }
  if (body.stream === false) {
    const data = await r.json();
    yield { text: data.choices?.[0]?.message?.content || "" };
    yield { done: true };
    return;
  }
  yield* parseSSE(r, (json) => json.choices?.[0]?.delta?.content);
}

// ──────────────────────────────────────────────────────────────
// Anthropic — Messages API with stream=true.
// ──────────────────────────────────────────────────────────────
async function* streamAnthropic(m: CompareModel, prompt: string, sys: string, atts: WireAttachment[], history: ChatMessage[]): AsyncGenerator<Chunk> {
  const key = providerKey("anthropic");
  if (!key) { yield { error: "ANTHROPIC_API_KEY (or ANTHROPIC_KEY) not set on server" }; return; }
  // Anthropic supports content arrays with image AND document blocks
  // (native PDF). Mix in the user's images + PDFs alongside the text.
  const blocks: unknown[] = [];
  for (const a of atts) {
    if (a.isImage && a.image) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: a.image.mediaType, data: a.image.data },
      });
    } else if (a.isPdf && a.blob) {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.blob.data },
      });
    }
  }
  blocks.push({ type: "text", text: prompt });
  // Multi-turn: prior turns as plain-string content (Anthropic accepts
  // strings for non-multimodal turns), then the current user with full blocks.
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: blocks },
  ];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: m.model,
      max_tokens: 4096,
      stream: true,
      system: sys,
      messages,
    }),
  });
  if (!r.ok) { yield { error: `anthropic ${r.status}: ${(await r.text()).slice(0, 200)}` }; return; }
  yield* parseSSE(r, (json) => {
    if (json.type === "content_block_delta") return json.delta?.text;
    return undefined;
  });
}

// Perplexity uses OpenAI-compatible Chat Completions, BUT in stream
// mode the final frame puts the answer in `choices[0].message.content`
// (not `delta.content` like real OpenAI). We accept either.
async function* streamPerplexity(m: CompareModel, prompt: string, sys: string, atts: WireAttachment[], history: ChatMessage[]): AsyncGenerator<Chunk> {
  const key = providerKey("perplexity");
  if (!key) { yield { error: "PERPLEXITY_API_KEY (or PERPLEXITY_KEY) not set on server" }; return; }
  // Sonar Pro accepts images via OpenAI-compatible image_url blocks.
  // Basic Sonar is text-only — we silently drop images for it; users
  // see "image attached" badge in the UI but no error.
  const images = atts.filter((a) => a.isImage && a.image);
  const supportsVision = m.model.toLowerCase().includes("pro");
  const userContent: unknown = (images.length === 0 || !supportsVision)
    ? prompt
    : [
        { type: "text", text: prompt },
        ...images.map((a) => ({
          type: "image_url",
          image_url: { url: `data:${a.image!.mediaType};base64,${a.image!.data}` },
        })),
      ];
  const messages: unknown[] = [
    { role: "system", content: sys },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m.model,
      stream: true,
      messages,
    }),
  });
  if (!r.ok) { yield { error: `perplexity ${r.status}: ${(await r.text()).slice(0, 200)}` }; return; }
  // Dedupe: Perplexity's final frame echoes the full message.content,
  // which would double-print if we also got incremental deltas. Track
  // what we've emitted and only forward new text.
  let emitted = "";
  yield* parseSSE(r, (json) => {
    const delta = json.choices?.[0]?.delta?.content;
    const full = json.choices?.[0]?.message?.content;
    if (delta) { emitted += delta; return delta; }
    if (full && full.length > emitted.length) {
      const slice = full.slice(emitted.length);
      emitted = full;
      return slice;
    }
    return undefined;
  });
}

// Gemini streamGenerateContent — different envelope shape.
async function* streamGemini(m: CompareModel, prompt: string, sys: string, atts: WireAttachment[], history: ChatMessage[]): AsyncGenerator<Chunk> {
  const key = providerKey("gemini");
  if (!key) { yield { error: "GEMINI_API_KEY (or GEMINI_KEYS) not set on server" }; return; }
  // Gemini takes images + PDFs as inline_data parts alongside text.
  const currentParts: unknown[] = [];
  for (const a of atts) {
    if (a.isImage && a.image) {
      currentParts.push({ inline_data: { mime_type: a.image.mediaType, data: a.image.data } });
    } else if (a.isPdf && a.blob) {
      currentParts.push({ inline_data: { mime_type: "application/pdf", data: a.blob.data } });
    }
  }
  currentParts.push({ text: prompt });
  // Gemini uses "user" / "model" (not "assistant") in its contents
  // array. Map history accordingly. Each prior turn is a single text part.
  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: currentParts },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m.model}:streamGenerateContent?alt=sse&key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents,
    }),
  });
  if (!r.ok) { yield { error: `gemini ${r.status}: ${(await r.text()).slice(0, 200)}` }; return; }
  yield* parseSSE(r, (json) => json.candidates?.[0]?.content?.parts?.[0]?.text);
}

// xAI Grok — OpenAI-compatible.
async function* streamXAI(m: CompareModel, prompt: string, sys: string, atts: WireAttachment[], history: ChatMessage[]): AsyncGenerator<Chunk> {
  const key = providerKey("xai");
  if (!key) { yield { error: "XAI_API_KEY (or XAI_KEY) not set on server" }; return; }
  // grok-vision-* / grok-2-vision-1212 accept image_url like OpenAI.
  // Non-vision Grok 3 silently drops images.
  const images = atts.filter((a) => a.isImage && a.image);
  const supportsVision = m.model.toLowerCase().includes("vision");
  const userContent: unknown = (images.length === 0 || !supportsVision)
    ? prompt
    : [
        { type: "text", text: prompt },
        ...images.map((a) => ({
          type: "image_url",
          image_url: { url: `data:${a.image!.mediaType};base64,${a.image!.data}` },
        })),
      ];
  const messages: unknown[] = [
    { role: "system", content: sys },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m.model,
      stream: true,
      messages,
    }),
  });
  if (!r.ok) { yield { error: `xai ${r.status}: ${(await r.text()).slice(0, 200)}` }; return; }
  yield* parseSSE(r, (json) => json.choices?.[0]?.delta?.content);
}

// ──────────────────────────────────────────────────────────────
// Generic SSE parser. Reads `data: ...\n\n` frames from the
// response body and applies the caller-provided extractor to pull
// the delta text out of each frame's JSON payload.
// ──────────────────────────────────────────────────────────────
// Loose shape used across providers. Each provider only uses a subset
// of the fields — the extractor we hand in pulls out whichever
// field that provider populates.
type SSEFrame = Record<string, unknown> & {
  choices?: {
    delta?: { content?: string };
    message?: { content?: string };
  }[];
  delta?: { text?: string };
  type?: string;
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

async function* parseSSE(
  r: Response,
  extract: (json: SSEFrame) => string | undefined,
): AsyncGenerator<Chunk> {
  const reader = r.body?.getReader();
  if (!reader) { yield { error: "no response body" }; return; }
  const dec = new TextDecoder();
  let buf = "";
  // Process line-by-line. Standard SSE puts events on `data:` lines
  // separated by blank lines (\n\n); Perplexity uses single \n
  // separators; some providers send \r\n. Treating every `data:`
  // line as its own event handles all three without special-casing.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).replace(/\r$/, "");
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const text = extract(json);
        if (text) yield { text };
      } catch {
        // ignore malformed frames — upstreams occasionally emit them
      }
    }
  }
  // Drain anything left in buf (no trailing newline) as a final line.
  if (buf.startsWith("data:")) {
    const payload = buf.slice(5).trim();
    if (payload && payload !== "[DONE]") {
      try {
        const text = extract(JSON.parse(payload));
        if (text) yield { text };
      } catch { /* ignore */ }
    }
  }
  yield { done: true };
}
