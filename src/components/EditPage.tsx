import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import "./EditPage.css";
import type { AudioClip, VideoClip } from "../types";
import Timeline from "./Timeline";
import RemotionPreview from "./RemotionPreview";
import { useRemotionSync } from "../hooks/useRemotionSync";
import { loadAudioAsBlob, loadFileAsDataUri, convertToAssetUrl } from "../utils/tauri";
import { formatTimecode } from "../remotion/constants";
import type { PodcastCompositionProps } from "../remotion/PodcastComposition";

interface EditPageProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  onAddMedia?: () => void;
  onDeleteClip?: (clipId: string, type: "audio" | "video") => void;
  onMoveClip?: (clipId: string, type: "audio" | "video", newStartTime: number) => void;
  projectPath?: string;
}

function EditPage({ audioClips, videoClips, onAddMedia, onDeleteClip, onMoveClip }: EditPageProps) {
  const { t } = useTranslation();
  const [selectedClip, setSelectedClip] = useState<AudioClip | VideoClip | null>(null);
  const [selectedClipType, setSelectedClipType] = useState<"audio" | "video" | null>(null);
  const [volume, setVolume] = useState<number>(0.8);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Compute total duration from all clips
  const totalDuration = useMemo(() => {
    return Math.max(
      ...audioClips.map(c => c.startTime + c.duration),
      ...videoClips.map(c => c.startTime + c.duration),
      0
    );
  }, [audioClips, videoClips]);

  // Remotion sync hook for playback
  const {
    playerRef,
    currentTime,
    isPlaying,
    durationInFrames,
    handlePlayPause,
    handleStop,
    handleSeek,
    handleNextFrame,
    handlePrevFrame,
    handleGoToEnd,
  } = useRemotionSync({ totalDuration, volume });

  // Phase 1: Thumbnails — instant via Tauri asset protocol (no file read, no IPC)
  useEffect(() => {
    const thumbPaths = [...new Set(videoClips.map(c => c.thumbnail).filter(Boolean) as string[])];
    if (thumbPaths.length === 0) return;

    let cancelled = false;
    Promise.all(
      thumbPaths.map(async (p) => {
        try {
          const url = await convertToAssetUrl(p);
          return [p, url] as const;
        } catch {
          return [p, ""] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setResolvedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });
    return () => { cancelled = true; };
  }, [videoClips]);

  // Phase 2: Audio — data URI via Rust (needed for Remotion playback)
  useEffect(() => {
    const audioPaths = [...new Set(audioClips.map(c => c.path))];
    if (audioPaths.length === 0) return;

    let cancelled = false;
    Promise.all(
      audioPaths.map(async (p) => {
        try {
          const dataUri = await loadAudioAsBlob(p);
          return [p, dataUri] as const;
        } catch {
          return [p, ""] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setResolvedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });
    return () => { cancelled = true; };
  }, [audioClips]);

  // Phase 3: Video proxies — data URI via Rust (deferred, heaviest)
  useEffect(() => {
    const videoPaths = [...new Set(videoClips.map(c => c.path))];
    if (videoPaths.length === 0) return;

    const proxyMap = new Map<string, string>();
    for (const c of videoClips) {
      if (c.proxyPath && !proxyMap.has(c.path)) {
        proxyMap.set(c.path, c.proxyPath);
      }
    }

    let cancelled = false;
    Promise.all(
      videoPaths.map(async (p) => {
        const fileToLoad = proxyMap.get(p) || p;
        try {
          const dataUri = await loadFileAsDataUri(fileToLoad);
          return [p, dataUri] as const;
        } catch {
          return [p, ""] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setResolvedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });
    return () => { cancelled = true; };
  }, [videoClips]);

  // Build composition props for Remotion
  const compositionProps: PodcastCompositionProps = useMemo(() => ({
    audioClips,
    videoClips,
    resolvedUrls,
  }), [audioClips, videoClips, resolvedUrls]);

  // Delete selected clip with Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedClip && selectedClipType && onDeleteClip) {
        onDeleteClip(selectedClip.id, selectedClipType);
        setSelectedClip(null);
        setSelectedClipType(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClip, selectedClipType, onDeleteClip]);

  const handleClipSelect = useCallback((clipId: string, type: "audio" | "video") => {
    const clip = type === "audio"
      ? audioClips.find(c => c.id === clipId)
      : videoClips.find(c => c.id === clipId);
    setSelectedClip(clip || null);
    setSelectedClipType(clip ? type : null);
  }, [audioClips, videoClips]);

  const handlePlayClip = useCallback((clip: AudioClip | VideoClip) => {
    handleSeek(clip.startTime);
    if (!isPlaying) {
      handlePlayPause();
    }
  }, [handleSeek, handlePlayPause, isPlaying]);

  const hasMedia = audioClips.length > 0 || videoClips.length > 0;

  return (
    <div className="edit-page">
      {/* Page Header */}
      <div className="edit-header">
        <h2>{t('app.edit')}</h2>
      </div>

      {/* Top Section: Media Browser + Preview */}
      <div className="edit-top">
        {/* Media Browser Panel */}
        <div className="media-browser">
          <div className="panel-header">
            <span className="panel-title">{t('edit.mediaTitle')}</span>
            <button className="panel-btn" onClick={onAddMedia} title={t('edit.import')}>
              +
            </button>
          </div>
          <div className="media-list">
            {!hasMedia ? (
              <div className="media-empty">
                <p>{t('edit.noMedia')}</p>
                <button className="btn btn-primary btn-sm" onClick={onAddMedia}>
                  {t('edit.importFiles')}
                </button>
              </div>
            ) : (
              <>
                {videoClips.map(clip => (
                  <div
                    key={clip.id}
                    className={`media-item video ${selectedClip?.id === clip.id ? "selected" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/clip-id", clip.id);
                      e.dataTransfer.setData("application/clip-type", "video");
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => handleClipSelect(clip.id, "video")}
                    onDoubleClick={() => handlePlayClip(clip)}
                  >
                    <div className="media-thumbnail video-thumb">
                      {clip.thumbnail && resolvedUrls[clip.thumbnail] ? (
                        <img src={resolvedUrls[clip.thumbnail]} alt={clip.name} />
                      ) : (
                        <span>V</span>
                      )}
                    </div>
                    <div className="media-info">
                      <span className="media-name">{clip.name}</span>
                      <span className="media-duration">{formatTimecode(clip.duration)}</span>
                    </div>
                  </div>
                ))}
                {audioClips.map(clip => (
                  <div
                    key={clip.id}
                    className={`media-item audio ${selectedClip?.id === clip.id ? "selected" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/clip-id", clip.id);
                      e.dataTransfer.setData("application/clip-type", "audio");
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => handleClipSelect(clip.id, "audio")}
                    onDoubleClick={() => handlePlayClip(clip)}
                  >
                    <div className="media-thumbnail audio-thumb">
                      <span>A</span>
                    </div>
                    <div className="media-info">
                      <span className="media-name">{clip.name}</span>
                      <span className="media-duration">{formatTimecode(clip.duration)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Preview Monitor */}
        <div className="preview-monitor">
          <div className="panel-header">
            <span className="panel-title">{t('edit.previewTitle')}</span>
            <div className="monitor-tabs">
              <button className="tab-btn active">{t('edit.source')}</button>
              <button className="tab-btn">{t('edit.program')}</button>
            </div>
          </div>
          <div className="monitor-viewport">
            <div className="viewport-content">
              {hasMedia ? (
                <RemotionPreview
                  playerRef={playerRef}
                  compositionProps={compositionProps}
                  durationInFrames={durationInFrames}
                />
              ) : (
                <div className="viewport-placeholder">
                  <p>{t('edit.noVideoPreview')}</p>
                  <p className="placeholder-hint">{t('edit.importVideoHint')}</p>
                </div>
              )}
            </div>

            <div className="timecode-display">
              <span className="timecode">{formatTimecode(currentTime)}</span>
              <span className="timecode-separator">/</span>
              <span className="timecode total">{formatTimecode(totalDuration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="transport-controls">
            <div className="transport-left">
              <button className="transport-btn" title={t('edit.goToStart')} onClick={handleStop}>
                |&lt;
              </button>
              <button className="transport-btn" title={t('edit.previousFrame')} onClick={handlePrevFrame}>
                &lt;
              </button>
            </div>

            <button
              className={`transport-btn play-btn ${isPlaying ? "playing" : ""}`}
              onClick={handlePlayPause}
              title={isPlaying ? t('edit.pause') : t('edit.play')}
            >
              {isPlaying ? "||" : "\u25B6"}
            </button>

            <div className="transport-right">
              <button className="transport-btn" title={t('edit.nextFrame')} onClick={handleNextFrame}>
                &gt;
              </button>
              <button className="transport-btn" title={t('edit.goToEnd')} onClick={handleGoToEnd}>
                &gt;|
              </button>
            </div>

            <div className="volume-control">
              <span className="volume-icon">{volume > 0 ? "\u{1F50A}" : "\u{1F507}"}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider"
              />
            </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="inspector-panel">
          <div className="panel-header">
            <span className="panel-title">{t('edit.inspectorTitle')}</span>
          </div>
          <div className="inspector-content">
            {selectedClip ? (
              <div className="clip-properties">
                <h4>{t('edit.clipProperties')}</h4>
                <div className="property-group">
                  <label>{t('edit.name')}</label>
                  <input type="text" value={selectedClip.name} readOnly />
                </div>
                <div className="property-group">
                  <label>{t('edit.duration')}</label>
                  <span className="property-value">{formatTimecode(selectedClip.duration)}</span>
                </div>
                <div className="property-group">
                  <label>{t('edit.position')}</label>
                  <span className="property-value">{formatTimecode(selectedClip.startTime)}</span>
                </div>
                <div className="property-group">
                  <label>{t('edit.path')}</label>
                  <span className="property-value path">{selectedClip.path}</span>
                </div>
              </div>
            ) : (
              <div className="inspector-empty">
                <p>{t('edit.selectClip')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Timeline */}
      <div className="edit-bottom">
        <Timeline
          audioClips={audioClips}
          videoClips={videoClips}
          resolvedUrls={resolvedUrls}
          selectedClipId={selectedClip?.id ?? null}
          onClipSelect={handleClipSelect}
          onPlayClip={handlePlayClip}
          onMoveClip={onMoveClip}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

export default memo(EditPage);
