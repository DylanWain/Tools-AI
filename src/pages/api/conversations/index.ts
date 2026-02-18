import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken, AuthUser } from '../../../lib/auth';
import { transformConversation } from '../../../lib/transform';
import { randomUUID } from 'crypto';

/**
 * Ensure user exists in database (creates anonymous users on first call)
 */
async function ensureUserExists(user: AuthUser): Promise<void> {
  // Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existingUser) {
    // Create user record (works for both anonymous and registered users)
    const { error } = await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        email: user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`,
        hashed_password: 'anonymous',
        display_name: user.isAnonymous ? 'Guest' : (user.email?.split('@')[0] || 'User'),
      });
    
    // Ignore duplicate key errors (race condition)
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

  // Ensure user exists in database
  await ensureUserExists(user);
  
  // Generate email for tracking (works with existing extension schema)
  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  if (req.method === 'GET') {
    // List conversations - check both user_id and email for compatibility
    try {
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
    // Create conversation - generate ID since table has TEXT id with no default
    try {
      const { title, model, provider } = req.body;
      const conversationId = randomUUID();

      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          id: conversationId,  // Generate ID here since db doesn't auto-generate
          user_id: user.id,
          email: userEmail,    // Also store email for extension compatibility
          title: title || 'New Chat',
          model: model || 'llama-3.1-70b-versatile',
          provider: provider || 'groq',
          platform: 'toolsai-web',  // Mark as from website
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ conversation: transformConversation(conversation) });
    } catch (err: any) {
      console.error('Create conversation error:', err);
      res.status(500).json({ error: { message: `Failed to create conversation: ${err.message}` } });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
