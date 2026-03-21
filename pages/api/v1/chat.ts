import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// ── SUPABASE ──
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── API KEYS (server-side only, never exposed) ──
const OPENAI_KEY      = process.env.OPENAI_KEY!;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_KEY!;
const GEMINI_KEYS     = (process.env.GEMINI_KEYS || '').split(',').filter(Boolean);
const XAI_KEY         = process.env.XAI_KEY!;
const PERPLEXITY_KEY  = process.env.PERPLEXITY_KEY!;

// ── TYPES ──
type ModelId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

interface ChatRequest {
  prompt: string;
  models: ModelId[];
  stream?: boolean;
  shared_context?: boolean;
  system_prompt?: string;
}

interface ModelResult {
  output?: string;
  error?: string;
}

// ── KEY VALIDATION ──
async function validateKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('tai-')) return false;
  const { data, error } = await supabase
    .from('tai_keys')
    .select('active')
    .eq('api_key', key)
    .eq('active', true)
    .single();
  return !error && !!data;
}

// ── SSE STREAM READER ──
async function readSSE(
  response: Response,
  onData: (raw: string) => string
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      const chunk = onData(raw);
      if (chunk) full += chunk;
    }
  }
  return full;
}

// ── STREAMING PROVIDERS ──

async function callOpenAI(prompt: string, sys: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
      max_tokens: 4096, temperature: 0.7, stream: true
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `OpenAI HTTP ${res.status}`); }
  return readSSE(res, raw => {
    try { const p = JSON.parse(raw); return p.choices?.[0]?.delta?.content || ''; } catch { return ''; }
  });
}

async function callAnthropic(prompt: string, sys: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 8192,
      system: sys,
      messages: [{ role: 'user', content: prompt }],
      stream: true
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Anthropic HTTP ${res.status}`); }
  return readSSE(res, raw => {
    try {
      const p = JSON.parse(raw);
      if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') return p.delta.text || '';
    } catch {}
    return '';
  });
}

async function callGemini(prompt: string, sys: string): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    system_instruction: { parts: [{ text: sys }] },
    generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
  };
  let lastErr = 'No keys';
  for (const key of GEMINI_KEYS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Gemini HTTP ${res.status}`); }
      return await readSSE(res, raw => {
        try { return JSON.parse(raw).candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''; } catch { return ''; }
      });
    } catch (e: any) {
      lastErr = e.message;
      if (e.message.includes('429') || e.message.toLowerCase().includes('quota')) continue;
      throw e;
    }
  }
  throw new Error('All Gemini keys exhausted: ' + lastErr);
}

async function callGrok(prompt: string, sys: string): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_KEY}` },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
      max_tokens: 4096, temperature: 0.7, stream: true
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Grok HTTP ${res.status}`); }
  return readSSE(res, raw => {
    try { return JSON.parse(raw).choices?.[0]?.delta?.content || ''; } catch { return ''; }
  });
}

async function callPerplexity(prompt: string, sys: string): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PERPLEXITY_KEY}` },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
      max_tokens: 4096, stream: true
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Perplexity HTTP ${res.status}`); }
  return readSSE(res, raw => {
    try { return JSON.parse(raw).choices?.[0]?.delta?.content || ''; } catch { return ''; }
  });
}

function getModelFn(modelId: ModelId): (prompt: string, sys: string) => Promise<string> {
  const fns: Record<ModelId, (prompt: string, sys: string) => Promise<string>> = {
    chatgpt:    callOpenAI,
    claude:     callAnthropic,
    gemini:     callGemini,
    grok:       callGrok,
    perplexity: callPerplexity,
  };
  return fns[modelId];
}

// ── TWO-PASS ORCHESTRATION ──
async function runTwoPass(
  prompt: string,
  models: ModelId[],
  sys: string,
  onChunk?: (modelId: ModelId, pass: 1 | 2, chunk: string) => void
): Promise<Record<ModelId, ModelResult>> {
  const MODEL_LABELS: Record<ModelId, string> = {
    chatgpt: 'GPT-4o', claude: 'Claude', gemini: 'Gemini', grok: 'Grok', perplexity: 'Perplexity'
  };

  const contextLines = models.map(m => `${MODEL_LABELS[m]}: ${prompt}`).join('\n');

  const pass1Sys = (m: ModelId) =>
    `${sys}\n\nYou are part of a multi-model AI team working on the same project simultaneously.\n\nTeam assignments:\n${contextLines}\n\nAll models run at the same time and know each other's tasks. Your specific task:\n${prompt}`;

  // ── PASS 1 ──
  const pass1Results: Partial<Record<ModelId, string>> = {};
  const pass1Errors: Partial<Record<ModelId, string>> = {};

  await Promise.allSettled(models.map(async (modelId) => {
    try {
      const fn = getModelFn(modelId);
      // If streaming, wrap to emit chunks
      if (onChunk) {
        const originalFn = fn;
        // We can't easily intercept streaming here without rewriting — 
        // for streaming mode we call and accumulate, emitting chunks as they arrive
        // For now collect pass1 fully then stream pass2 (pass2 is what matters)
        const result = await originalFn(prompt, pass1Sys(modelId));
        pass1Results[modelId] = result;
      } else {
        pass1Results[modelId] = await fn(prompt, pass1Sys(modelId));
      }
    } catch (e: any) {
      pass1Errors[modelId] = e.message;
    }
  }));

  // ── PASS 2 ──
  const allPass1 = models.map(m =>
    `=== ${MODEL_LABELS[m]} ===\n${pass1Results[m] || `(error: ${pass1Errors[m] || 'failed'})`}`
  ).join('\n\n');

  const pass2Sys = (m: ModelId) =>
    `${sys}\n\nYou are part of a multi-model AI team. This is your FINAL response.\n\n` +
    `Team assignments:\n${contextLines}\n\n` +
    `All models' initial responses:\n${allPass1}\n\n` +
    `Produce your refined final response. Read every other model's output, reference their work directly, fill gaps they missed, and integrate tightly with the full picture. Your task:`;

  const pass2Results: Partial<Record<ModelId, string>> = {};
  const pass2Errors: Partial<Record<ModelId, string>> = {};

  await Promise.allSettled(models.map(async (modelId) => {
    // Skip pass2 for models that errored in pass1 AND have no result
    try {
      const fn = getModelFn(modelId);
      pass2Results[modelId] = await fn(prompt, pass2Sys(modelId) + '\n' + prompt);
      if (onChunk && pass2Results[modelId]) {
        // emit full pass2 as single chunk for streaming mode
        onChunk(modelId, 2, pass2Results[modelId]!);
      }
    } catch (e: any) {
      pass2Errors[modelId] = e.message;
    }
  }));

  // ── ASSEMBLE RESULTS ──
  const results: Record<string, ModelResult> = {};
  for (const m of models) {
    if (pass2Results[m]) {
      results[m] = { output: pass2Results[m] };
    } else {
      results[m] = { error: pass2Errors[m] || pass1Errors[m] || 'Unknown error' };
    }
  }
  return results as Record<ModelId, ModelResult>;
}

// ── MAIN HANDLER ──
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── AUTH ──
  const authHeader = req.headers.authorization || '';
  const key = authHeader.replace('Bearer ', '').trim();
  const valid = await validateKey(key);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid or inactive API key' });
  }

  // ── PARSE BODY ──
  const {
    prompt,
    models,
    stream = false,
    shared_context = true,
    system_prompt = 'You are a helpful, expert AI assistant. Be thorough, clear, and direct.'
  } = req.body as ChatRequest;

  // ── VALIDATE ──
  const VALID_MODELS: ModelId[] = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity'];
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: '`prompt` is required' });
  }
  if (!models || !Array.isArray(models) || models.length === 0) {
    return res.status(400).json({ error: '`models` array is required' });
  }
  const invalidModels = models.filter(m => !VALID_MODELS.includes(m));
  if (invalidModels.length > 0) {
    return res.status(400).json({ error: `Invalid models: ${invalidModels.join(', ')}. Valid: ${VALID_MODELS.join(', ')}` });
  }

  // ── SET TIMEOUT: 180s ──
  const timeoutMs = 180_000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out after 180 seconds')), timeoutMs)
  );

  try {
    if (stream) {
      // ── STREAMING RESPONSE ──
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendEvent = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const results = await Promise.race([
        runTwoPass(
          prompt.trim(),
          models,
          system_prompt,
          (modelId, pass, chunk) => {
            sendEvent({ model: modelId, pass, chunk });
          }
        ),
        timeoutPromise
      ]);

      // Send final structured results
      sendEvent({ event: 'results', results });
      sendEvent({ event: 'done' });
      res.end();

    } else {
      // ── JSON RESPONSE ──
      const results = await Promise.race([
        runTwoPass(prompt.trim(), models, system_prompt),
        timeoutPromise
      ]);

      const runId = 'tai-run-' + Math.random().toString(36).slice(2, 10);

      return res.status(200).json({
        id: runId,
        results,
        models_used: models,
        shared_context,
      });
    }

  } catch (e: any) {
    if (stream) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: e.message })}\n\n`);
      res.end();
    } else {
      return res.status(500).json({ error: e.message });
    }
  }
}

// ── INCREASE NEXT.JS BODY/RESPONSE TIMEOUT ──
export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
    responseLimit: false,
  },
};
