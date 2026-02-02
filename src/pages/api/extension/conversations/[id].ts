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

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // Get conversation
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('extension_conversations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (convError || !conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Get messages
      const { data: messages, error: msgError } = await supabaseAdmin
        .from('extension_messages')
        .select('*')
        .eq('conversation_id', id)
        .eq('user_id', user.id)
        .order('message_index', { ascending: true });

      if (msgError) throw msgError;

      res.json({
        conversation,
        messages: messages || [],
      });
    } catch (err) {
      console.error('Get conversation error:', err);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { error } = await supabaseAdmin
        .from('extension_conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('Delete conversation error:', err);
      res.status(500).json({ error: 'Failed to delete' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
