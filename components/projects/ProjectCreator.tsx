"use client";

import { useState } from "react";
import { createProject, type MCPSource } from "@/lib/projects";
import styles from "./projects.module.css";

interface ProjectCreatorProps {
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function ProjectCreator({ onClose, onCreated }: ProjectCreatorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setCreating(true);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Create New Project</h2>
        <div className={styles.formGroup}>
          <label>Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Startup"
            disabled={creating}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project about?"
            disabled={creating}
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button onClick={onClose} disabled={creating} className={styles.secondaryBtn}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating} className={styles.primaryBtn}>
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
