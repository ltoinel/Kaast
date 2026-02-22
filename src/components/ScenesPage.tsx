/**
 * ScenesPage — Manages AI-generated video scenes for the podcast.
 *
 * Users can generate scene descriptions from a script, download stock videos
 * from Pexels for each scene, preview them, and assemble the results
 * onto the Edit timeline.
 */
import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useTranslation } from "react-i18next";
import "./ScenesPage.css";
import { safeInvoke, getTauriErrorMessage, getStreamingUrl, basename } from "../utils/tauri";
import { formatTime } from "../utils/timecode";
import { computeTotalDuration } from "../utils/duration";
import type { AudioClip, VideoClip, VideoScene } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";
import { usePlaybackTime } from "../hooks/usePlaybackSync";
import { useThumbnailLoader } from "../hooks/useThumbnailLoader";
import { getStoredPexelsApiKey } from "./Settings";
import { getStoredSceneStylePrompt } from "./StyleEditor";
import SceneCard from "./SceneCard";
import VideoModal from "./VideoModal";

/** Sparkles icon for the Generate button */
const IconSparkles = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M9.813 3.563a.5.5 0 0 1 .874 0l1.121 2.012a.5.5 0 0 0 .262.233l2.151.905a.5.5 0 0 1 0 .914l-2.151.905a.5.5 0 0 0-.262.233L10.687 10.777a.5.5 0 0 1-.874 0L8.692 8.765a.5.5 0 0 0-.262-.233l-2.151-.905a.5.5 0 0 1 0-.914l2.151-.905a.5.5 0 0 0 .262-.233L9.813 3.563z" />
    <path d="M17.406 10.969a.5.5 0 0 1 .874 0l.813 1.458a.5.5 0 0 0 .262.233l1.559.655a.5.5 0 0 1 0 .914l-1.559.655a.5.5 0 0 0-.262.233l-.813 1.458a.5.5 0 0 1-.874 0l-.813-1.458a.5.5 0 0 0-.262-.233l-1.559-.655a.5.5 0 0 1 0-.914l1.559-.655a.5.5 0 0 0 .262-.233l.813-1.458z" />
    <path d="M10.406 15.969a.5.5 0 0 1 .874 0l.813 1.458a.5.5 0 0 0 .262.233l1.559.655a.5.5 0 0 1 0 .914l-1.559.655a.5.5 0 0 0-.262.233l-.813 1.458a.5.5 0 0 1-.874 0l-.813-1.458a.5.5 0 0 0-.262-.233l-1.559-.655a.5.5 0 0 1 0-.914l1.559-.655a.5.5 0 0 0 .262-.233l.813-1.458z" />
  </svg>
);

/** Download icon for the Feed button */
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/** Film icon for the Produce button */
const IconFilm = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
  </svg>
);

interface ScenesPageProps {
  audioClips: AudioClip[];
  projectPath?: string;
  onOpenSettings?: () => void;
  onProduceToTimeline?: (clips: VideoClip[]) => void;
  playback: PlaybackHandle;
  isActive?: boolean;
}

function ScenesPage({ audioClips, projectPath, onOpenSettings, onProduceToTimeline, playback, isActive = true }: ScenesPageProps) {
  const { t, i18n } = useTranslation();
  const currentTime = usePlaybackTime(playback, isActive);
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [script, setScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [isProducing, setIsProducing] = useState<boolean>(false);
  const [produceProgress, setProduceProgress] = useState<number>(0);
  const [produceTotal, setProduceTotal] = useState<number>(0);
  const [downloadingSceneId, setDownloadingSceneId] = useState<string | null>(null);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [maxSceneDuration, setMaxSceneDuration] = useState<number>(10);

  const { thumbnailUrls, observeCard } = useThumbnailLoader();

  const totalDuration = useMemo(
    () => computeTotalDuration(audioClips, []),
    [audioClips],
  );

  // Load script from project
  useEffect(() => {
    const loadScript = async () => {
      if (!projectPath) return;
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(`${projectPath}/script.md`);
        setScript(content);
      } catch {
        // No script yet
      }
    };
    loadScript();
  }, [projectPath]);

  // Load saved scenes
  useEffect(() => {
    const loadScenes = async () => {
      if (!projectPath) return;
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(`${projectPath}/scenes.json`);
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          setScenes(data);
        }
      } catch {
        // No saved scenes
      }
    };
    loadScenes();
  }, [projectPath]);

  const handleSeekInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    playback.handleSeek(time);
  }, [playback]);

  const handleGenerateScenes = async () => {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      setError(t('scenes.errorNoApiKey'));
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!script.trim()) {
      setError(t('scenes.errorNoScript'));
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const result = await safeInvoke<string>("generate_video_scenes", {
        script: script.trim(),
        apiKey,
        totalDuration,
        maxSceneDuration,
        language: i18n.language,
        sceneStylePrompt: getStoredSceneStylePrompt(),
      });

      const parsed = JSON.parse(result) as Array<{
        description: string;
        duration: number;
        scriptExcerpt: string;
        searchKeywords?: string;
      }>;

      // Scale durations so their sum matches totalDuration
      const rawSum = parsed.reduce((sum, s) => sum + Math.max(1, s.duration), 0);
      const scale = totalDuration > 0 && rawSum > 0 ? totalDuration / rawSum : 1;

      const newScenes: VideoScene[] = parsed.map((scene, index) => ({
        id: `scene_${Date.now()}_${index}`,
        description: scene.description,
        duration: Math.round(Math.max(1, scene.duration) * scale),
        scriptExcerpt: scene.scriptExcerpt,
        searchKeywords: scene.searchKeywords,
      }));

      // Adjust last scene to absorb rounding errors
      if (newScenes.length > 0 && totalDuration > 0) {
        const currentSum = newScenes.reduce((sum, s) => sum + s.duration, 0);
        const diff = Math.round(totalDuration) - currentSum;
        newScenes[newScenes.length - 1].duration = Math.max(1, newScenes[newScenes.length - 1].duration + diff);
      }

      setScenes(newScenes);

      if (projectPath) {
        try {
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          await writeTextFile(
            `${projectPath}/scenes.json`,
            JSON.stringify(newScenes, null, 2)
          );
        } catch (e) {
          console.error("Scene save error:", e);
        }
      }
    } catch (err) {
      setError(getTauriErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const totalScenesDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  // Compute scene timings using actual scene durations
  const sceneTimings = useMemo(() => {
    if (scenes.length === 0) return [];
    let cumulative = 0;
    return scenes.map((scene) => {
      const start = cumulative;
      cumulative += scene.duration;
      return { start, end: cumulative };
    });
  }, [scenes]);

  // Find active scene index based on currentTime
  const activeSceneIndex = useMemo(() => {
    if (!playback.isPlaying && currentTime === 0) return -1;
    for (let i = sceneTimings.length - 1; i >= 0; i--) {
      if (currentTime >= sceneTimings[i].start) return i;
    }
    return -1;
  }, [currentTime, sceneTimings, playback.isPlaying]);

  // Auto-scroll active scene into view
  const activeCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeSceneIndex >= 0 && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSceneIndex]);

  // Click on a scene card to seek to its start time
  const handleSceneClick = useCallback((index: number) => {
    if (sceneTimings[index]) {
      playback.handleSeek(sceneTimings[index].start);
    }
  }, [sceneTimings, playback]);

  // Start editing a scene description
  const handleStartEdit = useCallback((e: React.MouseEvent, scene: VideoScene) => {
    e.stopPropagation();
    setEditingSceneId(scene.id);
    setEditingText(scene.description);
  }, []);

  // Save edited description
  const handleSaveEdit = useCallback(async () => {
    if (!editingSceneId) return;
    const updatedScenes = scenes.map((s) =>
      s.id === editingSceneId ? { ...s, description: editingText } : s
    );
    setScenes(updatedScenes);
    setEditingSceneId(null);

    if (projectPath) {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(
          `${projectPath}/scenes.json`,
          JSON.stringify(updatedScenes, null, 2)
        );
      } catch (e) {
        console.error("Scene save error:", e);
      }
    }
  }, [editingSceneId, editingText, scenes, projectPath]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingSceneId(null);
  }, []);

  /** Download Pexels videos for all scenes sequentially */
  const handleFeed = useCallback(async () => {
    const pexelsKey = getStoredPexelsApiKey();
    if (!pexelsKey) {
      setError(t('scenes.errorNoPexelsKey'));
      if (onOpenSettings) onOpenSettings();
      return;
    }
    if (!projectPath || scenes.length === 0) return;

    setIsProducing(true);
    setError("");
    setProduceTotal(scenes.length);

    const updatedScenes = [...scenes];
    for (let i = 0; i < updatedScenes.length; i++) {
      setProduceProgress(i + 1);
      setDownloadingSceneId(updatedScenes[i].id);

      // Skip if video already exists
      if (updatedScenes[i].videoPath) continue;

      try {
        const videoPath = await safeInvoke<string>("search_and_download_pexels_video", {
          apiKey: pexelsKey,
          query: updatedScenes[i].searchKeywords || updatedScenes[i].description,
          minDuration: updatedScenes[i].duration,
          projectPath,
          sceneIndex: i + 1,
        });
        const thumbPath = `${projectPath}/cache/scene_${String(i + 1).padStart(3, "0")}.jpg`;
        let thumbnailPath: string | undefined;
        try {
          thumbnailPath = await safeInvoke<string>("generate_video_thumbnail", {
            videoPath,
            thumbnailPath: thumbPath,
          });
        } catch (thumbErr) {
          console.error(`Thumbnail generation failed for scene ${i + 1}:`, thumbErr);
        }
        // Generate low-res proxy for preview
        let proxyPath: string | undefined;
        try {
          const proxyFile = `${projectPath}/cache/proxy_${String(i + 1).padStart(3, "0")}.mp4`;
          proxyPath = await safeInvoke<string>("generate_video_proxy", {
            videoPath,
            proxyPath: proxyFile,
          });
        } catch (proxyErr) {
          console.error(`Proxy generation failed for scene ${i + 1}:`, proxyErr);
        }
        updatedScenes[i] = { ...updatedScenes[i], videoPath, thumbnailPath, proxyPath };
      } catch (err) {
        console.error(`Error downloading video for scene ${i + 1}:`, err);
      }
    }

    setScenes(updatedScenes);
    setDownloadingSceneId(null);

    // Persist updated scenes
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(
        `${projectPath}/scenes.json`,
        JSON.stringify(updatedScenes, null, 2)
      );
    } catch (e) {
      console.error("Scene save error:", e);
    }

    setIsProducing(false);
  }, [scenes, projectPath, t, onOpenSettings]);

  /** Assemble scene videos as VideoClips on the Edit timeline */
  const handleProduceToTimeline = useCallback(() => {
    const scenesWithVideo = scenes.filter(s => s.videoPath);
    if (scenesWithVideo.length === 0 || !onProduceToTimeline) return;

    let offset = 0;
    const clips: VideoClip[] = scenesWithVideo.map((scene, index) => {
      const clip: VideoClip = {
        id: `video_${Date.now()}_${index}`,
        name: basename(scene.videoPath!) || `Scene ${index + 1}`,
        path: scene.videoPath!,
        duration: scene.duration,
        startTime: offset,
        thumbnail: scene.thumbnailPath,
        proxyPath: scene.proxyPath,
      };
      offset += scene.duration;
      return clip;
    });

    onProduceToTimeline(clips);
  }, [scenes, onProduceToTimeline]);

  /** Remove video and thumbnail from a scene */
  const handleDeleteVideo = useCallback(async (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    const updatedScenes = scenes.map((s) =>
      s.id === sceneId ? { ...s, videoPath: undefined, thumbnailPath: undefined } : s
    );
    setScenes(updatedScenes);

    if (projectPath) {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(
          `${projectPath}/scenes.json`,
          JSON.stringify(updatedScenes, null, 2)
        );
      } catch (e) {
        console.error("Scene save error:", e);
      }
    }
  }, [scenes, projectPath]);

  /** Open the video modal for a scene via streaming URL */
  const handleOpenVideoModal = useCallback(async (e: React.MouseEvent, scene: VideoScene) => {
    e.stopPropagation();
    if (!scene.videoPath) return;
    try {
      const url = await getStreamingUrl(scene.videoPath);
      setVideoModalUrl(url);
    } catch {
      console.error("Failed to get streaming URL");
    }
  }, []);

  const handleCloseModal = useCallback(() => setVideoModalUrl(null), []);

  return (
    <div className="scenes-page">
      {/* Header */}
      <div className="scenes-header">
        <div className="scenes-header-left">
          <h2>{t('app.scenes')}</h2>
          {scenes.length > 0 && (
            <span className="scenes-count">
              {t('scenes.count', { count: scenes.length })} · {formatTime(totalScenesDuration)}
            </span>
          )}
        </div>
        <div className="scenes-header-actions">
          <div className="scenes-max-duration">
            <label htmlFor="max-scene-duration">{t('scenes.maxDuration')}</label>
            <input
              id="max-scene-duration"
              type="number"
              min={4}
              max={20}
              value={maxSceneDuration}
              onChange={(e) => setMaxSceneDuration(Math.min(20, Math.max(4, parseInt(e.target.value) || 10)))}
              className="scenes-max-duration-input"
            />
            <span className="scenes-max-duration-unit">s</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerateScenes}
            disabled={isGenerating || !script.trim()}
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                {t('scenes.analyzing')}
              </>
            ) : (
              <>
                <IconSparkles />
                {t('scenes.generateScenes')}
              </>
            )}
          </button>
          {scenes.length > 0 && (
            <button
              className="btn btn-success"
              onClick={handleFeed}
              disabled={isProducing}
            >
              {isProducing ? (
                <>
                  <span className="spinner"></span>
                  {t('scenes.feeding', { current: produceProgress, total: produceTotal })}
                </>
              ) : (
                <>
                  <IconDownload />
                  {t('scenes.feed')}
                </>
              )}
            </button>
          )}
          {scenes.some(s => s.videoPath) && (
            <button
              className="btn btn-info"
              onClick={handleProduceToTimeline}
            >
              <IconFilm />
              {t('scenes.produce')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="scenes-error">{error}</div>}

      {/* Audio Player */}
      {audioClips.length > 0 && (
        <div className="scenes-audio-player">
          <button
            className="audio-play-btn"
            onClick={playback.handlePlayPause}
            disabled={audioClips.length === 0}
          >
            {playback.isPlaying ? "\u23F8" : "\u25B6"}
          </button>
          <div className="audio-progress-wrapper">
            <input
              type="range"
              className="audio-progress"
              min="0"
              max={totalDuration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeekInput}
            />
          </div>
          <span className="audio-time">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
          <span className="audio-name">
            {audioClips[0]?.name}
          </span>
        </div>
      )}

      {/* Scenes Grid */}
      <div className="scenes-content">
        {scenes.length === 0 ? (
          <div className="scenes-empty">
            {!script.trim() ? (
              <>
                <span className="empty-icon">{"\uD83D\uDCDD"}</span>
                <p>{t('scenes.noScript')}</p>
                <p className="empty-hint">{t('scenes.noScriptHint')}</p>
              </>
            ) : (
              <>
                <span className="empty-icon">{"\uD83C\uDFAC"}</span>
                <p>{t('scenes.noScenes')}</p>
                <p className="empty-hint">{t('scenes.noScenesHint')}</p>
              </>
            )}
          </div>
        ) : (
          <div className="scenes-grid">
            {scenes.map((scene, index) => {
              const isActive = index === activeSceneIndex;
              const isPast = activeSceneIndex >= 0 && index < activeSceneIndex;
              const timing = sceneTimings[index];
              const progress = isActive && timing
                ? Math.min(1, Math.max(0, (currentTime - timing.start) / (timing.end - timing.start)))
                : 0;
              const needsLazyLoad = !!scene.thumbnailPath && !thumbnailUrls[scene.id];

              return (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={index}
                  isActive={isActive}
                  isPast={isPast}
                  progress={progress}
                  thumbnailUrl={thumbnailUrls[scene.id]}
                  isEditing={editingSceneId === scene.id}
                  editingText={editingText}
                  isDownloading={downloadingSceneId === scene.id}
                  onSceneClick={handleSceneClick}
                  onOpenVideoModal={handleOpenVideoModal}
                  onDeleteVideo={handleDeleteVideo}
                  onStartEdit={handleStartEdit}
                  onEditTextChange={setEditingText}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  observeRef={observeCard}
                  activeCardRef={activeCardRef}
                  needsLazyLoad={needsLazyLoad}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Video playback modal */}
      {videoModalUrl && (
        <VideoModal videoUrl={videoModalUrl} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default memo(ScenesPage);
