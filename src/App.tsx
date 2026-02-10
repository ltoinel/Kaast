import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { isTauriAvailable } from "./utils/tauri";
import { Project, setCurrentProject, getCurrentProject } from "./utils/project";
import ProjectStartup from "./components/ProjectStartup";
import ScriptEditor from "./components/ScriptEditor";
import ScenesPage from "./components/ScenesPage";
import type { AudioClip, VideoClip } from "./types";
import EditPage from "./components/EditPage";
import Settings from "./components/Settings";
import DebugConsole from "./components/DebugConsole";

type TabType = "editor" | "scenes" | "edit" | "settings";

// SVG Icon components
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconDocument = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const IconFilm = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
  </svg>
);

const IconScissors = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const IconTerminal = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

function App() {
  const [currentProject, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("editor");
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [showStartup, setShowStartup] = useState<boolean>(true);
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const autoSaveRef = useRef<number | null>(null);
  const lastSaveRef = useRef<string>("");

  // Charger les fichiers audio du répertoire du projet
  const loadProjectAudioFiles = useCallback(async (projectPath: string) => {
    if (!isTauriAvailable()) return;

    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(projectPath);

      const audioExtensions = ["mp3", "wav", "m4a", "ogg", "flac"];
      const audioFiles = entries.filter(entry => {
        if (entry.isFile && entry.name) {
          const ext = entry.name.split(".").pop()?.toLowerCase() || "";
          return audioExtensions.includes(ext);
        }
        return false;
      });

      if (audioFiles.length > 0) {
        const newClips: AudioClip[] = audioFiles.map((file, index) => ({
          id: `audio_${Date.now()}_${index}`,
          name: file.name || "Audio",
          path: `${projectPath}/${file.name}`,
          duration: 30,
          startTime: index * 30,
        }));
        setAudioClips(newClips);
      }
    } catch (error) {
      console.log("Pas de fichiers audio trouvés:", error);
    }
  }, []);

  // Sauvegarder la timeline dans le fichier JSON du projet
  const saveTimeline = useCallback(async () => {
    if (!currentProject || !isTauriAvailable()) return;

    const timelineData = {
      audioClips,
      videoClips,
      savedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(timelineData, null, 2);

    if (jsonString === lastSaveRef.current) return;

    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const timelinePath = `${currentProject.path}/timeline.json`;
      await writeTextFile(timelinePath, jsonString);
      lastSaveRef.current = jsonString;
    } catch (error) {
      console.error("Erreur sauvegarde timeline:", error);
    }
  }, [currentProject, audioClips, videoClips]);

  // Charger la timeline depuis le fichier JSON du projet
  const loadTimeline = useCallback(async (projectPath: string) => {
    if (!isTauriAvailable()) return;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const timelinePath = `${projectPath}/timeline.json`;
      const content = await readTextFile(timelinePath);
      const data = JSON.parse(content);

      if (data.audioClips && Array.isArray(data.audioClips)) {
        setAudioClips(data.audioClips);
      }
      if (data.videoClips && Array.isArray(data.videoClips)) {
        setVideoClips(data.videoClips);
      }
      lastSaveRef.current = JSON.stringify(data, null, 2);
    } catch {
      await loadProjectAudioFiles(projectPath);
    }
  }, [loadProjectAudioFiles]);

  // Auto-sauvegarde toutes les minutes
  useEffect(() => {
    if (currentProject && !showStartup) {
      autoSaveRef.current = window.setInterval(() => {
        saveTimeline();
      }, 60000);
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [currentProject, showStartup, saveTimeline]);

  useEffect(() => {
    const savedProject = getCurrentProject();
    if (savedProject) {
      setProject(savedProject);
      setShowStartup(false);
      loadTimeline(savedProject.path);
    }
  }, [loadTimeline]);

  const handleProjectReady = useCallback((project: Project) => {
    setProject(project);
    setCurrentProject(project);
    setShowStartup(false);
    loadTimeline(project.path);
  }, [loadTimeline]);

  const handleNewProject = () => {
    setCurrentProject(null);
    setProject(null);
    setAudioClips([]);
    setVideoClips([]);
    setShowStartup(true);
  };

  const handleAudioGenerated = (audioPath: string, duration: number) => {
    const newClip: AudioClip = {
      id: `audio_${Date.now()}`,
      name: audioPath.split("/").pop() || "Podcast",
      path: audioPath,
      duration: duration,
      startTime: audioClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
    };
    setAudioClips([...audioClips, newClip]);
    setActiveTab("scenes");
  };

  const handleDeleteClip = useCallback((clipId: string, type: "audio" | "video") => {
    if (type === "audio") {
      setAudioClips(prev => prev.filter(c => c.id !== clipId));
    } else {
      setVideoClips(prev => prev.filter(c => c.id !== clipId));
    }
  }, []);

  const handleOpenSettings = () => {
    setActiveTab("settings");
  };

  const handleAddMedia = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const files = await open({
        multiple: true,
        filters: [
          { name: "Médias", extensions: ["mp4", "mov", "avi", "mkv", "mp3", "wav", "m4a", "ogg"] },
          { name: "Vidéos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
          { name: "Audio", extensions: ["mp3", "wav", "m4a", "ogg", "flac"] },
        ],
      });

      if (files && Array.isArray(files)) {
        for (const file of files) {
          const fileName = file.split("/").pop() || "Média";
          const ext = fileName.split(".").pop()?.toLowerCase() || "";

          if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
            const newClip: VideoClip = {
              id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: fileName,
              path: file,
              duration: 30,
              startTime: videoClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
            };
            setVideoClips(prev => [...prev, newClip]);
          } else if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) {
            const newClip: AudioClip = {
              id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: fileName,
              path: file,
              duration: 30,
              startTime: audioClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
            };
            setAudioClips(prev => [...prev, newClip]);
          }
        }
      }
    } catch (error) {
      console.error("Erreur import médias:", error);
    }
  };

  if (showStartup) {
    return <ProjectStartup onProjectReady={handleProjectReady} />;
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <button
            className="new-project-btn"
            onClick={handleNewProject}
            title="Nouveau projet"
          >
            <IconPlus />
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
            title="Script"
          >
            <span className="nav-icon"><IconDocument /></span>
          </button>

          <button
            className={`nav-item ${activeTab === "scenes" ? "active" : ""}`}
            onClick={() => setActiveTab("scenes")}
            title="Scènes"
          >
            <span className="nav-icon"><IconFilm /></span>
          </button>

          <button
            className={`nav-item ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
            title="Montage"
          >
            <span className="nav-icon"><IconScissors /></span>
            {(audioClips.length + videoClips.length) > 0 && (
              <span className="nav-badge">{audioClips.length + videoClips.length}</span>
            )}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title="Paramètres"
          >
            <span className="nav-icon"><IconGear /></span>
          </button>
          <button
            className={`nav-item ${showConsole ? "active" : ""}`}
            onClick={() => setShowConsole(!showConsole)}
            title="Console"
          >
            <span className="nav-icon"><IconTerminal /></span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main">
        {/* Project Header */}
        <header className="project-header">
          <h2>{currentProject?.name || "Projet"}</h2>
          <span className="project-path">{currentProject?.path}</span>
        </header>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "editor" && (
            <ScriptEditor
              onAudioGenerated={handleAudioGenerated}
              onOpenSettings={handleOpenSettings}
            />
          )}

          {activeTab === "scenes" && (
            <ScenesPage
              audioClips={audioClips}
              projectPath={currentProject?.path}
              onOpenSettings={handleOpenSettings}
            />
          )}

          {activeTab === "edit" && (
            <EditPage
              audioClips={audioClips}
              videoClips={videoClips}
              onAddMedia={handleAddMedia}
              onDeleteClip={handleDeleteClip}
              projectPath={currentProject?.path}
            />
          )}

          {activeTab === "settings" && (
            <Settings onClose={() => setActiveTab("editor")} />
          )}
        </div>

        {/* Debug Console */}
        {showConsole && (
          <DebugConsole onClose={() => setShowConsole(false)} />
        )}
      </main>
    </div>
  );
}

export default App;
