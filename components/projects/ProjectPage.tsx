"use client";

import { useState, useEffect } from "react";
import { getProject, addChatToProject, type Project, type ProjectChat } from "@/lib/projects";
import { ParallelComposer } from "./ParallelComposer";
import { AddChatModal } from "./AddChatModal";
import styles from "./projects.module.css";

interface ProjectPageProps {
  projectId: string;
}

export function ProjectPage({ projectId }: ProjectPageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showAddChat, setShowAddChat] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      setProject(p);
      if (p?.chats.length) {
        setCurrentChatId(p.chats[0].id);
      }
      setLoading(false);
    })();
  }, [projectId]);

  const handleAddChat = async (chat: ProjectChat) => {
    if (!project) return;
    const updated = await addChatToProject(projectId, chat);
    setProject(updated);
    setCurrentChatId(chat.id);
    setShowAddChat(false);
  };

  const handleSendToOne = (chatId: string, message: any) => {
    console.log("Send to chat:", chatId, message);
    // TODO: wire to actual MCP
  };

  const handleSendToAll = (message: any) => {
    console.log("Send to all chats:", message);
    // TODO: broadcast to all chats
  };

  if (loading) return <div className={styles.loading}>Loading project...</div>;
  if (!project) return <div className={styles.error}>Project not found</div>;

  const currentChat = project.chats.find((c) => c.id === currentChatId);

  return (
    <div className={styles.projectPage}>
      <div className={styles.projectHeader}>
        <h1>{project.name}</h1>
        {project.description && <p>{project.description}</p>}
      </div>

      <div className={styles.chatTabs}>
        {project.chats.map((chat) => (
          <button
            key={chat.id}
            className={`${styles.chatTab} ${currentChatId === chat.id ? styles.active : ""}`}
            onClick={() => setCurrentChatId(chat.id)}
          >
            <span className={styles.chatIcon}>{getMCPIcon(chat.mcp)}</span>
            <span>{chat.name}</span>
          </button>
        ))}
        <button className={styles.addChatTab} onClick={() => setShowAddChat(true)}>
          + Add Chat
        </button>
      </div>

      <div className={styles.chatContent}>
        {currentChat ? (
          <div className={styles.chatView}>
            <div className={styles.chatMessages}>
              <div className={styles.chatPlaceholder}>
                Chat with {currentChat.name} ({currentChat.mcp})
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>No chats yet. Add one to get started.</div>
        )}
      </div>

      <ParallelComposer
        chatCount={project.chats.length}
        currentChatId={currentChatId || undefined}
        onSendToOne={handleSendToOne}
        onSendToAll={handleSendToAll}
      />

      {showAddChat && (
        <AddChatModal onClose={() => setShowAddChat(false)} onAdd={handleAddChat} />
      )}
    </div>
  );
}

function getMCPIcon(mcp: string): string {
  const icons: Record<string, string> = {
    "claude-code": "🚀",
    cursor: "📝",
    codex: "✨",
    vscode: "💻",
  };
  return icons[mcp] || "💬";
}
