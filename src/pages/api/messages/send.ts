// ============================================================================
// Messages Send API - HYBRID MEMORY SYSTEM + FILE GENERATION
// Fixed to match LIVE Supabase schema exactly
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken, AuthUser } from '../../../lib/auth';
import { transformMessage } from '../../../lib/transform';
import { extractCodeBlocks } from '../../../lib/file-generator';
import { 
  loadUserMemories, 
  extractMemories,
  formatMemoriesForPrompt,
  Memory
} from '../../../lib/memory-system';

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
 * Ensure user exists in database
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
 * Search past messages for relevant context
 * NOTE: No foreign key join - query conversations separately
 */
async function searchPastChats(
  userId: string,
  userEmail: string,
  query: string,
  currentConversationId: string,
  limit: number = 10
): Promise<string> {
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'what', 'where', 'when', 'how', 'why', 'can', 'you', 'give', 'get', 'was', 'were'].includes(w));
    
    if (keywords.length === 0) return '';
    
    // Search messages by user_id or email (no FK join needed)
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('id, content, sender, created_at, conversation_id')
      .or(`user_id.eq.${userId},email.eq.${userEmail}`)
      .neq('conversation_id', currentConversationId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !messages || messages.length === 0) {
      return '';
    }

    let context = '\n\n**Relevant messages from past conversations:**\n';
    for (const msg of messages) {
      const role = msg.sender === 'user' ? 'User' : 'Assistant';
      const preview = msg.content?.slice(0, 300) + ((msg.content?.length || 0) > 300 ? '...' : '');
      context += `\n[Past chat] ${role}: ${preview}\n`;
    }
    
    return context;
  } catch (err) {
    console.error('Chat search error:', err);
    return '';
  }
}

/**
 * Build system prompt with memories and chat context
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

// ============================================================================
// AI PROVIDER CALLS
// ============================================================================

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

async function callGoogle(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });
  
  const history = [
    { role: 'user' as const, parts: [{ text: systemPrompt }] },
    { role: 'model' as const, parts: [{ text: 'Understood. I have perfect memory and will use the context provided.' }] },
  ];
  
  for (let i = 0; i < messages.length - 1; i++) {
    history.push({
      role: messages[i].role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: messages[i].content }],
    });
  }
  
  const chat = geminiModel.startChat({ history });
  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  const response = await result.response;
  return response.text();
}

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

// ============================================================================
// Save files to DB matching LIVE schema
// LIVE files table: id(TEXT), conversation_id(TEXT), email(TEXT NOT NULL),
//   filename, title, description, mime_type, platform, created_at, file_content
// ============================================================================

async function saveFilesToDB(
  responseContent: string,
  userEmail: string,
  conversationId: string,
): Promise<{ files: any[]; zipUrl?: string }> {
  const extractedFiles = extractCodeBlocks(responseContent);
  if (extractedFiles.length === 0) return { files: [] };

  console.log(`Extracted ${extractedFiles.length} code blocks from response`);

  const savedFiles: any[] = [];
  for (const file of extractedFiles) {
    const fileId = generateId();
    const { error } = await supabaseAdmin
      .from('files')
      .insert({
        id: fileId,
        email: userEmail,
        conversation_id: conversationId,
        filename: file.filename,
        title: file.filename,
        mime_type: `text/${file.fileType}`,
        platform: 'toolsai',
        file_content: file.content,
      });

    if (error) {
      console.error('Failed to save file:', error);
      continue;
    }

    savedFiles.push({
      id: fileId,
      filename: file.filename,
      fileType: file.fileType,
      fileSize: file.content.length,
      downloadUrl: `/api/files/${fileId}`,
    });
  }

  return { files: savedFiles };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  await ensureUserExists(user);
  
  const userEmail = user.email || `anon_${user.id.slice(0, 8)}@anonymous.local`;

  try {
    const { conversationId, content, apiKey } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ error: { message: 'conversationId and content required' } });
    }

    // ═══════════════════════════════════════════════════════════
    // FREE TIER: UNLIMITED messages with Groq
    // ═══════════════════════════════════════════════════════════
    const FREE_GROQ_KEY = process.env.FREE_GROQ_API_KEY;
    
    let activeApiKey = apiKey;
    let usingFreeTier = false;
    let activeProvider = '';
    
    // Get conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Provider handling
    if (conversation.provider === 'groq') {
      if (FREE_GROQ_KEY) {
        activeApiKey = FREE_GROQ_KEY;
        activeProvider = 'groq';
        usingFreeTier = true;
      } else if (!apiKey) {
        return res.status(400).json({ error: { message: 'Groq API key not configured' } });
      }
    } else if (!apiKey) {
      if (FREE_GROQ_KEY) {
        activeApiKey = FREE_GROQ_KEY;
        activeProvider = 'groq';
        usingFreeTier = true;
      } else {
        return res.status(400).json({ error: { message: 'Please add your own API key.', code: 'API_KEY_REQUIRED' } });
      }
    } else {
      activeProvider = conversation.provider || 'openai';
    }

    const model = usingFreeTier ? 'llama-3.3-70b-versatile' : (conversation.model || 'gpt-4o');
    const provider = usingFreeTier ? 'groq' : activeProvider;

    console.log(`\n=== Message: ${provider}/${model} | Free: ${usingFreeTier} ===`);

    // ═══════════════════════════════════════════════════════════
    // SAVE USER MESSAGE
    // LIVE DB: messages
    //   id (TEXT NOT NULL), conversation_id (TEXT NOT NULL),
    //   email (TEXT NOT NULL), sender, content, user_id (UUID nullable),
    //   content_hash, metadata, created_at
    // ═══════════════════════════════════════════════════════════
    const userMsgId = generateId();
    const { data: userMessage, error: userMsgError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: userMsgId,
        conversation_id: conversationId,
        email: userEmail,
        user_id: user.id,
        sender: 'user',
        content,
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('Failed to save user message:', JSON.stringify(userMsgError));
      throw new Error(`Save user message failed: ${userMsgError.message}`);
    }

    // ═══════════════════════════════════════════════════════════
    // MEMORY SYSTEM
    // ═══════════════════════════════════════════════════════════
    const memories = await loadUserMemories(user.id);
    const chatSearchResults = await searchPastChats(user.id, userEmail, content, conversationId, 10);
    const systemPrompt = buildHybridSystemPrompt(memories, chatSearchResults);

    // Get conversation history
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('sender, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const apiMessages = (history || []).map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // ═══════════════════════════════════════════════════════════
    // CALL AI
    // ═══════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════
    // SAVE ASSISTANT MESSAGE
    // ═══════════════════════════════════════════════════════════
    const assistantMsgId = generateId();
    const { data: assistantMessage, error: assistantMsgError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: assistantMsgId,
        conversation_id: conversationId,
        email: userEmail,
        user_id: user.id,
        sender: 'assistant',
        content: responseContent,
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error('Failed to save assistant message:', JSON.stringify(assistantMsgError));
      throw new Error(`Save assistant message failed: ${assistantMsgError.message}`);
    }

    // ═══════════════════════════════════════════════════════════
    // FILE GENERATION
    // ═══════════════════════════════════════════════════════════
    let files: any[] = [];
    let zipUrl: string | undefined;
    
    try {
      const fileResult = await saveFilesToDB(responseContent, userEmail, conversationId);
      files = fileResult.files;
      zipUrl = fileResult.zipUrl;
      
      if (files.length > 0) {
        console.log(`✓ Created ${files.length} downloadable files`);
        
        // Save file creation as memory
        const fileNames = files.map((f: any) => f.filename).join(', ');
        await supabaseAdmin
          .from('memories')
          .insert({
            user_id: user.id,
            content: `Created file(s): ${fileNames}`,
            category: 'files',
            importance: 8,
            source: 'system',
          });
      }
    } catch (fileErr) {
      console.error('File generation error (non-fatal):', fileErr);
    }

    // ═══════════════════════════════════════════════════════════
    // BACKGROUND MEMORY EXTRACTION
    // ═══════════════════════════════════════════════════════════
    const anthropicKey = provider === 'anthropic' ? activeApiKey : process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      extractMemories(user.id, content, responseContent, anthropicKey)
        .catch(err => console.error('Background memory extraction failed:', err));
    }

    // Update conversation title + timestamp
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
