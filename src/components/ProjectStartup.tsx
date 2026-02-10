import { useState, useEffect } from "react";
import { 
  loadProjects, 
  createProject, 
  setCurrentProject, 
  getCurrentProject,
  Project 
} from "../utils/project";
import "./ProjectStartup.css";

// Types pour le plugin dialog
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface ProjectStartupProps {
  onProjectReady: (project: Project) => void;
}

function ProjectStartup({ onProjectReady }: ProjectStartupProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [view, setView] = useState<"main" | "create">("main");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Charger les projets existants
    const savedProjects = loadProjects();
    setProjects(savedProjects);

    // Vérifier s'il y a un projet courant
    const current = getCurrentProject();
    if (current) {
      onProjectReady(current);
    }
  }, [onProjectReady]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError("Veuillez entrer un nom de projet");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      
      // Sélectionner le dossier de destination
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Choisir le dossier du projet",
      });

      if (typeof selectedPath === "string") {
        const projectPath = `${selectedPath}/${projectName.replace(/[^a-zA-Z0-9-_]/g, "_")}`;
        
        // Créer les dossiers du projet
        const { mkdir } = await import("@tauri-apps/plugin-fs");
        await mkdir(projectPath, { recursive: true });
        await mkdir(`${projectPath}/audio`, { recursive: true });
        await mkdir(`${projectPath}/video`, { recursive: true });

        // Créer le projet
        const project = createProject(projectName, projectPath);
        setCurrentProject(project);
        onProjectReady(project);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenProject = async (project: Project) => {
    setCurrentProject(project);
    onProjectReady(project);
  };

  const handleBrowseProject = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Ouvrir un projet existant",
      });

      if (typeof selectedPath === "string") {
        // Vérifier si c'est un projet Kaast (contient script.md ou audio/)
        const projectName = selectedPath.split("/").pop() || "Projet";
        const project = createProject(projectName, selectedPath);
        setCurrentProject(project);
        onProjectReady(project);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  if (view === "create") {
    return (
      <div className="project-startup">
        <div className="startup-dialog">
          <h1>🎙️ Nouveau Projet</h1>
          
          <div className="create-form">
            <label htmlFor="project-name">Nom du projet</label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Mon Podcast"
              autoFocus
            />
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-actions">
              <button
                onClick={() => setView("main")}
                className="btn-secondary"
              >
                Retour
              </button>
              <button
                onClick={handleCreateProject}
                disabled={isCreating || !projectName.trim()}
                className="btn-primary"
              >
                {isCreating ? "Création..." : "Créer le projet"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="project-startup">
      <div className="startup-dialog">
        <div className="startup-header">
          <h1>🎙️ Kaast</h1>
          <p>Studio Podcast Intelligent</p>
        </div>

        <div className="startup-actions">
          <button
            onClick={() => setView("create")}
            className="action-card create"
          >
            <span className="action-icon">➕</span>
            <span className="action-title">Nouveau Projet</span>
            <span className="action-desc">Créer un nouveau podcast</span>
          </button>

          <button
            onClick={handleBrowseProject}
            className="action-card open"
          >
            <span className="action-icon">📂</span>
            <span className="action-title">Ouvrir</span>
            <span className="action-desc">Ouvrir un projet existant</span>
          </button>
        </div>

        {projects.length > 0 && (
          <div className="recent-projects">
            <h3>Projets récents</h3>
            <ul>
              {projects.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => handleOpenProject(project)}
                    className="project-item"
                  >
                    <span className="project-name">{project.name}</span>
                    <span className="project-path">{project.path}</span>
                    <span className="project-date">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

export default ProjectStartup;
