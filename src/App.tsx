import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { safeInvoke, getTauriErrorMessage, isTauriAvailable } from "./utils/tauri";
import { Project, setCurrentProject, getCurrentProject } from "./utils/project";
import ProjectStartup from "./components/ProjectStartup";
import ScriptEditor from "./components/ScriptEditor";
import { AudioClip, VideoClip } from "./components/Timeline";
import EditPage from "./components/EditPage";
import Settings from "./components/Settings";

type TabType = "editor" | "edit" | "settings";

function App() {
  const [currentProject, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("editor");
  const [ffmpegStatus, setFfmpegStatus] = useState<string>("");
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(false);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [showStartup, setShowStartup] = useState<boolean>(true);
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
          duration: 30, // TODO: détecter la vraie durée
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
    
    // Ne sauvegarder que si les données ont changé
    if (jsonString === lastSaveRef.current) return;
    
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const timelinePath = `${currentProject.path}/timeline.json`;
      await writeTextFile(timelinePath, jsonString);
      lastSaveRef.current = jsonString;
      console.log("Timeline sauvegardée automatiquement");
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
    } catch (error) {
      // Le fichier n'existe pas encore, charger les fichiers audio du dossier
      await loadProjectAudioFiles(projectPath);
    }
  }, [loadProjectAudioFiles]);

  // Auto-sauvegarde toutes les minutes
  useEffect(() => {
    if (currentProject && !showStartup) {
      autoSaveRef.current = window.setInterval(() => {
        saveTimeline();
      }, 60000); // 60 secondes = 1 minute
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [currentProject, showStartup, saveTimeline]);

  useEffect(() => {
    // Vérifier s'il y a un projet courant
    const savedProject = getCurrentProject();
    if (savedProject) {
      setProject(savedProject);
      setShowStartup(false);
      // Charger la timeline depuis le fichier JSON du projet
      loadTimeline(savedProject.path);
    }
    // Vérifier FFmpeg au démarrage
    checkFFmpeg();
  }, [loadTimeline]);

  const checkFFmpeg = async () => {
    try {
      const result = await safeInvoke<string>("check_ffmpeg");
      setFfmpegStatus(result);
      setFfmpegAvailable(true);
    } catch (error) {
      const errorMsg = getTauriErrorMessage(error);
      setFfmpegStatus(errorMsg);
      setFfmpegAvailable(false);
    }
  };

  const handleProjectReady = useCallback((project: Project) => {
    setProject(project);
    setCurrentProject(project);
    setShowStartup(false);
    // Charger la timeline du projet (ou les fichiers audio si pas de timeline)
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
    setActiveTab("edit");
  };

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
              duration: 30, // TODO: Détecter la vraie durée
              startTime: videoClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
            };
            setVideoClips(prev => [...prev, newClip]);
          } else if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) {
            const newClip: AudioClip = {
              id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: fileName,
              path: file,
              duration: 30, // TODO: Détecter la vraie durée
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

  // Afficher l'écran de démarrage si pas de projet
  if (showStartup) {
    return <ProjectStartup onProjectReady={handleProjectReady} />;
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <h1>🎙️</h1>
          <span>Kaast</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
            title="Éditeur de script"
          >
            <span className="nav-icon">📝</span>
            <span className="nav-label">Script</span>
          </button>

          <button
            className={`nav-item ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
            title="Montage"
          >
            <span className="nav-icon">🎬</span>
            <span className="nav-label">Montage</span>
            {(audioClips.length + videoClips.length) > 0 && (
              <span className="nav-badge">{audioClips.length + videoClips.length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title="Paramètres"
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Paramètres</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            className="new-project-btn"
            onClick={handleNewProject}
            title="Nouveau projet"
          >
            ➕
          </button>
          <div className="ffmpeg-status">
            {ffmpegAvailable ? (
              <span className="status-ok" title={ffmpegStatus}>✅</span>
            ) : (
              <span className="status-error" title={ffmpegStatus}>⚠️</span>
            )}
          </div>
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

          {activeTab === "edit" && (
            <EditPage
              audioClips={audioClips}
              videoClips={videoClips}
              onAddMedia={handleAddMedia}
              projectPath={currentProject?.path}
            />
          )}

          {activeTab === "settings" && (
            <Settings onClose={() => setActiveTab("editor")} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
