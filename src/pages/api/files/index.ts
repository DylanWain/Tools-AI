// ============================================================================
// File API - Create and list files
// LIVE DB: files(id TEXT, email TEXT NOT NULL, filename, title, description,
//   mime_type, platform, file_content, conversation_id, created_at)
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

function generateId(): string {
  try {
    return require('crypto').randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

const EXT_TO_MIME: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', json: 'application/json',
  html: 'text/html', css: 'text/css', js: 'application/javascript',
  ts: 'application/typescript', tsx: 'application/typescript',
  jsx: 'application/javascript', py: 'text/x-python', sql: 'application/sql',
  csv: 'text/csv', xml: 'application/xml', yaml: 'application/x-yaml',
  sh: 'application/x-sh',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  if (req.method === 'POST') {
    try {
      const { filename, content, conversationId } = req.body;

      if (!filename || !content) {
        return res.status(400).json({ error: { message: 'filename and content required' } });
      }

      const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
      const fileId = generateId();

      const { data: file, error } = await supabaseAdmin
        .from('files')
        .insert({
          id: fileId,
          email: userEmail,
          conversation_id: conversationId || null,
          filename,
          title: filename,
          mime_type: EXT_TO_MIME[ext] || 'text/plain',
          platform: 'toolsai',
          file_content: content,
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        file: {
          id: file.id,
          filename: file.filename,
          fileType: ext,
          size: file.file_content?.length || 0,
          downloadUrl: `/api/files/${file.id}`,
          createdAt: file.created_at,
        },
      });
    } catch (err: any) {
      console.error('File creation error:', err);
      res.status(500).json({ error: { message: 'Failed to create file' } });
    }
  } else if (req.method === 'GET') {
    try {
      const { conversationId, limit = 50 } = req.query;

      let query = supabaseAdmin
        .from('files')
        .select('*')
        .eq('email', userEmail)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data: files, error } = await query;
      if (error) throw error;

      res.json({
        files: (files || []).map((f: any) => ({
          id: f.id,
          filename: f.filename,
          language: f.mime_type?.split('/')[1] || 'text',
          content: f.file_content || '',
          conversation_title: f.title || 'Unknown',
          created_at: f.created_at,
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
