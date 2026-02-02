// ============================================================================
// Zip Download API - Download a zip file by ID
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'File ID required' } });
  }

  const user = verifyToken(req);

  try {
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('file_type', 'zip');
    
    if (user) {
      query = query.eq('user_id', user.id);
    }

    const { data: file, error } = await query.single();

    if (error || !file) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    // Convert base64 back to buffer
    const zipBuffer = Buffer.from(file.content, 'base64');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Zip download error:', err);
    res.status(500).json({ error: { message: 'Download failed' } });
  }
}
