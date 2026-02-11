import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./ScenesPage.css";
import { safeInvoke, getTauriErrorMessage, convertToAssetUrl } from "../utils/tauri";
import type { AudioClip, VideoScene } from "../types";
import RemotionPreview from "./RemotionPreview";
import { useRemotionSync } from "../hooks/useRemotionSync";
import type { PodcastCompositionProps } from "../remotion/PodcastComposition";

const IconSparkles = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M9.813 3.563a.5.5 0 0 1 .874 0l1.121 2.012a.5.5 0 0 0 .262.233l2.151.905a.5.5 0 0 1 0 .914l-2.151.905a.5.5 0 0 0-.262.233L10.687 10.777a.5.5 0 0 1-.874 0L8.692 8.765a.5.5 0 0 0-.262-.233l-2.151-.905a.5.5 0 0 1 0-.914l2.151-.905a.5.5 0 0 0 .262-.233L9.813 3.563z" />
    <path d="M17.406 10.969a.5.5 0 0 1 .874 0l.813 1.458a.5.5 0 0 0 .262.233l1.559.655a.5.5 0 0 1 0 .914l-1.559.655a.5.5 0 0 0-.262.233l-.813 1.458a.5.5 0 0 1-.874 0l-.813-1.458a.5.5 0 0 0-.262-.233l-1.559-.655a.5.5 0 0 1 0-.914l1.559-.655a.5.5 0 0 0 .262-.233l.813-1.458z" />
    <path d="M10.406 15.969a.5.5 0 0 1 .874 0l.813 1.458a.5.5 0 0 0 .262.233l1.559.655a.5.5 0 0 1 0 .914l-1.559.655a.5.5 0 0 0-.262.233l-.813 1.458a.5.5 0 0 1-.874 0l-.813-1.458a.5.5 0 0 0-.262-.233l-1.559-.655a.5.5 0 0 1 0-.914l1.559-.655a.5.5 0 0 0 .262-.233l.813-1.458z" />
  </svg>
);

interface ScenesPageProps {
  audioClips: AudioClip[];
  projectPath?: string;
  onOpenSettings?: () => void;
}

function ScenesPage({ audioClips, projectPath, onOpenSettings }: ScenesPageProps) {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [script, setScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Total audio duration
  const totalDuration = useMemo(() => {
    return Math.max(
      ...audioClips.map(c => c.startTime + c.duration),
      0
    );
  }, [audioClips]);

  // Remotion sync hook for audio playback
  const {
    playerRef,
    currentTime,
    isPlaying,
    durationInFrames,
    handlePlayPause,
    handleSeek,
  } = useRemotionSync({ totalDuration, volume: 1 });

  // Resolve audio clip paths to Tauri asset URLs
  useEffect(() => {
    const paths = audioClips.map(c => c.path);
    const uniquePaths = [...new Set(paths)];

    let cancelled = false;
    Promise.all(
      uniquePaths.map(async (p) => {
        const url = await convertToAssetUrl(p);
        return [p, url] as const;
      })
    ).then((entries) => {
      if (!cancelled) {
        setResolvedUrls(Object.fromEntries(entries));
      }
    });

    return () => { cancelled = true; };
  }, [audioClips]);

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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeekInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    handleSeek(time);
  }, [handleSeek]);

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
      });

      const parsed = JSON.parse(result) as Array<{
        description: string;
        duration: number;
        scriptExcerpt: string;
      }>;

      const newScenes: VideoScene[] = parsed.map((scene, index) => ({
        id: `scene_${Date.now()}_${index}`,
        description: scene.description,
        duration: Math.min(20, Math.max(5, scene.duration)),
        scriptExcerpt: scene.scriptExcerpt,
      }));

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

  // Remotion composition props (audio only, no video on this page)
  const compositionProps: PodcastCompositionProps = useMemo(() => ({
    audioClips,
    videoClips: [],
    resolvedUrls,
  }), [audioClips, resolvedUrls]);

  const totalScenesDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="scenes-page">
      {/* Hidden Remotion Player for audio playback */}
      {audioClips.length > 0 && totalDuration > 0 && (
        <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
          <RemotionPreview
            playerRef={playerRef}
            compositionProps={compositionProps}
            durationInFrames={durationInFrames}
          />
        </div>
      )}

      {/* Header */}
      <div className="scenes-header">
        <div className="scenes-header-left">
          <h2>{t('scenes.title')}</h2>
          {scenes.length > 0 && (
            <span className="scenes-count">
              {t('scenes.count', { count: scenes.length })} · {formatTime(totalScenesDuration)}
            </span>
          )}
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
      </div>

      {error && <div className="scenes-error">{error}</div>}

      {/* Audio Player */}
      {audioClips.length > 0 && (
        <div className="scenes-audio-player">
          <button
            className="audio-play-btn"
            onClick={handlePlayPause}
            disabled={audioClips.length === 0}
          >
            {isPlaying ? "\u23F8" : "\u25B6"}
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
            {scenes.map((scene, index) => (
              <div key={scene.id} className="scene-card">
                <div className="scene-card-header">
                  <span className="scene-number">{t('scenes.sceneNumber', { number: index + 1 })}</span>
                  <span className="scene-duration">{scene.duration}s</span>
                </div>
                <p className="scene-description">{scene.description}</p>
                <p className="scene-excerpt">{"\u00AB"} {scene.scriptExcerpt} {"\u00BB"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenesPage;
