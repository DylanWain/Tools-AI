// Audio transcription endpoint — proxies to OpenAI Whisper.
// Accepts: POST multipart/form-data with a "file" field containing audio bytes.
// Returns: application/json { text: "..." }
//
// Auth: Authorization: Bearer tai-<key> (same validation as /api/v1/chat)
//
// This is used by the Tools AI meeting recorder to transcribe live audio chunks.

import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false, // we stream multipart to OpenAI unchanged
    responseLimit: false,
  },
};

const OPENAI_KEY = process.env.OPENAI_KEY!;
const SUPABASE_URL = 'https://synpjcammfjebwsmtfpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM';

async function validateKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('tai-')) return false;
  const url =
    SUPABASE_URL +
    '/rest/v1/tai_keys?api_key=eq.' +
    encodeURIComponent(key) +
    '&active=eq.true&select=active&limit=1';
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
      },
    });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS for Tools AI webview / extension host
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth
  const auth = req.headers.authorization || '';
  const key = auth.replace(/^Bearer\s+/i, '').trim();
  if (!(await validateKey(key))) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'OPENAI_KEY not configured' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return res.status(400).json({
      error: 'Expected multipart/form-data with a "file" field',
    });
  }

  // Buffer the incoming body, then forward to OpenAI with the same Content-Type
  // (preserves the caller's multipart boundary so OpenAI sees the exact form).
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);

    if (body.length === 0) {
      return res.status(400).json({ error: 'Empty body' });
    }
    // Whisper supports up to 25 MB per file.
    if (body.length > 26_000_000) {
      return res.status(413).json({ error: 'Audio exceeds 25 MB' });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + OPENAI_KEY,
        'Content-Type': contentType,
        'Content-Length': String(body.length),
      },
      body,
    });

    const respText = await openaiRes.text();
    if (!openaiRes.ok) {
      // Bubble up OpenAI's error so we can see what's wrong in the client log.
      return res.status(openaiRes.status).json({
        error: 'Whisper error',
        status: openaiRes.status,
        detail: respText.slice(0, 2000),
      });
    }

    // Whisper responds JSON by default: { text: "..." }.
    // If the caller asked for response_format=text, it's plain text.
    try {
      const json = JSON.parse(respText);
      return res.status(200).json(json);
    } catch {
      return res.status(200).json({ text: respText });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'transcription failed' });
  }
}
