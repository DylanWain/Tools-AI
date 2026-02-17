import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { verifyToken } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // This endpoint doesn't require auth - used for debugging
  const authHeader = req.headers.authorization;
  const user = verifyToken(req);
  
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    auth: {
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 30) + '...' : null,
      userParsed: !!user,
      userId: user?.id || null,
      isAnonymous: user?.isAnonymous || null,
    },
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseService: !!process.env.SUPABASE_SERVICE_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasGroqKey: !!process.env.FREE_GROQ_API_KEY,
      jwtSecretLen: process.env.JWT_SECRET?.length || 0,
    },
    database: {
      canConnect: false,
      usersCount: null as number | null,
      error: null as string | null,
    }
  };

  // Test database connection
  try {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      checks.database.error = `${error.code}: ${error.message}`;
    } else {
      checks.database.canConnect = true;
      checks.database.usersCount = count;
    }
  } catch (err: any) {
    checks.database.error = err.message;
  }

  // If user exists, try to check/create them
  if (user) {
    try {
      // Check if user exists
      const { data: existingUser, error: selectError } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('id', user.id)
        .single();

      checks.userLookup = {
        exists: !!existingUser,
        error: selectError ? `${selectError.code}: ${selectError.message}` : null,
      };

      // Try to create user if not exists
      if (!existingUser) {
        const userData = {
          id: user.id,
          email: `anon_${user.id.slice(0, 8)}@anonymous.local`,
          hashed_password: 'anonymous',
          display_name: 'Guest',
        };
        
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('users')
          .insert(userData)
          .select()
          .single();

        checks.userCreate = {
          attempted: true,
          success: !!newUser,
          error: insertError ? `${insertError.code}: ${insertError.message}` : null,
        };

        // If user was created, try to create a test conversation
        if (newUser) {
          const { data: conv, error: convError } = await supabaseAdmin
            .from('conversations')
            .insert({
              user_id: user.id,
              title: 'Test Chat',
              model: 'llama-3.1-70b-versatile',
              provider: 'groq',
            })
            .select()
            .single();

          checks.conversationCreate = {
            attempted: true,
            success: !!conv,
            error: convError ? `${convError.code}: ${convError.message}` : null,
          };
        }
      }
    } catch (err: any) {
      checks.userLookup = { error: err.message };
    }
  }

  res.json(checks);
}
