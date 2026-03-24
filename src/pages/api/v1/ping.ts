// src/pages/api/v1/ping.ts
// Called by extension on key save (install) and every Run All (activity)
import type { NextApiRequest, NextApiResponse } from 'next';

const SUPABASE_URL = 'https://synpjcammfjebwsmtfpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!key || !key.startsWith('tai-')) return res.status(401).end();

  const { version, increment_runs } = req.body;

  // Get email from tai_keys
  const keyRes = await fetch(`${SUPABASE_URL}/rest/v1/tai_keys?api_key=eq.${encodeURIComponent(key)}&select=user_email&limit=1`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const keyData = await keyRes.json();
  const email = keyData?.[0]?.user_email || null;

  // Upsert analytics row
  await fetch(`${SUPABASE_URL}/rest/v1/vscode_analytics`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      api_key: key,
      email,
      version: version || null,
      last_active_at: new Date().toISOString(),
      status: 'active',
      ...(increment_runs ? { total_runs: 1 } : {})
    })
  });

  // If incrementing runs, also do a separate increment
  if (increment_runs) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_vscode_runs`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_key: key })
    }).catch(() => {}); // silent fail — upsert above already updated last_active
  }

  return res.status(200).json({ ok: true });
}
