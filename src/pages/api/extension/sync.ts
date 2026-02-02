import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS for extension
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { conversations, files } = req.body;

    if (!conversations || !Array.isArray(conversations)) {
      return res.status(400).json({ error: 'conversations array required' });
    }

    let syncedConversations = 0;
    let syncedMessages = 0;
    let syncedFiles = 0;

    for (const conv of conversations) {
      // Upsert conversation
      const { data: extConv, error: convError } = await supabaseAdmin
        .from('extension_conversations')
        .upsert({
          id: conv.id || undefined,
          user_id: user.id,
          platform: conv.platform || 'unknown',
          platform_url: conv.url || conv.platformUrl || null,
          title: conv.title || 'Untitled',
          message_count: conv.messages?.length || 0,
          code_block_count: conv.codeBlocks?.length || 0,
          first_message_at: conv.firstMessageAt || conv.timestamp ? new Date(conv.timestamp).toISOString() : new Date().toISOString(),
          last_message_at: conv.lastMessageAt || new Date().toISOString(),
          metadata: {
            project: conv.project || null,
            tags: conv.tags || [],
            syncedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })
        .select()
        .single();

      if (convError) {
        console.error('Sync conversation error:', convError);
        continue;
      }

      syncedConversations++;

      // Sync messages
      if (conv.messages && Array.isArray(conv.messages)) {
        for (let i = 0; i < conv.messages.length; i++) {
          const msg = conv.messages[i];
          const hasCode = msg.content?.includes('```') || msg.content?.includes('<code>');

          // Extract code blocks
          const codeBlocks: string[] = [];
          const codeRegex = /```[\s\S]*?```/g;
          let match;
          while ((match = codeRegex.exec(msg.content || '')) !== null) {
            codeBlocks.push(match[0]);
          }

          const { error: msgError } = await supabaseAdmin
            .from('extension_messages')
            .upsert({
              id: msg.id || undefined,
              conversation_id: extConv.id,
              user_id: user.id,
              sender: msg.sender || 'assistant',
              content: msg.content || '',
              has_code: hasCode,
              code_blocks: codeBlocks.length > 0 ? codeBlocks : [],
              message_index: i,
            }, {
              onConflict: 'id',
            });

          if (!msgError) syncedMessages++;
        }
      }
    }

    // Sync files if provided
    if (files && Array.isArray(files)) {
      for (const file of files) {
        const { error: fileError } = await supabaseAdmin
          .from('extension_files')
          .upsert({
            id: file.id || undefined,
            user_id: user.id,
            conversation_id: file.conversationId || null,
            filename: file.filename || file.name || 'unknown',
            file_type: file.type || file.fileType || null,
            file_size: file.size || file.fileSize || null,
            source_url: file.url || file.sourceUrl || null,
            platform: file.platform || null,
            metadata: file.metadata || {},
          }, {
            onConflict: 'id',
          });

        if (!fileError) syncedFiles++;
      }
    }

    res.status(200).json({
      success: true,
      synced: {
        conversations: syncedConversations,
        messages: syncedMessages,
        files: syncedFiles,
      },
    });
  } catch (err) {
    console.error('Extension sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
