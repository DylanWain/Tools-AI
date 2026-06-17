"use client";

import { useState } from "react";
import styles from "./projects.module.css";

interface Message {
  text: string;
  image?: string;
}

interface ParallelComposerProps {
  chatCount: number;
  onSendToOne: (chatId: string, message: Message) => void;
  onSendToAll: (message: Message) => void;
  currentChatId?: string;
}

export function ParallelComposer({
  chatCount,
  onSendToOne,
  onSendToAll,
  currentChatId,
}: ParallelComposerProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [sendToAll, setSendToAll] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    if (!text.trim()) return;

    setSending(true);
    const message: Message = { text: text.trim(), image: image || undefined };

    if (sendToAll) {
      onSendToAll(message);
    } else if (currentChatId) {
      onSendToOne(currentChatId, message);
    }

    setText("");
    setImage(null);
    setSending(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={styles.composer}>
      {chatCount > 1 && (
        <div className={styles.composerToggle}>
          <label>
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={(e) => setSendToAll(e.target.checked)}
              disabled={sending}
            />
            Send to all {chatCount} chats
          </label>
        </div>
      )}

      <div className={styles.composerInput}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={sendToAll ? "Ask all chats..." : "Send a message..."}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              handleSend();
            }
          }}
        />

        {image && (
          <div className={styles.imagePreview}>
            <img src={image} alt="preview" />
            <button onClick={() => setImage(null)} disabled={sending}>
              ✕
            </button>
          </div>
        )}

        <div className={styles.composerActions}>
          <label className={styles.imageUpload}>
            📎
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={sending}
              style={{ display: "none" }}
            />
          </label>

          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className={styles.sendBtn}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
