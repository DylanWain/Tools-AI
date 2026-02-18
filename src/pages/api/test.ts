// Simple test endpoint - no auth required
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING',
      JWT_SECRET: process.env.JWT_SECRET ? `SET (${process.env.JWT_SECRET.length} chars)` : 'MISSING',
      FREE_GROQ_API_KEY: process.env.FREE_GROQ_API_KEY ? 'SET' : 'MISSING',
    },
    tests: {} as Record<string, any>,
  };

  // Test 1: Database connection
  try {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    results.tests.dbConnection = {
      success: !error,
      usersCount: count,
      error: error?.message || null,
    };
  } catch (e: any) {
    results.tests.dbConnection = { success: false, error: e.message };
  }

  // Test 2: Can create a test user with UUID
  const testUserId = '00000000-0000-0000-0000-000000000001';
  try {
    // First delete if exists
    await supabaseAdmin.from('users').delete().eq('id', testUserId);
    
    // Try to create
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: testUserId,
        email: 'test@test.local',
        hashed_password: 'test',
        display_name: 'Test',
      })
      .select()
      .single();

    results.tests.createUser = {
      success: !!data,
      error: error?.message || null,
    };

    // Clean up
    if (data) {
      await supabaseAdmin.from('users').delete().eq('id', testUserId);
    }
  } catch (e: any) {
    results.tests.createUser = { success: false, error: e.message };
  }

  // Test 3: Can create user with device-ID format (what anon users get)
  const testDeviceId = '78cdc3c6-7f0d-4a91-8c97-aa11d8a2bbc1';
  try {
    // First delete if exists
    await supabaseAdmin.from('users').delete().eq('id', testDeviceId);
    
    // Try to create
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: testDeviceId,
        email: `anon_78cdc3c6@anonymous.local`,
        hashed_password: 'anonymous',
        display_name: 'Guest',
      })
      .select()
      .single();

    results.tests.createAnonUser = {
      success: !!data,
      error: error?.message || null,
    };

    // If success, try to create a conversation
    if (data) {
      const { data: conv, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          id: randomUUID(),
          user_id: testDeviceId,
          title: 'Test Chat',
          model: 'llama-3.3-70b-versatile',
          provider: 'groq',
        })
        .select()
        .single();

      results.tests.createConversation = {
        success: !!conv,
        error: convError?.message || null,
      };

      // Clean up
      if (conv) {
        await supabaseAdmin.from('conversations').delete().eq('id', conv.id);
      }
      await supabaseAdmin.from('users').delete().eq('id', testDeviceId);
    }
  } catch (e: any) {
    results.tests.createAnonUser = { success: false, error: e.message };
  }

  res.json(results);
}
