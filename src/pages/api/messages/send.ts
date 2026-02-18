// ============================================================================
// Messages Send API - HYBRID MEMORY SYSTEM + FILE GENERATION
// 1. Always loads extracted memories (key facts)
// 2. Also searches raw chat history for specific context
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken, AuthUser } from '../../../lib/auth';
import { transformMessage } from '../../../lib/transform';
import { processResponseFiles } from '../../../lib/file-generator';
import { 
  loadUserMemories, 
  extractMemories,
  formatMemoriesForPrompt,
  Memory
} from '../../../lib/memory-system';

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

/**
 * Search ALL past messages for relevant context
 */
async function searchPastChats(
  userId: string,
  query: string,
  currentConversationId: string,
  limit: number = 10
): Promise<string> {
  try {
    // Extract key terms from query
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'what', 'where', 'when', 'how', 'why', 'can', 'you', 'give', 'get', 'was', 'were'].includes(w));
    
    if (keywords.length === 0) return '';
    
    // Build search query - search in message content
    const searchTerms = keywords.slice(0, 5).join(' | ');
    
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select(`
        id,
        content,
        sender,
        created_at,
        conversation_id,
        conversations!inner(title)
      `)
      .eq('user_id', userId)
      .neq('conversation_id', currentConversationId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !messages || messages.length === 0) {
      return '';
    }

    // Format found messages as context
    let context = '\n\n**Relevant messages from past conversations:**\n';
    for (const msg of messages) {
      const convTitle = (msg as any).conversations?.title || 'Previous chat';
      const role = msg.sender === 'user' ? 'User' : 'Assistant';
      const preview = msg.content.slice(0, 300) + (msg.content.length > 300 ? '...' : '');
      context += `\n[${convTitle}] ${role}: ${preview}\n`;
    }
    
    return context;
  } catch (err) {
    console.error('Chat search error:', err);
    return '';
  }
}

/**
 * Build combined system prompt with memories AND chat search results
 */
function buildHybridSystemPrompt(
  memories: Memory[],
  chatSearchResults: string
): string {
  const memoryText = formatMemoriesForPrompt(memories);
  
  let prompt = `You are a helpful AI assistant with PERFECT MEMORY across all conversations.

═══════════════════════════════════════════════════════════════
WHAT YOU KNOW ABOUT THIS USER:
═══════════════════════════════════════════════════════════════`;

  if (memoryText) {
    prompt += `\n${memoryText}`;
  } else {
    prompt += `\n(No memories yet - this may be a new user)`;
  }

  if (chatSearchResults) {
    prompt += `\n${chatSearchResults}`;
  }

  prompt += `
═══════════════════════════════════════════════════════════════

IMPORTANT INSTRUCTIONS:
- You HAVE memory across all conversations - use it naturally
- Never say "I don't have access to other conversations" - you DO
- If user asks about past chats/files/info, check the context above
- Reference past interactions naturally, like a friend would

CAPABILITIES:
- You can create downloadable files (code, documents, etc.)
- When writing code, use proper markdown code blocks with language hints
- Files will automatically be extracted and made available for download

Be helpful, concise, and personalized.`;

  return prompt;
}

/**
 * Call OpenAI
 */
async function callOpenAI(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });
  
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    max_tokens: 4096,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic
 */
async function callAnthropic(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
  });

  const textBlock = response.content.find((block: any) => block.type === 'text');
  return (textBlock as any)?.text || '';
}

/**
 * Call Google using official SDK
 */
async function callGoogle(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });
  
  // Build chat history
  const history = [
    { role: 'user' as const, parts: [{ text: systemPrompt }] },
    { role: 'model' as const, parts: [{ text: 'Understood. I have perfect memory and will use the context provided.' }] },
  ];
  
  // Add all messages except the last one to history
  for (let i = 0; i < messages.length - 1; i++) {
    history.push({
      role: messages[i].role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: messages[i].content }],
    });
  }
  
  const chat = geminiModel.startChat({ history });
  
  // Send the last message
  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  const response = await result.response;
  
  return response.text();
}

/**
 * Call Groq - FREE unlimited AI (same API format as OpenAI)
 */
async function callGroq(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    max_tokens: 4096,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Main handler
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  // Ensure user exists in database (creates anonymous users on first call)
  await ensureUserExists(user);

  try {
    const { conversationId, content, apiKey } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ error: { message: 'conversationId and content required' } });
    }

    // ═══════════════════════════════════════════════════════════
    // FREE TIER: UNLIMITED messages with Groq (Llama 3.1 70B)
    // ═══════════════════════════════════════════════════════════
    const FREE_GROQ_KEY = process.env.FREE_GROQ_API_KEY;
    
    // Determine which API key to use
    let activeApiKey = apiKey;
    let usingFreeTier = false;
    let activeProvider = '';
    
    // Get conversation details first
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Provider handling
    if (conversation.provider === 'groq') {
      // Groq selected - use free Groq key (unlimited)
      if (FREE_GROQ_KEY) {
        activeApiKey = FREE_GROQ_KEY;
        activeProvider = 'groq';
        usingFreeTier = true;
        console.log(`Using FREE Groq tier (unlimited)`);
      } else if (!apiKey) {
        return res.status(400).json({ 
          error: { message: 'Groq API key not configured' } 
        });
      }
    } else if (!apiKey) {
      // No user API key - use free Groq tier
      if (FREE_GROQ_KEY) {
        activeApiKey = FREE_GROQ_KEY;
        activeProvider = 'groq';
        usingFreeTier = true;
        console.log(`Using FREE Groq tier (unlimited)`);
      } else {
        return res.status(400).json({ 
          error: { 
            message: 'Please add your own API key to continue.',
            code: 'API_KEY_REQUIRED'
          } 
        });
      }
    } else {
      activeProvider = conversation.provider || 'openai';
    }

    // If using free tier, force Groq model
    const model = usingFreeTier ? 'llama-3.1-70b-versatile' : (conversation.model || 'gpt-4o');
    const provider = usingFreeTier ? 'groq' : activeProvider;

    console.log(`\n=== New Message ===`);
    console.log(`User: ${user.id}`);
    console.log(`Free tier: ${usingFreeTier ? 'Yes (Groq - unlimited)' : 'No (using own key)'}`);
    console.log(`Provider: ${provider}, Model: ${model}`);
    console.log(`Query: ${content.slice(0, 100)}...`);
    
    // Generate email for tracking
    const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;
    const { randomUUID } = await import('crypto');

    // Save user message
    const { data: userMessage, error: userMsgError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: randomUUID(),  // Generate ID
        conversation_id: conversationId,
        user_id: user.id,
        email: userEmail,  // Required field
        topic: 'chat',     // Required field
        extension: 'web',  // Required field - marks as from website
        sender: 'user',
        content,
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError);
      throw userMsgError;
    }

    // ═══════════════════════════════════════════════════════════
    // HYBRID MEMORY SYSTEM
    // 1. Load extracted memories (key facts - always)
    // 2. Search past chats (for specific context - always)
    // ═══════════════════════════════════════════════════════════
    console.log('Loading memories and searching past chats...');
    
    // Load extracted memories (fast - indexed query)
    const memories = await loadUserMemories(user.id);
    console.log(`✓ Loaded ${memories.length} extracted memories`);
    
    // Search past chats for relevant context (parallel)
    const chatSearchResults = await searchPastChats(user.id, content, conversationId, 10);
    if (chatSearchResults) {
      console.log(`✓ Found relevant past chat messages`);
    }

    // Build combined system prompt
    const systemPrompt = buildHybridSystemPrompt(memories, chatSearchResults);

    // Get current conversation history
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('sender, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const apiMessages = (history || []).map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    console.log(`Calling ${provider}/${model} with ${apiMessages.length} messages`);

    // Call AI
    let responseContent: string;
    
    if (provider === 'openai') {
      responseContent = await callOpenAI(apiMessages, model, activeApiKey, systemPrompt);
    } else if (provider === 'anthropic') {
      responseContent = await callAnthropic(apiMessages, model, activeApiKey, systemPrompt);
    } else if (provider === 'google') {
      responseContent = await callGoogle(apiMessages, model, activeApiKey, systemPrompt);
    } else if (provider === 'groq') {
      responseContent = await callGroq(apiMessages, model, activeApiKey, systemPrompt);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Save assistant message
    const { data: assistantMessage, error: assistantMsgError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: randomUUID(),  // Generate ID
        conversation_id: conversationId,
        user_id: user.id,
        email: userEmail,  // Required field
        topic: 'chat',     // Required field
        extension: 'web',  // Required field
        sender: 'assistant',
        content: responseContent,
        payload: { model, provider, memoriesLoaded: memories.length },  // Use payload instead of metadata
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error('Failed to save assistant message:', assistantMsgError);
      throw assistantMsgError;
    }

    // ═══════════════════════════════════════════════════════════
    // FILE GENERATION - Extract code blocks and create downloadable files
    // ═══════════════════════════════════════════════════════════
    let files: any[] = [];
    let zipUrl: string | undefined;
    
    try {
      const fileResult = await processResponseFiles(
        responseContent,
        user.id,
        conversationId,
        assistantMessage.id
      );
      files = fileResult.files;
      zipUrl = fileResult.zipUrl;
      
      if (files.length > 0) {
        console.log(`✓ Created ${files.length} downloadable files`);
        
        // Update message metadata with file info
        await supabaseAdmin
          .from('messages')
          .update({
            metadata: { 
              model, 
              provider, 
              memoriesLoaded: memories.length,
              files: files.map(f => ({ id: f.id, filename: f.filename, fileType: f.fileType })),
              zipUrl,
            },
          })
          .eq('id', assistantMessage.id);
        
        // ═══════════════════════════════════════════════════════════
        // SAVE FILE CREATION AS MEMORY - So AI remembers what files it made
        // ═══════════════════════════════════════════════════════════
        const fileNames = files.map(f => f.filename).join(', ');
        const fileMemory = files.length === 1 
          ? `Created file "${fileNames}" for user`
          : `Created ${files.length} files for user: ${fileNames}`;
        
        await supabaseAdmin
          .from('memories')
          .insert({
            user_id: user.id,
            content: fileMemory,
            category: 'files',
            importance: 8,
            source: 'system',
            last_used_at: new Date().toISOString(),
            use_count: 1,
          });
        console.log(`✓ Saved file creation to memories`);
      }
    } catch (fileErr) {
      console.error('File generation error (non-fatal):', fileErr);
    }

    // ═══════════════════════════════════════════════════════════
    // MEMORY EXTRACTION - Extract new facts from this conversation
    // Runs async in background, doesn't block response
    // Uses Anthropic Haiku for fast/cheap extraction
    // ═══════════════════════════════════════════════════════════
    // Get Anthropic key for memory extraction (prefer user's key, or use provider key if Anthropic)
    const anthropicKey = provider === 'anthropic' ? activeApiKey : process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      extractMemories(user.id, content, responseContent, anthropicKey)
        .catch(err => console.error('Background memory extraction failed:', err));
    }

    // Update conversation title if needed
    const updates: any = { updated_at: new Date().toISOString() };
    if (conversation.title === 'New Chat') {
      updates.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }
    await supabaseAdmin.from('conversations').update(updates).eq('id', conversationId);

    console.log('✓ Response saved');

    res.json({
      userMessage: transformMessage(userMessage),
      assistantMessage: {
        ...transformMessage(assistantMessage),
        files,
        zipUrl,
      },
    });
  } catch (err: any) {
    console.error('Send message error:', err);
    res.status(500).json({ 
      error: { message: err.message || 'Failed to send message' } 
    });
  }
}
