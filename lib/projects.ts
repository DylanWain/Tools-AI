/**
 * Projects data structures and utilities.
 * A Project groups multiple chats (from different LLMs/tools) around shared repos.
 */

export type MCPSource = "claude-code" | "cursor" | "codex" | "vscode";
export type LLMType = "claude" | "gpt" | "gemini" | "grok";

export interface ProjectChat {
  id: string;
  name: string;
  mcp: MCPSource; // Which tool/MCP this chat connects to
  llm?: LLMType; // Optional: which LLM model within that tool
  sourceSessionId?: string; // If loading from existing session
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  chats: ProjectChat[]; // All chats in this project
  createdAt: number;
  updatedAt: number;
}

export interface ProjectsState {
  projects: Record<string, Project>;
  currentProjectId: string | null;
}

// IndexedDB keys
const PROJECTS_STORE = "veronum_projects";
const CURRENT_PROJECT_KEY = "currentProjectId";

export async function initProjectsDB() {
  if (typeof window === "undefined") return;
  const db = await openDB();
  return db;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("veronum", 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
      }
    };
  });
}

export async function createProject(input: { name: string; description?: string }): Promise<Project> {
  const db = await openDB();
  const project: Project = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    chats: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.add(project);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(project);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function listProjects(): Promise<Project[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function addChatToProject(projectId: string, chat: ProjectChat): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");
  project.chats.push(chat);
  project.updatedAt = Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.put(project);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(project);
  });
}

export async function removeChatFromProject(projectId: string, chatId: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");
  project.chats = project.chats.filter((c) => c.id !== chatId);
  project.updatedAt = Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    const store = tx.objectStore(PROJECTS_STORE);
    const req = store.put(project);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(project);
  });
}

export async function setCurrentProject(projectId: string) {
  localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
}

export async function getCurrentProject(): Promise<string | null> {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
}
