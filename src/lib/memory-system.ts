// ============================================================================
// Memory System - Extract & Load memories like ChatGPT/Claude/Gemini
// 
// 1. After each chat → AI extracts key facts → saves to memories table
// 2. Every new chat → Load all memories into system prompt
// 3. No triggers → AI just knows everything about the user
// ============================================================================

import { supabaseAdmin } from './supabase';
import Anthropic from '@anthropic-ai/sdk';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: string;
  importance: number; // 1-10, higher = more important
  source: 'extracted' | 'user_stated' | 'inferred';
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
}

// Categories for organizing memories
const MEMORY_CATEGORIES = [
  'personal_info',    // name, age, location, job, etc.
  'preferences',      // likes, dislikes, favorites
  'projects',         // things they're working on
  'technical',        // skills, tools, languages they use
  'goals',            // what they want to achieve
  'context',          // ongoing situations, relationships
  'facts',            // specific facts they've shared
  'files',            // files/code they've created or mentioned
  'secrets',          // secret codes, passwords, passphrases
];

/**
 * Load user's memories for injection into system prompt
 * Returns top 100 memories by importance and recency
 */
export async function loadUserMemories(userId: string): Promise<Memory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to load memories:', error);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      userId: m.user_id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      source: m.source,
      createdAt: m.created_at,
      lastUsedAt: m.last_used_at,
      useCount: m.use_count,
    }));
  } catch (err) {
    console.error('Memory load error:', err);
    return [];
  }
}

/**
 * Format memories for system prompt injection
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return '';

  // Group by category for cleaner presentation
  const byCategory = new Map<string, Memory[]>();
  for (const m of memories) {
    const existing = byCategory.get(m.category) || [];
    existing.push(m);
    byCategory.set(m.category, existing);
  }

  let formatted = '';
  
  // Secrets first (most important!)
  const secrets = byCategory.get('secrets') || [];
  if (secrets.length > 0) {
    formatted += '**Secret codes & passwords:**\n';
    formatted += secrets.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }
  
  // Personal info
  const personalInfo = byCategory.get('personal_info') || [];
  if (personalInfo.length > 0) {
    formatted += '**About the user:**\n';
    formatted += personalInfo.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  // Preferences
  const preferences = byCategory.get('preferences') || [];
  if (preferences.length > 0) {
    formatted += '**Preferences:**\n';
    formatted += preferences.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  // Projects
  const projects = byCategory.get('projects') || [];
  if (projects.length > 0) {
    formatted += '**Projects & Work:**\n';
    formatted += projects.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  // Technical skills
  const technical = byCategory.get('technical') || [];
  if (technical.length > 0) {
    formatted += '**Technical context:**\n';
    formatted += technical.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  // Goals
  const goals = byCategory.get('goals') || [];
  if (goals.length > 0) {
    formatted += '**Goals:**\n';
    formatted += goals.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  // Files/code created
  const files = byCategory.get('files') || [];
  if (files.length > 0) {
    formatted += '**Files & code created:**\n';
    formatted += files.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  // Context and facts
  const context = byCategory.get('context') || [];
  const facts = byCategory.get('facts') || [];
  const other = [...context, ...facts];
  if (other.length > 0) {
    formatted += '**Other things you know:**\n';
    formatted += other.map(m => `- ${m.content}`).join('\n') + '\n\n';
  }

  return formatted.trim();
}

/**
 * Extract memories from a conversation exchange
 * This runs AFTER the AI responds (async, non-blocking)
 */
export async function extractMemories(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  apiKey: string
): Promise<void> {
  try {
    // Use Claude to extract memories from the conversation
    const anthropic = new Anthropic({ apiKey });
    
    const extractionPrompt = `Analyze this conversation and extract ALL important facts about the user that should be remembered forever.

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantResponse.slice(0, 1500)}

IMPORTANT: Extract ANY of these if mentioned:
- Names (user's name, family, pets, etc.)
- Secret codes, passwords, passphrases, PINs, code words
- Favorite things (color, food, movie, etc.)
- Personal info (job, location, age, birthday)
- Projects they're working on
- Technical preferences (languages, tools)
- Goals or plans
- Any specific facts, numbers, or data they share

Examples of what to extract:
- "my secret code is BANANA42" → "User's secret code is BANANA42" (importance: 10)
- "my name is Dylan" → "User's name is Dylan" (importance: 10)
- "my favorite color is blue" → "User's favorite color is blue" (importance: 7)
- "I'm building an app called DibbyTour" → "User is building an app called DibbyTour" (importance: 8)
- "remember the password is hunter2" → "User's password is hunter2" (importance: 10)

Return ONLY a JSON array (no markdown, no explanation):
[{"content": "fact here", "category": "category", "importance": 8}]

Categories: personal_info, preferences, projects, technical, goals, context, facts, secrets
Importance: 10 = secrets/codes/names, 8 = projects/work, 5 = preferences, 3 = minor facts

Extract EVERYTHING worth remembering. If nothing to extract, return: []`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Use Haiku for speed and cost
      max_tokens: 1000,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const responseText = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : '';

    // Parse the JSON response
    let extractedMemories: Array<{
      content: string;
      category: string;
      importance: number;
    }> = [];

    try {
      // Clean up response - remove markdown code blocks if present
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      extractedMemories = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.log('No memories extracted or parse error');
      return;
    }

    if (!Array.isArray(extractedMemories) || extractedMemories.length === 0) {
      return;
    }

    console.log(`Extracted ${extractedMemories.length} memories`);

    // Save each memory (upsert to avoid duplicates)
    for (const memory of extractedMemories) {
      // Check if similar memory already exists
      const { data: existing } = await supabaseAdmin
        .from('memories')
        .select('id, content')
        .eq('user_id', userId)
        .ilike('content', `%${memory.content.slice(0, 50)}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing memory's last_used_at and use_count
        await supabaseAdmin
          .from('memories')
          .update({
            last_used_at: new Date().toISOString(),
            use_count: supabaseAdmin.rpc('increment_use_count', { row_id: existing[0].id }),
          })
          .eq('id', existing[0].id);
      } else {
        // Insert new memory
        await supabaseAdmin
          .from('memories')
          .insert({
            user_id: userId,
            content: memory.content,
            category: memory.category || 'facts',
            importance: memory.importance || 5,
            source: 'extracted',
            last_used_at: new Date().toISOString(),
            use_count: 1,
          });
      }
    }
  } catch (err) {
    // Non-blocking - just log errors
    console.error('Memory extraction error:', err);
  }
}

/**
 * Add a memory directly (for when user explicitly tells something)
 */
export async function addMemory(
  userId: string,
  content: string,
  category: string = 'facts',
  importance: number = 7
): Promise<void> {
  try {
    await supabaseAdmin
      .from('memories')
      .insert({
        user_id: userId,
        content,
        category,
        importance,
        source: 'user_stated',
        last_used_at: new Date().toISOString(),
        use_count: 1,
      });
  } catch (err) {
    console.error('Failed to add memory:', err);
  }
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);
  } catch (err) {
    console.error('Failed to delete memory:', err);
  }
}

/**
 * Clear all memories for a user
 */
export async function clearAllMemories(userId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('memories')
      .delete()
      .eq('user_id', userId);
  } catch (err) {
    console.error('Failed to clear memories:', err);
  }
}

/**
 * Build the complete system prompt with memories
 */
export function buildSystemPromptWithMemories(memories: Memory[]): string {
  const memoryText = formatMemoriesForPrompt(memories);
  
  if (memoryText) {
    return `You are a helpful AI assistant. You have PERFECT MEMORY of this user from previous conversations.

═══════════════════════════════════════════════════════════════
WHAT YOU KNOW ABOUT THIS USER (from previous chats):
═══════════════════════════════════════════════════════════════
${memoryText}
═══════════════════════════════════════════════════════════════

IMPORTANT INSTRUCTIONS:
- You DO have memory across conversations - use the information above naturally
- If asked about something you know (like files you created), recall it from the memories above
- Never say "I don't have access to other conversations" - you DO have memory
- Reference past interactions naturally, like a friend would
- If user asks for a file you created before, acknowledge you remember making it

CAPABILITIES:
- You can create downloadable files (code, documents, etc.)
- When writing code, use proper markdown code blocks with language hints
- Files will automatically be extracted and made available for download

Be helpful, concise, and personalized based on what you know about the user.`;
  }
  
  return `You are a helpful AI assistant.

CAPABILITIES:
- You can create downloadable files (code, documents, etc.)
- When writing code, use proper markdown code blocks with language hints
- Files will automatically be extracted and made available for download

Be helpful and concise.`;
}
