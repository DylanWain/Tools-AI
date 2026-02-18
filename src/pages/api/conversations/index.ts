import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken, AuthUser } from '../../../lib/auth';
import { transformConversation } from '../../../lib/transform';

// Generate a UUID string (works in all Node versions)
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

/**
 * Ensure user exists in database (creates anonymous users on first call)
 */
async function ensureUserExists(user: AuthUser): Promise<void> {
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existingUser) {
    const { error } = await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        email: user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`,
        hashed_password: 'anonymous',
        display_name: user.isAnonymous ? 'Guest' : (user.email?.split('@')[0] || 'User'),
      });
    
    if (error && !error.message.includes('duplicate')) {
      console.error('Failed to create user:', error);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  await ensureUserExists(user);

  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  if (req.method === 'GET') {
    try {
      // Query by user_id OR email for backwards compat with extension data
      const { data: conversations, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      res.json({ conversations: (conversations || []).map(transformConversation) });
    } catch (err) {
      console.error('List conversations error:', err);
      res.status(500).json({ error: { message: 'Failed to list conversations' } });
    }
  } else if (req.method === 'POST') {
    try {
      const { title, model, provider } = req.body;
      const conversationId = generateId();

      // LIVE DB: conversations
      //   id (TEXT NOT NULL, no default), email (TEXT NOT NULL),
      //   platform, title, url, user_id (UUID nullable),
      //   model, provider, message_count, code_block_count, file_count,
      //   created_at, updated_at
      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          id: conversationId,
          email: userEmail,
          user_id: user.id,
          title: title || 'New Chat',
          model: model || 'llama-3.3-70b-versatile',
          provider: provider || 'groq',
          platform: 'toolsai',
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', JSON.stringify(error));
        throw new Error(error.message);
      }

      res.status(201).json({ conversation: transformConversation(conversation) });
    } catch (err: any) {
      console.error('Create conversation error:', err);
      res.status(500).json({ error: { message: err.message || 'Failed to create conversation' } });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
