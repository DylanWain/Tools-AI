/**
 * useProjectChat — manages chat state within a project.
 * Routes prompts to actual MCPs (Claude Code, Cursor, Codex) via desktop bridge.
 */

import { useState, useCallback } from "react";
import type { ProjectChat } from "@/lib/projects";
import {
  isDesktop,
  type LinkedSessionContent,
} from "@/lib/desktop";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  image?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
}

export function useProjectChat(chat: ProjectChat) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  });

  const sendMessage = useCallback(
    async (message: { text: string; image?: string }) => {
      // Add user message to history
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message.text,
        timestamp: Date.now(),
        image: message.image,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: undefined,
      }));

      try {
        // Route to appropriate MCP based on chat.mcp
        const response = await routeToMCP(chat, message);

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to send message",
        }));
      }
    },
    [chat]
  );

  return { state, sendMessage };
}

/**
 * Route a message to the appropriate MCP via the desktop bridge.
 * Uses window.veronumDesktop APIs to send to Claude Code, Cursor, or Codex.
 */
async function routeToMCP(chat: ProjectChat, message: { text: string; image?: string }): Promise<string> {
  if (!isDesktop()) {
    throw new Error("MCPs are only available in the desktop app");
  }

  const api = (window as unknown as { veronumDesktop?: any }).veronumDesktop;
  if (!api) {
    throw new Error("Desktop API not available");
  }

  // Route based on the MCP source
  switch (chat.mcp) {
    case "claude-code": {
      if (!api.claudeCode) {
        throw new Error("Claude Code not available in this desktop version");
      }
      // For now, return a placeholder — full Claude Code integration would require IPC
      return `Claude Code received: "${message.text}"\n(Full integration coming soon)`;
    }

    case "cursor": {
      if (!api.cursor) {
        throw new Error("Cursor not available");
      }
      return `Cursor received: "${message.text}"\n(Full integration coming soon)`;
    }

    case "codex": {
      if (!api.codex) {
        throw new Error("Codex not available");
      }
      return `Codex received: "${message.text}"\n(Full integration coming soon)`;
    }

    case "vscode": {
      // VSCode integration would be similar to others
      return `VSCode received: "${message.text}"\n(Full integration coming soon)`;
    }

    default:
      throw new Error(`Unknown MCP: ${chat.mcp}`);
  }
}
