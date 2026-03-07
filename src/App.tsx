/**
 * App — Root component for the Kaast podcast editor.
 *
 * Orchestrates sidebar navigation, tab-based lazy mounting, shared playback,
 * and project lifecycle. Heavy logic is delegated to custom hooks:
 * - useMediaClips: audio/video clip state & handlers
 * - useResolvedUrls: file-path → webview-URL resolution
 * - useTimelinePersistence: save/load/auto-save timeline to disk
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import { Project, setCurrentProject, getCurrentProject } from "./utils/project";
import ProjectStartup from "./components/ProjectStartup";
import StyleEditor from "./components/StyleEditor";
import ScriptEditor from "./components/ScriptEditor";
import ScenesPage from "./components/ScenesPage";
import type { VideoClip } from "./types";
import EditPage from "./components/EditPage";
import PublishPage from "./components/PublishPage";
import Settings from "./components/Settings";
import DebugConsole from "./components/DebugConsole";
import { useMediaDuration } from "./hooks/useMediaDuration";
import { usePlaybackSync } from "./hooks/usePlaybackSync";
import MediaPreview from "./components/MediaPreview";
import { IconPlus, IconPalette, IconDocument, IconFilm, IconScissors, IconUpload, IconTerminal, IconGear } from "./components/Icons";
import { useResolvedUrls } from "./hooks/useResolvedUrls";
import { useMediaClips } from "./hooks/useMediaClips";
import { useTimelinePersistence } from "./hooks/useTimelinePersistence";
import ErrorBoundary from "./components/ErrorBoundary";

type TabType = "style" | "editor" | "scenes" | "edit" | "publish" | "settings";

/** Stable empty array to avoid defeating React.memo on MediaPreview. */
const EMPTY_VIDEO_CLIPS: VideoClip[] = [];

function App() {
  const { t } = useTranslation();
  const { probe } = useMediaDuration();

  // ── UI state ──────────────────────────────────────────────────────
  const [volume, setVolume] = useState<number>(0.8);
  const [currentProject, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("editor");
  const [showStartup, setShowStartup] = useState<boolean>(true);
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(new Set(["editor"]));

  // ── Custom hooks ──────────────────────────────────────────────────
  const navigateToEdit = useCallback(() => setActiveTab("edit"), []);
  const {
    audioClips, videoClips, setAudioClips, setVideoClips,
    totalDuration, loadProjectAudioFiles,
    handleAudioGenerated, handleDeleteClip, handleMoveClip,
    handleProduceToTimeline, handleAddMedia,
  } = useMediaClips(probe, navigateToEdit);

  const resolvedUrls = useResolvedUrls(audioClips, videoClips);

  const { loadTimeline } = useTimelinePersistence({
    currentProject,
    showStartup,
    audioClips,
    videoClips,
    setAudioClips,
    setVideoClips,
    loadProjectAudioFiles,
  });

  // Single shared playback instance — active on Script, Scenes & Edit tabs
  const sharedPlayback = usePlaybackSync({
    totalDuration,
    volume,
    isActive: activeTab === "editor" || activeTab === "scenes" || activeTab === "edit",
  });

  // ── Effects ───────────────────────────────────────────────────────

  // Track visited tabs for lazy mounting
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set(prev).add(activeTab);
    });
  }, [activeTab]);

  // Restore persisted project on first mount
  useEffect(() => {
    const signal = { cancelled: false };
    const savedProject = getCurrentProject();
    if (savedProject) {
      setProject(savedProject);
      setShowStartup(false);
      loadTimeline(savedProject.path, signal);
    }
    return () => { signal.cancelled = true; };
  }, [loadTimeline]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleProjectReady = useCallback((project: Project) => {
    setProject(project);
    setCurrentProject(project);
    setShowStartup(false);
    loadTimeline(project.path);
  }, [loadTimeline]);

  const handleNewProject = useCallback(() => {
    setCurrentProject(null);
    setProject(null);
    setAudioClips([]);
    setVideoClips([]);
    setShowStartup(true);
  }, [setAudioClips, setVideoClips]);

  const handleOpenSettings = useCallback(() => {
    setActiveTab("settings");
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  if (showStartup) {
    return <ProjectStartup onProjectReady={handleProjectReady} />;
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <button
            className="new-project-btn"
            onClick={handleNewProject}
            title={t('app.newProject')}
            aria-label={t('app.newProject')}
          >
            <IconPlus />
          </button>
        </div>

        <nav className="sidebar-nav" role="tablist" aria-orientation="vertical">
          <button
            className={`nav-item ${activeTab === "style" ? "active" : ""}`}
            onClick={() => setActiveTab("style")}
            title={t('app.style')}
            aria-label={t('app.style')}
            role="tab"
            aria-selected={activeTab === "style"}
          >
            <span className="nav-icon" aria-hidden="true"><IconPalette /></span>
          </button>

          <button
            className={`nav-item ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
            title={t('app.script')}
            aria-label={t('app.script')}
            role="tab"
            aria-selected={activeTab === "editor"}
          >
            <span className="nav-icon" aria-hidden="true"><IconDocument /></span>
          </button>

          <button
            className={`nav-item ${activeTab === "scenes" ? "active" : ""}`}
            onClick={() => setActiveTab("scenes")}
            title={t('app.scenes')}
            aria-label={t('app.scenes')}
            role="tab"
            aria-selected={activeTab === "scenes"}
          >
            <span className="nav-icon" aria-hidden="true"><IconFilm /></span>
          </button>

          <button
            className={`nav-item ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
            title={t('app.edit')}
            aria-label={t('app.edit')}
            role="tab"
            aria-selected={activeTab === "edit"}
          >
            <span className="nav-icon" aria-hidden="true"><IconScissors /></span>
          </button>

          <button
            className={`nav-item ${activeTab === "publish" ? "active" : ""}`}
            onClick={() => setActiveTab("publish")}
            title={t('app.publish')}
            aria-label={t('app.publish')}
            role="tab"
            aria-selected={activeTab === "publish"}
          >
            <span className="nav-icon" aria-hidden="true"><IconUpload /></span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title={t('app.settings')}
            aria-label={t('app.settings')}
          >
            <span className="nav-icon" aria-hidden="true"><IconGear /></span>
          </button>
          <button
            className={`nav-item ${showConsole ? "active" : ""}`}
            onClick={() => setShowConsole(!showConsole)}
            title={t('app.console')}
            aria-label={t('app.console')}
            aria-pressed={showConsole}
          >
            <span className="nav-icon" aria-hidden="true"><IconTerminal /></span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main">
        {/* Project Header */}
        <header className="project-header">
          <h2>{currentProject?.name || t('app.project')}</h2>
          <span className="project-path">{currentProject?.path}</span>
        </header>

        {/* Shared audio playback — single hidden MediaPreview for all tabs */}
        {audioClips.length > 0 && totalDuration > 0 && (
          <div style={{ position: "fixed", left: -9999, top: -9999, width: 0, height: 0, overflow: "hidden" }}>
            <MediaPreview
              audioClips={audioClips}
              videoClips={EMPTY_VIDEO_CLIPS}
              resolvedUrls={resolvedUrls}
              playback={sharedPlayback}
              audioOnly
            />
          </div>
        )}

        {/* Tab Content — CSS-based visibility with lazy mounting */}
        <div className="tab-content">
          <div className={`tab-panel ${activeTab !== "style" ? "tab-panel-hidden" : ""}`} role="tabpanel" aria-label={t('app.style')}>
            {visitedTabs.has("style") && (
              <ErrorBoundary name="style">
                <StyleEditor />
              </ErrorBoundary>
            )}
          </div>

          <div className={`tab-panel ${activeTab !== "editor" ? "tab-panel-hidden" : ""}`} role="tabpanel" aria-label={t('app.script')}>
            {visitedTabs.has("editor") && (
              <ErrorBoundary name="editor">
                <ScriptEditor
                  audioClips={audioClips}
                  onAudioGenerated={handleAudioGenerated}
                  onOpenSettings={handleOpenSettings}
                  playback={sharedPlayback}
                  isActive={activeTab === "editor"}
                />
              </ErrorBoundary>
            )}
          </div>

          <div className={`tab-panel ${activeTab !== "scenes" ? "tab-panel-hidden" : ""}`} role="tabpanel" aria-label={t('app.scenes')}>
            {visitedTabs.has("scenes") && (
              <ErrorBoundary name="scenes">
                <ScenesPage
                  audioClips={audioClips}
                  projectPath={currentProject?.path}
                  onOpenSettings={handleOpenSettings}
                  onProduceToTimeline={handleProduceToTimeline}
                  playback={sharedPlayback}
                  isActive={activeTab === "scenes"}
                />
              </ErrorBoundary>
            )}
          </div>

          <div className={`tab-panel ${activeTab !== "edit" ? "tab-panel-hidden" : ""}`} role="tabpanel" aria-label={t('app.edit')}>
            {visitedTabs.has("edit") && (
              <ErrorBoundary name="edit">
                <EditPage
                  audioClips={audioClips}
                  videoClips={videoClips}
                  totalDuration={totalDuration}
                  onAddMedia={handleAddMedia}
                  onDeleteClip={handleDeleteClip}
                  onMoveClip={handleMoveClip}
                  projectPath={currentProject?.path}
                  isTabActive={activeTab === "edit"}
                  playback={sharedPlayback}
                  resolvedUrls={resolvedUrls}
                  volume={volume}
                  onVolumeChange={setVolume}
                />
              </ErrorBoundary>
            )}
          </div>

          <div className={`tab-panel ${activeTab !== "publish" ? "tab-panel-hidden" : ""}`} role="tabpanel" aria-label={t('app.publish')}>
            {visitedTabs.has("publish") && (
              <ErrorBoundary name="publish">
                <PublishPage
                  audioClips={audioClips}
                  videoClips={videoClips}
                  totalDuration={totalDuration}
                  projectPath={currentProject?.path}
                  projectName={currentProject?.name}
                />
              </ErrorBoundary>
            )}
          </div>

          <div className={`tab-panel ${activeTab !== "settings" ? "tab-panel-hidden" : ""}`} role="tabpanel" aria-label={t('app.settings')}>
            {visitedTabs.has("settings") && (
              <ErrorBoundary name="settings">
                <Settings onClose={() => setActiveTab("editor")} />
              </ErrorBoundary>
            )}
          </div>
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
