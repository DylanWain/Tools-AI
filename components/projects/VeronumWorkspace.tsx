"use client";

import { useState, useEffect } from "react";
import { getCurrentProject, setCurrentProject } from "@/lib/projects";
import { ProjectsList } from "./ProjectsList";
import { ProjectPage } from "./ProjectPage";
import { ProjectCreator } from "./ProjectCreator";
import styles from "./workspace.module.css";

export function VeronumWorkspace() {
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const id = await getCurrentProject();
      setCurrentProjectIdState(id);
      setLoading(false);
    })();
  }, []);

  const handleSelectProject = (id: string) => {
    setCurrentProjectIdState(id);
  };

  const handleNewProject = () => {
    setShowCreator(true);
  };

  const handleProjectCreated = (id: string) => {
    setCurrentProjectIdState(id);
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.workspace}>
      <ProjectsList
        currentProjectId={currentProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
      />

      <div className={styles.main}>
        {currentProjectId ? (
          <ProjectPage projectId={currentProjectId} />
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <h2>No projects yet</h2>
              <p>Create a project to get started</p>
              <button onClick={handleNewProject} className={styles.emptyButton}>
                Create Project
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreator && (
        <ProjectCreator
          onClose={() => setShowCreator(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
