// ============================================================================
// Zip Generation API - Create downloadable zip files
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import JSZip from 'jszip';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  try {
    const { files, zipName = 'download.zip' } = req.body;

    // files should be an array of { filename: string, content: string }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: { message: 'files array required' } });
    }

    // Create zip
    const zip = new JSZip();

    for (const file of files) {
      if (file.filename && file.content) {
        zip.file(file.filename, file.content);
      }
    }

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    // Store zip file in database
    const { data: savedFile, error } = await supabaseAdmin
      .from('files')
      .insert({
        user_id: user.id,
        filename: zipName,
        file_type: 'zip',
        content: zipBuffer.toString('base64'), // Store as base64
        file_size: zipBuffer.length,
        metadata: { 
          isZip: true, 
          fileCount: files.length,
          originalFiles: files.map((f: any) => f.filename)
        },
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      file: {
        id: savedFile.id,
        filename: savedFile.filename,
        fileType: 'zip',
        size: savedFile.file_size,
        downloadUrl: `/api/files/zip/${savedFile.id}`,
        createdAt: savedFile.created_at,
      },
    });
  } catch (err: any) {
    console.error('Zip creation error:', err);
    res.status(500).json({ error: { message: 'Failed to create zip file' } });
  }
}
