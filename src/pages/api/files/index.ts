// ============================================================================
// File Generation API - Create downloadable files
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';
import JSZip from 'jszip';

// File type handlers
const FILE_HANDLERS: Record<string, (content: string, filename: string) => { data: string | Buffer; mimeType: string }> = {
  // Text-based files
  txt: (content) => ({ data: content, mimeType: 'text/plain' }),
  md: (content) => ({ data: content, mimeType: 'text/markdown' }),
  json: (content) => ({ data: content, mimeType: 'application/json' }),
  html: (content) => ({ data: content, mimeType: 'text/html' }),
  css: (content) => ({ data: content, mimeType: 'text/css' }),
  js: (content) => ({ data: content, mimeType: 'application/javascript' }),
  ts: (content) => ({ data: content, mimeType: 'application/typescript' }),
  tsx: (content) => ({ data: content, mimeType: 'application/typescript' }),
  jsx: (content) => ({ data: content, mimeType: 'application/javascript' }),
  py: (content) => ({ data: content, mimeType: 'text/x-python' }),
  sql: (content) => ({ data: content, mimeType: 'application/sql' }),
  csv: (content) => ({ data: content, mimeType: 'text/csv' }),
  xml: (content) => ({ data: content, mimeType: 'application/xml' }),
  yaml: (content) => ({ data: content, mimeType: 'application/x-yaml' }),
  yml: (content) => ({ data: content, mimeType: 'application/x-yaml' }),
  sh: (content) => ({ data: content, mimeType: 'application/x-sh' }),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify authentication
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  if (req.method === 'POST') {
    // Create a new file
    try {
      const { filename, content, conversationId, messageId } = req.body;

      if (!filename || !content) {
        return res.status(400).json({ error: { message: 'filename and content required' } });
      }

      // Get file extension
      const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
      
      // Store in database
      const { data: file, error } = await supabaseAdmin
        .from('files')
        .insert({
          user_id: user.id,
          conversation_id: conversationId || null,
          message_id: messageId || null,
          filename,
          file_type: ext,
          content,
          file_size: content.length,
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        file: {
          id: file.id,
          filename: file.filename,
          fileType: file.file_type,
          size: file.file_size,
          downloadUrl: `/api/files/${file.id}`,
          createdAt: file.created_at,
        },
      });
    } catch (err: any) {
      console.error('File creation error:', err);
      res.status(500).json({ error: { message: 'Failed to create file' } });
    }
  } else if (req.method === 'GET') {
    // List user's files
    try {
      const { conversationId, limit = 50 } = req.query;

      let query = supabaseAdmin
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data: files, error } = await query;

      if (error) throw error;

      res.json({
        files: (files || []).map(f => ({
          id: f.id,
          filename: f.filename,
          fileType: f.file_type,
          size: f.file_size,
          downloadUrl: `/api/files/${f.id}`,
          createdAt: f.created_at,
        })),
      });
    } catch (err: any) {
      console.error('File list error:', err);
      res.status(500).json({ error: { message: 'Failed to list files' } });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Separate endpoint for downloading files
export async function downloadFile(req: NextApiRequest, res: NextApiResponse, fileId: string, userId: string) {
  try {
    const { data: file, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    const ext = file.file_type || 'txt';
    const handler = FILE_HANDLERS[ext] || FILE_HANDLERS['txt'];
    const { data, mimeType } = handler(file.content, file.filename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(data);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: { message: 'Download failed' } });
  }
}
