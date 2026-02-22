import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  loadProjects,
  createProject,
  setCurrentProject,
  getCurrentProject,
  Project
} from "../utils/project";
import { basename } from "../utils/tauri";
import { useAsyncAction } from "../hooks/useAsyncAction";
import "./ProjectStartup.css";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface ProjectStartupProps {
  onProjectReady: (project: Project) => void;
}

function ProjectStartup({ onProjectReady }: ProjectStartupProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [view, setView] = useState<"main" | "create">("main");
  const action = useAsyncAction();

  useEffect(() => {
    const savedProjects = loadProjects();
    setProjects(savedProjects);

    const current = getCurrentProject();
    if (current) {
      onProjectReady(current);
    }
  }, [onProjectReady]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      action.setError(t('startup.errorNoName'));
      return;
    }

    await action.run(async () => {
      const { open } = await import("@tauri-apps/plugin-dialog");

      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: t('startup.chooseFolder'),
      });

      if (typeof selectedPath === "string") {
        const projectPath = `${selectedPath}/${projectName.replace(/[^a-zA-Z0-9-_]/g, "_")}`;

        const { mkdir } = await import("@tauri-apps/plugin-fs");
        await mkdir(projectPath, { recursive: true });
        await mkdir(`${projectPath}/audio`, { recursive: true });
        await mkdir(`${projectPath}/video`, { recursive: true });

        const project = createProject(projectName, projectPath);
        setCurrentProject(project);
        onProjectReady(project);
      }
    });
  };

  const handleOpenProject = async (project: Project) => {
    setCurrentProject(project);
    onProjectReady(project);
  };

  const handleBrowseProject = async () => {
    await action.run(async () => {
      const { open } = await import("@tauri-apps/plugin-dialog");

      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: t('startup.openExistingProject'),
      });

      if (typeof selectedPath === "string") {
        const name = basename(selectedPath) || t('app.project');
        const project = createProject(name, selectedPath);
        setCurrentProject(project);
        onProjectReady(project);
      }
    });
  };

  if (view === "create") {
    return (
      <div className="project-startup">
        <div className="startup-dialog">
          <h1>🎙️ {t('startup.newProject')}</h1>

          <div className="create-form">
            <label htmlFor="project-name">{t('startup.projectNameLabel')}</label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t('startup.projectNamePlaceholder')}
              autoFocus
            />

            {action.error && <div className="error-message">{action.error}</div>}

            <div className="form-actions">
              <button
                onClick={() => setView("main")}
                className="btn-secondary"
              >
                {t('startup.back')}
              </button>
              <button
                onClick={handleCreateProject}
                disabled={action.isLoading || !projectName.trim()}
                className="btn-primary"
              >
                {action.isLoading ? t('startup.creating') : t('startup.createProject')}
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
          <h1>🎙️ {t('startup.title')}</h1>
          <p>{t('startup.subtitle')}</p>
        </div>

        <div className="startup-actions">
          <button
            onClick={() => setView("create")}
            className="action-card create"
          >
            <span className="action-icon">➕</span>
            <span className="action-title">{t('startup.newProject')}</span>
            <span className="action-desc">{t('startup.newProjectDesc')}</span>
          </button>

          <button
            onClick={handleBrowseProject}
            className="action-card open"
          >
            <span className="action-icon">📂</span>
            <span className="action-title">{t('startup.open')}</span>
            <span className="action-desc">{t('startup.openDesc')}</span>
          </button>
        </div>

        {projects.length > 0 && (
          <div className="recent-projects">
            <h3>{t('startup.recentProjects')}</h3>
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

        {action.error && <div className="error-message">{action.error}</div>}
      </div>
    </div>
  );
}

export default ProjectStartup;
