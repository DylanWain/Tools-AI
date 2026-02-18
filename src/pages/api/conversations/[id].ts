import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';
import { transformConversation, transformMessage } from '../../../lib/transform';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { id } = req.query;
  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  if (req.method === 'GET') {
    try {
      // Find conversation by id, owned by this user (user_id or email)
      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', id)
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
        .single();

      if (error || !conversation) {
        return res.status(404).json({ error: { message: 'Conversation not found' } });
      }

      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      res.json({ 
        conversation: transformConversation(conversation), 
        messages: (messages || []).map(transformMessage) 
      });
    } catch (err) {
      console.error('Get conversation error:', err);
      res.status(500).json({ error: { message: 'Failed to get conversation' } });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { title } = req.body;

      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id)
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
        .select()
        .single();

      if (error) throw error;

      res.json({ conversation: transformConversation(conversation) });
    } catch (err) {
      console.error('Update conversation error:', err);
      res.status(500).json({ error: { message: 'Failed to update conversation' } });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Delete messages first (by conversation_id)
      await supabaseAdmin
        .from('messages')
        .delete()
        .eq('conversation_id', id);

      // Delete conversation
      const { error } = await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', id)
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`);

      if (error) throw error;

      res.json({ success: true });
    } catch (err) {
      console.error('Delete conversation error:', err);
      res.status(500).json({ error: { message: 'Failed to delete conversation' } });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
