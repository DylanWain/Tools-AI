import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://synpjcammfjebwsmtfpz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM'
);

const OPENAI_KEY      = process.env.OPENAI_KEY!;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_KEY!;
const GEMINI_KEYS     = (process.env.GEMINI_KEYS || '').split(',').filter(Boolean);
const XAI_KEY         = process.env.XAI_KEY!;
const PERPLEXITY_KEY  = process.env.PERPLEXITY_KEY!;

const CAP_CENTS = 1000; // $10.00 silent cap per user per month

// Cost estimates per 1K tokens (in cents) — conservative estimates
const MODEL_COST_PER_REQUEST_CENTS: Record<string, number> = {
  chatgpt: 3,    // ~$0.03 per request average
  claude: 3,
  gemini: 1,
  grok: 3,
  perplexity: 2,
};

type ModelId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

// ── KEY VALIDATION ──
async function validateKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('tai-')) return false;
  const url = 'https://synpjcammfjebwsmtfpz.supabase.co/rest/v1/tai_keys?api_key=eq.' + encodeURIComponent(key) + '&active=eq.true&select=active&limit=1';
  const res = await fetch(url, {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM',
    }
  });
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

// ── SILENT CAP CHECK ──
async function checkCap(key: string): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7); // '2026-03'
  const { data } = await supabase
    .from('tai_usage')
    .select('cost_cents')
    .eq('api_key', key)
    .eq('month', month)
    .maybeSingle();
  return (data?.cost_cents || 0) < CAP_CENTS;
}

// ── TRACK USAGE ──
async function trackUsage(key: string, models: ModelId[]) {
  const month = new Date().toISOString().slice(0, 7);
  const cost = models.reduce((sum, m) => sum + (MODEL_COST_PER_REQUEST_CENTS[m] || 2) * 2, 0); // *2 for two-pass
  try {
    await supabase.rpc('increment_usage', { p_key: key, p_month: month, p_cost: cost });
  } catch {
    await supabase.from('tai_usage').upsert(
      { api_key: key, month, cost_cents: cost },
      { onConflict: 'api_key,month', ignoreDuplicates: false }
    );
  }
}

// ── SSE STREAM READER ──
async function readSSE(response: Response, onData: (raw: string) => string): Promise<string> {
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
async function streamOpenAI(prompt: string, sys: string, onChunk: (c: string) => void): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.7, stream: true })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `OpenAI HTTP ${res.status}`); }
  return readSSE(res, raw => { try { const c = JSON.parse(raw).choices?.[0]?.delta?.content || ''; if (c) { onChunk(c); return c; } } catch {} return ''; });
}

async function streamAnthropic(prompt: string, sys: string, onChunk: (c: string) => void): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8192, system: sys, messages: [{ role: 'user', content: prompt }], stream: true })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Anthropic HTTP ${res.status}`); }
  return readSSE(res, raw => { try { const p = JSON.parse(raw); if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') { const c = p.delta.text || ''; if (c) { onChunk(c); return c; } } } catch {} return ''; });
}

async function streamGemini(prompt: string, sys: string, onChunk: (c: string) => void): Promise<string> {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], system_instruction: { parts: [{ text: sys }] }, generationConfig: { maxOutputTokens: 8192, temperature: 0.7 } };
  let lastErr = 'No keys';
  for (const key of GEMINI_KEYS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Gemini HTTP ${res.status}`); }
      return await readSSE(res, raw => { try { const c = JSON.parse(raw).candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''; if (c) { onChunk(c); return c; } } catch {} return ''; });
    } catch (e: any) { lastErr = e.message; if (e.message.includes('429') || e.message.toLowerCase().includes('quota')) continue; throw e; }
  }
  throw new Error('All Gemini keys exhausted: ' + lastErr);
}

async function streamGrok(prompt: string, sys: string, onChunk: (c: string) => void): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_KEY}` },
    body: JSON.stringify({ model: 'grok-3-latest', messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.7, stream: true })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Grok HTTP ${res.status}`); }
  return readSSE(res, raw => { try { const c = JSON.parse(raw).choices?.[0]?.delta?.content || ''; if (c) { onChunk(c); return c; } } catch {} return ''; });
}

async function streamPerplexity(prompt: string, sys: string, onChunk: (c: string) => void): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PERPLEXITY_KEY}` },
    body: JSON.stringify({ model: 'sonar-pro', messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }], max_tokens: 4096, stream: true })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Perplexity HTTP ${res.status}`); }
  return readSSE(res, raw => { try { const c = JSON.parse(raw).choices?.[0]?.delta?.content || ''; if (c) { onChunk(c); return c; } } catch {} return ''; });
}

function getStreamFn(modelId: ModelId) {
  const fns: Record<ModelId, (p: string, s: string, o: (c: string) => void) => Promise<string>> = {
    chatgpt: streamOpenAI, claude: streamAnthropic, gemini: streamGemini, grok: streamGrok, perplexity: streamPerplexity
  };
  return fns[modelId] || streamOpenAI;
}

// ── TWO-PASS ORCHESTRATION ──
async function runTwoPass(prompt: string, models: ModelId[], sys: string, onChunk?: (modelId: ModelId, pass: 1|2, chunk: string) => void): Promise<Record<string, { output?: string; error?: string }>> {
  const MODEL_LABELS: Record<ModelId, string> = { chatgpt: 'GPT-4o', claude: 'Claude', gemini: 'Gemini', grok: 'Grok', perplexity: 'Perplexity' };
  const contextLines = models.map(m => `${MODEL_LABELS[m]}: ${prompt}`).join('\n');
  const pass1Sys = (m: ModelId) => `${sys}\n\nYou are part of a multi-model AI team.\n\nTeam assignments:\n${contextLines}\n\nYour task:\n${prompt}`;

  const pass1Results: Partial<Record<ModelId, string>> = {};
  const pass1Errors: Partial<Record<ModelId, string>> = {};

  await Promise.allSettled(models.map(async (modelId) => {
    try { pass1Results[modelId] = await getStreamFn(modelId)(prompt, pass1Sys(modelId), (c) => onChunk?.(modelId, 1, c)); }
    catch (e: any) { pass1Errors[modelId] = e.message; }
  }));

  const allPass1 = models.map(m => `=== ${MODEL_LABELS[m]} ===\n${pass1Results[m] || `(error: ${pass1Errors[m] || 'failed'})`}`).join('\n\n');
  const pass2Sys = (m: ModelId) => `${sys}\n\nThis is your FINAL response. All models' initial responses:\n${allPass1}\n\nRefine your output based on the full picture. Your task:`;

  const pass2Results: Partial<Record<ModelId, string>> = {};
  const pass2Errors: Partial<Record<ModelId, string>> = {};

  await Promise.allSettled(models.map(async (modelId) => {
    try { pass2Results[modelId] = await getStreamFn(modelId)(prompt, pass2Sys(modelId) + '\n' + prompt, (c) => onChunk?.(modelId, 2, c)); }
    catch (e: any) { pass2Errors[modelId] = e.message; }
  }));

  const results: Record<string, { output?: string; error?: string }> = {};
  for (const m of models) {
    if (pass2Results[m]) results[m] = { output: pass2Results[m] };
    else results[m] = { error: pass2Errors[m] || pass1Errors[m] || 'Unknown error' };
  }
  return results;
}

// ── MAIN HANDLER ──
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const valid = await validateKey(key);
  if (!valid) return res.status(401).json({ error: 'Invalid or inactive API key' });

  // Silent cap check
  const underCap = await checkCap(key);
  if (!underCap) return res.status(503).json({ error: 'Service temporarily unavailable' });

  const { prompt, models, stream = false, shared_context = true, system_prompt = 'You are a helpful, expert AI assistant. Be thorough, clear, and direct.' } = req.body;

  const VALID_MODELS: ModelId[] = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity'];
  if (!prompt?.trim()) return res.status(400).json({ error: '`prompt` is required' });
  if (!models?.length) return res.status(400).json({ error: '`models` array is required' });
  const invalid = models.filter((m: string) => !VALID_MODELS.includes(m as ModelId));
  if (invalid.length) return res.status(400).json({ error: `Invalid models: ${invalid.join(', ')}` });

  const timeoutMs = 180_000;
  const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeoutMs));

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

      const results = await Promise.race([
        runTwoPass(prompt.trim(), models, system_prompt, (modelId, pass, chunk) => send({ model: modelId, pass, chunk })),
        timeoutPromise
      ]);

      send({ event: 'results', results });
      send({ event: 'done' });
      res.end();
    } else {
      const results = await Promise.race([runTwoPass(prompt.trim(), models, system_prompt), timeoutPromise]);
      res.status(200).json({ id: 'tai-run-' + Math.random().toString(36).slice(2, 10), results, models_used: models, shared_context });
    }

    // Track usage silently after response
    trackUsage(key, models as ModelId[]);

  } catch (e: any) {
    if (stream) { res.write(`data: ${JSON.stringify({ event: 'error', message: e.message })}\n\n`); res.end(); }
    else res.status(500).json({ error: e.message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' }, responseLimit: false } };
