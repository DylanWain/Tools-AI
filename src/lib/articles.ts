// ============================================================================
// lib/articles.ts — Build-time content reader for SSG blog pages
// Zero runtime cost — all content read at build time, served as static HTML
// ============================================================================

import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');
const REGISTRY_PATH = path.join(process.cwd(), 'content', 'master-registry.json');

export interface FAQ { question: string; answer: string; }
export interface InternalLink { text: string; href: string; category: string; }
export interface TableData { headers: string[]; rows: string[][]; caption?: string; }

export interface ArticleSection {
  h2: string;
  h2Id: string;
  content: string;
  h3s?: { title: string; id: string; content: string; }[];
}

export interface ArticleMeta {
  slug: string;
  title: string;
  keyword: string;
  description: string;
  excerpt: string;
  author: string;
  authorCredentials: string;
  publishDate: string;
  updateDate: string;
  readTime: string;
  wordCount: number;
  category: string;
  categoryLabel: string;
  tier: string;
  phase: string;
  volume: number;
  featuredImage?: string;
  featuredImageAlt?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export interface ArticleSchema {
  articleType: string;
  faqSchema: FAQ[];
  breadcrumbs: { name: string; url: string }[];
  howToSteps?: { name: string; text: string }[];
}

export interface ArticleContent {
  meta: ArticleMeta;
  heroHook: string;
  tableOfContents: { text: string; href: string; level: number }[];
  sections: ArticleSection[];
  faqs: FAQ[];
  tables: TableData[];
  internalLinks: InternalLink[];
  externalLinks: { text: string; href: string; rel: string }[];
  ctaSections: {
    position: string;
    headline: string;
    body: string;
    buttonText: string;
    buttonUrl: string;
  }[];
  schema: ArticleSchema;
  relatedArticles: string[];
}

export function getAllArticleSlugs(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export function getArticleBySlug(slug: string): ArticleContent | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as ArticleContent;
}

export function getAllArticles(): ArticleContent[] {
  return getAllArticleSlugs()
    .map(slug => getArticleBySlug(slug))
    .filter((a): a is ArticleContent => a !== null)
    .sort((a, b) => new Date(b.meta.publishDate).getTime() - new Date(a.meta.publishDate).getTime());
}

export function getArticlesByCategory(category: string): ArticleContent[] {
  return getAllArticles().filter(a => a.meta.category === category);
}

export function getMasterRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

export function getAllCategories(): string[] {
  return Array.from(new Set(getAllArticles().map(a => a.meta.category)));
}

export const CATEGORY_META: Record<string, { title: string; description: string; label: string }> = {
  'chatgpt-frustrations': { title: 'ChatGPT Problems & Fixes', description: 'Solutions for every ChatGPT memory, context, and conversation issue.', label: 'ChatGPT Frustrations' },
  'claude-pain-points': { title: 'Claude AI Issues & Solutions', description: 'Fix Claude conversation loss, context limits, and memory problems.', label: 'Claude Pain Points' },
  'gemini-copilot-frustrations': { title: 'Gemini & Copilot Fixes', description: 'Solve Gemini, Copilot, and Cursor context retention issues.', label: 'Gemini & Copilot' },
  'use-case': { title: 'AI Use Case Guides', description: 'How writers, developers, marketers, and students use AI with persistent memory.', label: 'Use Cases' },
  'multi-platform': { title: 'Multi-Platform AI Workflows', description: 'Use ChatGPT, Claude, and Gemini together without losing context.', label: 'Multi-Platform' },
  'feature-solutions': { title: 'AI Memory Tools & Extensions', description: 'Chrome extensions and tools that give AI unlimited memory.', label: 'Feature Solutions' },
  'how-to-fix': { title: 'AI Troubleshooting Guides', description: 'Fix every common AI chatbot error, crash, and context loss issue.', label: 'How to Fix' },
  'zero-competition': { title: 'AI Memory Deep Dives', description: 'Comprehensive guides to AI context windows, memory, and conversation management.', label: 'Deep Dives' },
  'high-intent': { title: 'Best AI Memory Solutions', description: 'Find the perfect AI memory tool for your workflow.', label: 'Solutions' },
  'buyer-intent': { title: 'AI Memory Extension Reviews', description: 'Honest reviews and comparisons of AI memory Chrome extensions.', label: 'Reviews' },
  'competitor-steal-10x': { title: 'AI Tool Comparisons', description: 'In-depth comparisons of ChatGPT, Claude, Gemini, and AI productivity tools.', label: 'Comparisons' },
  'competitor-steal': { title: 'Save & Export AI Conversations', description: 'Every method to save, export, print, and backup your AI chats.', label: 'Save & Export' },
  'memory-bug': { title: 'ChatGPT Memory Bug Fixes', description: 'Fix memory duplicating, deleting, not saving, and other ChatGPT memory bugs.', label: 'Memory Bugs' },
  'memory-explainer': { title: 'AI Memory Explained', description: 'Understand how ChatGPT memory, chat history, and context retention actually work.', label: 'Memory Explainers' },
  'instructions-bug': { title: 'Custom Instructions Fixes', description: 'Fix ChatGPT ignoring, forgetting, or drifting from your custom instructions.', label: 'Instructions Bugs' },
  'formatting-bug': { title: 'AI Output Formatting Fixes', description: 'Stop ChatGPT from using bullet points, repeating itself, and other formatting issues.', label: 'Formatting Fixes' },
  'byok': { title: 'Bring Your Own API Key', description: 'Use your own OpenAI or Anthropic API key for cheaper, unlimited AI access.', label: 'BYOK / API Key' },
  'code-bug': { title: 'AI Coding Bug Fixes', description: 'Fix ChatGPT stopping mid-code, losing context in codebases, and other dev issues.', label: 'Code Bugs' },
  'output-quality': { title: 'AI Output Quality Fixes', description: 'Fix robotic AI writing, declining quality, and get better output from ChatGPT.', label: 'Output Quality' },
  'safety': { title: 'AI Safety & Privacy', description: 'DeepSeek safety concerns, enterprise risks, and AI data privacy guides.', label: 'Safety & Privacy' },
  'prompts': { title: 'AI Prompt Libraries', description: 'Copy-paste prompt collections for marketing, teaching, coding, writing, and more.', label: 'Prompt Libraries' },
  'comparison': { title: 'AI Platform Comparisons', description: 'ChatGPT vs Claude vs Gemini vs DeepSeek — tested side-by-side on real tasks.', label: 'AI Comparisons' },
  'listicle': { title: 'Best AI Tools Ranked', description: 'Curated lists of the best free AI tools, writing assistants, and alternatives.', label: 'Best Of Lists' },
  'explainer': { title: 'AI Features Explained', description: 'Plain-English explanations of ChatGPT temporary chat, projects, memory limits, and more.', label: 'Explainers' },
  'how-to': { title: 'AI How-To Guides', description: 'Step-by-step guides for organizing, exporting, syncing, and managing AI conversations.', label: 'How-To Guides' },
  'troubleshooting': { title: 'AI Troubleshooting', description: 'Fix conversations disappearing, memory not working, and other AI platform issues.', label: 'Troubleshooting' },
};
