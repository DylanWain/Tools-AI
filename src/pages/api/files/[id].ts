// ============================================================================
// File Download API - Download a specific file by ID
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

// MIME types for different file extensions
const MIME_TYPES: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  ts: 'application/typescript',
  tsx: 'application/typescript',
  jsx: 'application/javascript',
  py: 'text/x-python',
  sql: 'application/sql',
  csv: 'text/csv',
  xml: 'application/xml',
  yaml: 'application/x-yaml',
  yml: 'application/x-yaml',
  sh: 'application/x-sh',
  zip: 'application/zip',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get file ID from URL
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'File ID required' } });
  }

  // Verify user (optional - can make files public if needed)
  const user = verifyToken(req);
  
  try {
    // Build query
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', id);
    
    // If user is authenticated, verify ownership
    if (user) {
      query = query.eq('user_id', user.id);
    }

    const { data: file, error } = await query.single();

    if (error || !file) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    // Get MIME type
    const ext = file.file_type?.toLowerCase() || 'txt';
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.content?.length || 0);
    
    // Send file content
    res.send(file.content || '');
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).json({ error: { message: 'Download failed' } });
  }
}
