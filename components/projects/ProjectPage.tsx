"use client";

import { useState, useEffect, useRef } from "react";
import { getProject, addChatToProject, type Project, type ProjectChat } from "@/lib/projects";
import { useProjectChat } from "./useProjectChat";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat states for each chat (keyed by chatId)
  const [chatStates, setChatStates] = useState<Record<string, ReturnType<typeof useProjectChat>["state"]>>({});
  const currentChat = project?.chats.find((c) => c.id === currentChatId);
  const chatHook = currentChat ? useProjectChat(currentChat) : null;

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

  // Update current chat state
  useEffect(() => {
    if (currentChat && chatHook) {
      setChatStates((prev) => ({
        ...prev,
        [currentChat.id]: chatHook.state,
      }));
    }
  }, [currentChat, chatHook?.state]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatStates]);

  const handleAddChat = async (chat: ProjectChat) => {
    if (!project) return;
    const updated = await addChatToProject(projectId, chat);
    setProject(updated);
    setCurrentChatId(chat.id);
    setShowAddChat(false);
  };

  const handleSendToOne = (chatId: string, message: any) => {
    const chat = project?.chats.find((c) => c.id === chatId);
    if (chat && chatHook) {
      chatHook.sendMessage(message);
    }
  };

  const handleSendToAll = (message: any) => {
    // Send to all chats in parallel
    project?.chats.forEach((chat) => {
      // Create a new hook instance for each chat and send
      const hook = useProjectChat(chat);
      hook.sendMessage(message);
    });
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
              {chatStates[currentChatId]?.messages.length === 0 ? (
                <div className={styles.chatPlaceholder}>
                  Chat with {currentChat.name} ({currentChat.mcp})
                  <p style={{ fontSize: "12px", marginTop: "8px", color: "var(--text-faded)" }}>
                    Send a message to start the conversation
                  </p>
                </div>
              ) : (
                chatStates[currentChatId]?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${styles[`message-${msg.role}`]}`}
                  >
                    <div className={styles.messageRole}>{msg.role === "user" ? "You" : currentChat.name}</div>
                    <div className={styles.messageContent}>
                      {msg.image && <img src={msg.image} alt="attachment" className={styles.messageImage} />}
                      <p>{msg.content}</p>
                    </div>
                    <div className={styles.messageTime}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              {chatStates[currentChatId]?.isLoading && (
                <div className={`${styles.message} ${styles["message-assistant"]}`}>
                  <div className={styles.messageRole}>{currentChat.name}</div>
                  <div className={styles.messageContent}>
                    <div className={styles.typing}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              {chatStates[currentChatId]?.error && (
                <div className={styles.error}>{chatStates[currentChatId]?.error}</div>
              )}
              <div ref={messagesEndRef} />
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
