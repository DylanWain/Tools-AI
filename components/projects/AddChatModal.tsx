"use client";

import { useState } from "react";
import { type ProjectChat, type MCPSource, type LLMType } from "@/lib/projects";
import styles from "./projects.module.css";

const MCP_OPTIONS: { label: string; value: MCPSource }[] = [
  { label: "Claude Code", value: "claude-code" },
  { label: "VS Code", value: "vscode" },
  { label: "Cursor", value: "cursor" },
  { label: "Codex", value: "codex" },
];

const LLM_OPTIONS: { label: string; value: LLMType }[] = [
  { label: "Claude", value: "claude" },
  { label: "GPT", value: "gpt" },
  { label: "Gemini", value: "gemini" },
  { label: "Grok", value: "grok" },
];

interface AddChatModalProps {
  onClose: () => void;
  onAdd: (chat: ProjectChat) => void;
}

export function AddChatModal({ onClose, onAdd }: AddChatModalProps) {
  const [name, setName] = useState("");
  const [mcp, setMcp] = useState<MCPSource>("claude-code");
  const [llm, setLlm] = useState<LLMType>("claude");
  const [error, setError] = useState("");

  const handleAdd = () => {
    if (!name.trim()) {
      setError("Chat name is required");
      return;
    }

    const chat: ProjectChat = {
      id: crypto.randomUUID(),
      name: name.trim(),
      mcp,
      llm,
      createdAt: Date.now(),
    };

    onAdd(chat);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Add Chat to Project</h2>

        <div className={styles.formGroup}>
          <label>Chat Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., API Implementation"
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Tool/IDE</label>
            <select value={mcp} onChange={(e) => setMcp(e.target.value as MCPSource)}>
              {MCP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>LLM (Optional)</label>
            <select value={llm} onChange={(e) => setLlm(e.target.value as LLMType)}>
              {LLM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button onClick={onClose} className={styles.secondaryBtn}>
            Cancel
          </button>
          <button onClick={handleAdd} className={styles.primaryBtn}>
            Add Chat
          </button>
        </div>
      </div>
    </div>
  );
}
