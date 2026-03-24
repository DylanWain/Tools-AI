// src/pages/api/v1/uninstall.ts
// VS Code hits this URL silently on extension uninstall
import type { NextApiRequest, NextApiResponse } from 'next';

const SUPABASE_URL = 'https://synpjcammfjebwsmtfpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bnBqY2FtbWZqZWJ3c210ZnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5NTc0NywiZXhwIjoyMDg1MDcxNzQ3fQ.wdpCbyxMtncn4wpBQuOhpdkKuKESFjLLar6Sjww0_RM';

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
