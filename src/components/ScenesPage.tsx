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
import { getStreamingUrl } from "../utils/tauri";
import type { AudioClip, VideoClip, VideoScene } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";
import { usePlaybackTime } from "../hooks/usePlaybackSync";
import { useThumbnailLoader } from "../hooks/useThumbnailLoader";
import { useScenes } from "../hooks/useScenes";
import { IconNotepad, IconClapperboard } from "./Icons";
import SceneCard from "./SceneCard";
import VideoModal from "./VideoModal";
import AudioPlayer from "./AudioPlayer";
import ScenesHeader from "./ScenesHeader";

interface ScenesPageProps {
  audioClips: AudioClip[];
  projectPath?: string;
  onOpenSettings?: () => void;
  onProduceToTimeline?: (clips: VideoClip[]) => void;
  playback: PlaybackHandle;
  isActive?: boolean;
}

function ScenesPage({ audioClips, projectPath, onOpenSettings, onProduceToTimeline, playback, isActive = true }: ScenesPageProps) {
  const { t } = useTranslation();
  const currentTime = usePlaybackTime(playback, isActive);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

  const {
    scenes, script, isGenerating, error,
    editingSceneId, editingText, isProducing,
    produceProgress, produceTotal, downloadingSceneId,
    maxSceneDuration, totalDuration, totalScenesDuration,
    sceneTimings, setEditingText, setMaxSceneDuration,
    handleGenerateScenes, handleStartEdit, handleSaveEdit,
    handleCancelEdit, handleFeed, handleProduceToTimeline,
    handleDeleteVideo,
  } = useScenes({ audioClips, projectPath, onOpenSettings, onProduceToTimeline, isActive });

  const { thumbnailUrls, observeCard } = useThumbnailLoader();

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
      <ScenesHeader
        scenes={scenes}
        script={script}
        isGenerating={isGenerating}
        isProducing={isProducing}
        produceProgress={produceProgress}
        produceTotal={produceTotal}
        maxSceneDuration={maxSceneDuration}
        totalScenesDuration={totalScenesDuration}
        onMaxSceneDurationChange={setMaxSceneDuration}
        onGenerate={handleGenerateScenes}
        onFeed={handleFeed}
        onProduce={handleProduceToTimeline}
      />

      {error && <div className="scenes-error" role="alert">{error}</div>}

      {/* Audio Player */}
      <AudioPlayer
        audioClips={audioClips}
        currentTime={currentTime}
        totalDuration={totalDuration}
        playback={playback}
      />

      {/* Scenes Grid */}
      <div className="scenes-content">
        {scenes.length === 0 ? (
          <div className="scenes-empty">
            {!script.trim() ? (
              <>
                <span className="empty-icon"><IconNotepad /></span>
                <p>{t('scenes.noScript')}</p>
                <p className="empty-hint">{t('scenes.noScriptHint')}</p>
              </>
            ) : (
              <>
                <span className="empty-icon"><IconClapperboard /></span>
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
