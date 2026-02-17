import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken, AuthUser } from '../../../lib/auth';
import { transformConversation } from '../../../lib/transform';

/**
 * Ensure user exists in database (creates anonymous users on first call)
 */
async function ensureUserExists(user: AuthUser): Promise<void> {
  // Check if user already exists
  const { data: existingUser, error: selectError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    console.error('Error checking user existence:', selectError);
  }

  if (!existingUser) {
    // Create user record (works for both anonymous and registered users)
    const userData = {
      id: user.id,
      email: user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`,
      hashed_password: 'anonymous',
      display_name: user.isAnonymous ? 'Guest' : (user.email?.split('@')[0] || 'User'),
    };
    
    console.log('Creating user:', { id: user.id, isAnonymous: user.isAnonymous });
    
    const { error } = await supabaseAdmin
      .from('users')
      .insert(userData);
    
    // Ignore duplicate key errors (race condition)
    if (error && !error.message.includes('duplicate')) {
      console.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
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

  if (req.method === 'GET') {
    // List conversations
    try {
      const { data: conversations, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      res.json({ conversations: (conversations || []).map(transformConversation) });
    } catch (err) {
      console.error('List conversations error:', err);
      res.status(500).json({ error: { message: 'Failed to list conversations' } });
    }
  } else if (req.method === 'POST') {
    // Create conversation
    try {
      const { title, model, provider } = req.body;

      console.log('Creating conversation:', { userId: user.id, title, model, provider });

      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          user_id: user.id,
          title: title || 'New Chat',
          model: model || 'gpt-4o',
          provider: provider || 'openai',
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating conversation:', error);
        throw error;
      }

      res.status(201).json({ conversation: transformConversation(conversation) });
    } catch (err: any) {
      console.error('Create conversation error:', err);
      res.status(500).json({ error: { message: `Failed to create conversation: ${err.message || err}` } });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
