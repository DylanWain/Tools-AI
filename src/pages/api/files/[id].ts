// ============================================================================
// File Download API - Download a specific file by ID
// LIVE DB: files(id TEXT, email TEXT, filename, mime_type, file_content, ...)
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'File ID required' } });
  }

  const user = verifyToken(req);
  const userEmail = user 
    ? (user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`)
    : null;
  
  try {
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', id);
    
    // Verify ownership by email if authenticated
    if (userEmail) {
      query = query.eq('email', userEmail);
    }

    const { data: file, error } = await query.single();

    if (error || !file) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    const mimeType = file.mime_type || 'text/plain';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename || 'download'}"`);
    res.setHeader('Content-Length', file.file_content?.length || 0);
    
    res.send(file.file_content || '');
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).json({ error: { message: 'Download failed' } });
  }
}
