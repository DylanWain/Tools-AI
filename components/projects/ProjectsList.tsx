"use client";

import { useState, useEffect } from "react";
import { listProjects, setCurrentProject, type Project } from "@/lib/projects";
import styles from "./projects.module.css";

interface ProjectsListProps {
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
}

export function ProjectsList({ currentProjectId, onSelectProject, onNewProject }: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await listProjects();
      setProjects(list.sort((a, b) => b.updatedAt - a.updatedAt));
      setLoading(false);
    })();
  }, []);

  const handleSelectProject = (id: string) => {
    setCurrentProject(id);
    onSelectProject(id);
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>Projects</h2>
        <button className={styles.newProjectBtn} onClick={onNewProject}>
          + New
        </button>
      </div>

      <div className={styles.projectsList}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>No projects yet. Create one to get started.</div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`${styles.projectItem} ${currentProjectId === project.id ? styles.active : ""}`}
              onClick={() => handleSelectProject(project.id)}
            >
              <div className={styles.projectName}>{project.name}</div>
              <div className={styles.projectInfo}>
                {project.chats.length} chat{project.chats.length !== 1 ? "s" : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
