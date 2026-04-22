// src/pages/api/v1/uninstall.ts
// VS Code hits this URL silently on extension uninstall
import type { NextApiRequest, NextApiResponse } from 'next';

// Previously hardcoded — rotated after leak discovery (2026-04-22).
// Reads from Vercel env vars. Do NOT reintroduce hardcoded secrets.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Accepts both GET (from VS Code uninstall URL) and POST
  const key = (req.query.key as string) || (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!key || !key.startsWith('tai-')) return res.status(200).end(); // silent

  await fetch(`${SUPABASE_URL}/rest/v1/vscode_analytics?api_key=eq.${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'uninstalled',
      uninstalled_at: new Date().toISOString()
    })
  });

  return res.status(200).end();
}
