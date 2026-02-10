// Gestion des projets podcast
import { Project } from "../types";
export type { Project };

const PROJECTS_STORAGE_KEY = 'kaast_projects';
const CURRENT_PROJECT_KEY = 'kaast_current_project';

// Sauvegarder la liste des projets
export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

// Charger la liste des projets
export function loadProjects(): Project[] {
  const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// Ajouter un nouveau projet
export function addProject(project: Project): void {
  const projects = loadProjects();
  const existingIndex = projects.findIndex(p => p.id === project.id);
  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    projects.push(project);
  }
  saveProjects(projects);
}

// Supprimer un projet
export function removeProject(projectId: string): void {
  const projects = loadProjects().filter(p => p.id !== projectId);
  saveProjects(projects);
}

// Générer un ID unique
export function generateProjectId(): string {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Sauvegarder le projet courant
export function setCurrentProject(project: Project | null): void {
  if (project) {
    localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(project));
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

// Charger le projet courant
export function getCurrentProject(): Project | null {
  const stored = localStorage.getItem(CURRENT_PROJECT_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

// Créer un nouveau projet avec le chemin spécifié
export function createProject(name: string, path: string): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: generateProjectId(),
    name,
    path,
    createdAt: now,
    updatedAt: now,
  };
  addProject(project);
  return project;
}
