// ============================================================================
// File Generator - Auto-creates downloadable files from AI responses
// Detects code blocks, determines file types, saves to database
// ============================================================================

import { supabaseAdmin } from './supabase';

interface ExtractedFile {
  filename: string;
  content: string;
  language: string;
  fileType: string;
}

interface SavedFile {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  downloadUrl: string;
}

// Map language hints to file extensions
const LANGUAGE_TO_EXTENSION: Record<string, string> = {
  // Web
  'javascript': 'js',
  'js': 'js',
  'typescript': 'ts',
  'ts': 'ts',
  'tsx': 'tsx',
  'jsx': 'jsx',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'json': 'json',
  
  // Backend
  'python': 'py',
  'py': 'py',
  'ruby': 'rb',
  'go': 'go',
  'rust': 'rs',
  'java': 'java',
  'kotlin': 'kt',
  'swift': 'swift',
  'php': 'php',
  'csharp': 'cs',
  'c#': 'cs',
  'cpp': 'cpp',
  'c++': 'cpp',
  'c': 'c',
  
  // Data/Config
  'sql': 'sql',
  'yaml': 'yaml',
  'yml': 'yml',
  'toml': 'toml',
  'xml': 'xml',
  'csv': 'csv',
  
  // Shell
  'bash': 'sh',
  'sh': 'sh',
  'shell': 'sh',
  'zsh': 'sh',
  'powershell': 'ps1',
  
  // Docs
  'markdown': 'md',
  'md': 'md',
  'text': 'txt',
  'txt': 'txt',
  
  // Other
  'dockerfile': 'Dockerfile',
  'docker': 'Dockerfile',
  'makefile': 'Makefile',
  'graphql': 'graphql',
  'prisma': 'prisma',
};

// Detect content type from the code itself
function detectContentType(content: string, hint?: string): { extension: string; filename: string } {
  const lowerContent = content.toLowerCase();
  const lowerHint = hint?.toLowerCase() || '';
  
  // Check hint first
  if (lowerHint && LANGUAGE_TO_EXTENSION[lowerHint]) {
    const ext = LANGUAGE_TO_EXTENSION[lowerHint];
    return { extension: ext, filename: `code.${ext}` };
  }
  
  // React/JSX detection
  if (content.includes('import React') || content.includes('from "react"') || content.includes("from 'react'")) {
    if (content.includes(': React.FC') || content.includes('interface ') || content.includes(': string')) {
      return { extension: 'tsx', filename: 'Component.tsx' };
    }
    return { extension: 'jsx', filename: 'Component.jsx' };
  }
  
  // HTML detection
  if (content.includes('<!DOCTYPE') || content.includes('<html') || (content.includes('<div') && content.includes('</div>'))) {
    return { extension: 'html', filename: 'index.html' };
  }
  
  // CSS detection
  if (content.match(/\{[\s\S]*?:[\s\S]*?;[\s\S]*?\}/) && !content.includes('function') && !content.includes('const ')) {
    return { extension: 'css', filename: 'styles.css' };
  }
  
  // Python detection
  if (content.includes('def ') && content.includes(':') && !content.includes('function')) {
    return { extension: 'py', filename: 'script.py' };
  }
  
  // SQL detection
  if (lowerContent.includes('select ') || lowerContent.includes('create table') || lowerContent.includes('insert into')) {
    return { extension: 'sql', filename: 'query.sql' };
  }
  
  // JSON detection
  if ((content.trim().startsWith('{') && content.trim().endsWith('}')) || 
      (content.trim().startsWith('[') && content.trim().endsWith(']'))) {
    try {
      JSON.parse(content);
      return { extension: 'json', filename: 'data.json' };
    } catch {}
  }
  
  // Shell script detection
  if (content.startsWith('#!/bin/') || content.includes('npm install') || content.includes('apt-get')) {
    return { extension: 'sh', filename: 'script.sh' };
  }
  
  // TypeScript detection
  if (content.includes(': string') || content.includes(': number') || content.includes('interface ') || content.includes('type ')) {
    return { extension: 'ts', filename: 'index.ts' };
  }
  
  // JavaScript detection
  if (content.includes('const ') || content.includes('function ') || content.includes('export ')) {
    return { extension: 'js', filename: 'index.js' };
  }
  
  // Markdown detection
  if (content.includes('# ') || content.includes('## ') || content.includes('```')) {
    return { extension: 'md', filename: 'README.md' };
  }
  
  // Default to text
  return { extension: 'txt', filename: 'output.txt' };
}

/**
 * Extract code blocks from AI response
 */
export function extractCodeBlocks(response: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  
  // Match ```language\ncode\n``` blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  let blockIndex = 0;
  
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const language = match[1] || '';
    const content = match[2].trim();
    
    if (content.length < 10) continue; // Skip tiny blocks
    
    const { extension, filename } = detectContentType(content, language);
    
    // Generate unique filename if multiple blocks
    const finalFilename = blockIndex > 0 
      ? filename.replace(`.${extension}`, `_${blockIndex + 1}.${extension}`)
      : filename;
    
    files.push({
      filename: finalFilename,
      content,
      language: language || extension,
      fileType: extension,
    });
    
    blockIndex++;
  }
  
  return files;
}

/**
 * Determine if response should be bundled as a zip
 */
export function shouldCreateZip(files: ExtractedFile[]): boolean {
  // Multiple files = zip
  if (files.length > 1) return true;
  
  // Large single file that looks like a project
  if (files.length === 1) {
    const file = files[0];
    // If it contains multiple components or is very large
    if (file.content.length > 5000) return false; // Single large file, just download it
    if (file.content.includes('// File:') || file.content.includes('/* File:')) return true;
  }
  
  return false;
}

/**
 * Save files to database and return download info
 */
export async function saveGeneratedFiles(
  files: ExtractedFile[],
  userId: string,
  conversationId: string,
  messageId: string
): Promise<SavedFile[]> {
  const savedFiles: SavedFile[] = [];
  
  for (const file of files) {
    try {
      const { data, error } = await supabaseAdmin
        .from('files')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          message_id: messageId,
          filename: file.filename,
          file_type: file.fileType,
          file_size: file.content.length,
          content: file.content,
          metadata: { language: file.language },
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to save file:', error);
        continue;
      }
      
      savedFiles.push({
        id: data.id,
        filename: file.filename,
        fileType: file.fileType,
        fileSize: file.content.length,
        downloadUrl: `/api/files/${data.id}`,
      });
    } catch (err) {
      console.error('Error saving file:', err);
    }
  }
  
  return savedFiles;
}

/**
 * Process AI response and extract/save any files
 */
export async function processResponseFiles(
  responseContent: string,
  userId: string,
  conversationId: string,
  messageId: string
): Promise<{ files: SavedFile[]; zipUrl?: string }> {
  // Extract code blocks
  const extractedFiles = extractCodeBlocks(responseContent);
  
  if (extractedFiles.length === 0) {
    return { files: [] };
  }
  
  console.log(`Extracted ${extractedFiles.length} code blocks from response`);
  
  // Save individual files
  const savedFiles = await saveGeneratedFiles(extractedFiles, userId, conversationId, messageId);
  
  // Create zip if multiple files
  let zipUrl: string | undefined;
  if (shouldCreateZip(extractedFiles) && savedFiles.length > 1) {
    // Create a zip record
    const { data: zipRecord } = await supabaseAdmin
      .from('files')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        message_id: messageId,
        filename: 'project.zip',
        file_type: 'zip',
        file_size: 0, // Will be calculated when downloaded
        content: JSON.stringify(savedFiles.map(f => f.id)), // Store file IDs
        metadata: { isZip: true, fileIds: savedFiles.map(f => f.id) },
      })
      .select()
      .single();
    
    if (zipRecord) {
      zipUrl = `/api/files/zip/${zipRecord.id}`;
    }
  }
  
  return { files: savedFiles, zipUrl };
}
