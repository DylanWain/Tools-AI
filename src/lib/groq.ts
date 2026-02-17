// ============================================================================
// Groq API Integration - FREE unlimited AI
// Uses same format as OpenAI (drop-in replacement)
// ============================================================================

import Groq from 'groq-sdk';

export async function callGroq(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const groq = new Groq({ apiKey });
  
  const completion = await groq.chat.completions.create({
    model: model || 'llama-3.1-70b-versatile',
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

// Available Groq models (all FREE and fast)
export const GROQ_MODELS = [
  { 
    id: 'llama-3.1-70b-versatile', 
    name: 'Llama 3.1 70B', 
    desc: 'Most capable free model',
    contextWindow: 131072,
  },
  { 
    id: 'llama-3.1-8b-instant', 
    name: 'Llama 3.1 8B', 
    desc: 'Ultra fast responses',
    contextWindow: 131072,
  },
  { 
    id: 'llama-3.2-90b-vision-preview', 
    name: 'Llama 3.2 90B Vision', 
    desc: 'Multimodal (images)',
    contextWindow: 8192,
  },
  { 
    id: 'mixtral-8x7b-32768', 
    name: 'Mixtral 8x7B', 
    desc: '32K context window',
    contextWindow: 32768,
  },
  { 
    id: 'gemma2-9b-it', 
    name: 'Gemma 2 9B', 
    desc: 'Google open model',
    contextWindow: 8192,
  },
];
