// ============================================================================
// Dashboard Single Conversation API
// Reads from REAL tables: conversations, messages, code_blocks
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // Get conversation — verify ownership by user_id or email
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', id)
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
        .single();

      if (convError || !conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Get messages — ordered by created_at (no message_index in live schema)
      const { data: messages, error: msgError } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', id as string)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      // Get code blocks for this conversation
      const { data: codeBlocks } = await supabaseAdmin
        .from('code_blocks')
        .select('*')
        .eq('conversation_id', id as string)
        .order('created_at', { ascending: true });

      res.json({
        conversation,
        messages: messages || [],
        codeBlocks: codeBlocks || [],
      });
    } catch (err: any) {
      console.error('Get conversation error:', err);
      res.status(500).json({ error: 'Failed to fetch conversation', details: err.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Delete messages first (no FK cascade)
      await supabaseAdmin
        .from('messages')
        .delete()
        .eq('conversation_id', id as string);

      // Delete code blocks
      await supabaseAdmin
        .from('code_blocks')
        .delete()
        .eq('conversation_id', id as string);

      // Delete conversation
      const { error } = await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', id)
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete conversation error:', err);
      res.status(500).json({ error: 'Failed to delete' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
