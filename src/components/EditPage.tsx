import { useState, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "./EditPage.css";
import type { AudioClip, VideoClip } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";
import { usePlaybackTime } from "../hooks/usePlaybackSync";
import Timeline from "./Timeline";
import MediaPreview from "./MediaPreview";
import { formatTimecode } from "../utils/timecode";

interface EditPageProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  totalDuration: number;
  onAddMedia?: () => void;
  onDeleteClip?: (clipId: string, type: "audio" | "video") => void;
  onMoveClip?: (clipId: string, type: "audio" | "video", newStartTime: number) => void;
  projectPath?: string;
  isTabActive?: boolean;
  playback: PlaybackHandle;
  resolvedUrls: Record<string, string>;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

function EditPage({ audioClips, videoClips, totalDuration, onAddMedia, onDeleteClip, onMoveClip, isTabActive = true, playback, resolvedUrls, volume, onVolumeChange }: EditPageProps) {
  const { t } = useTranslation();
  const [selectedClip, setSelectedClip] = useState<AudioClip | VideoClip | null>(null);
  const [selectedClipType, setSelectedClipType] = useState<"audio" | "video" | null>(null);
  const currentTime = usePlaybackTime(playback, isTabActive);

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
    playback.handleSeek(clip.startTime);
    if (!playback.isPlaying) {
      playback.handlePlayPause();
    }
  }, [playback]);

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
                <MediaPreview
                  audioClips={audioClips}
                  videoClips={videoClips}
                  resolvedUrls={resolvedUrls}
                  playback={playback}
                  videoOnly
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
          <div className="transport-controls" role="toolbar" aria-label={t('edit.previewTitle')}>
            <div className="transport-left">
              <button className="transport-btn" title={t('edit.goToStart')} aria-label={t('edit.goToStart')} onClick={playback.handleStop}>
                |&lt;
              </button>
              <button className="transport-btn" title={t('edit.previousFrame')} aria-label={t('edit.previousFrame')} onClick={playback.handlePrevFrame}>
                &lt;
              </button>
            </div>

            <button
              className={`transport-btn play-btn ${playback.isPlaying ? "playing" : ""}`}
              onClick={playback.handlePlayPause}
              title={playback.isPlaying ? t('edit.pause') : t('edit.play')}
              aria-label={playback.isPlaying ? t('edit.pause') : t('edit.play')}
            >
              {playback.isPlaying ? "||" : "\u25B6"}
            </button>

            <div className="transport-right">
              <button className="transport-btn" title={t('edit.nextFrame')} aria-label={t('edit.nextFrame')} onClick={playback.handleNextFrame}>
                &gt;
              </button>
              <button className="transport-btn" title={t('edit.goToEnd')} aria-label={t('edit.goToEnd')} onClick={playback.handleGoToEnd}>
                &gt;|
              </button>
            </div>

            <div className="volume-control">
              <span className="volume-icon" aria-hidden="true">{volume > 0 ? "\u{1F50A}" : "\u{1F507}"}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="volume-slider"
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={volume}
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
          totalDuration={totalDuration}
          resolvedUrls={resolvedUrls}
          selectedClipId={selectedClip?.id ?? null}
          onClipSelect={handleClipSelect}
          onPlayClip={handlePlayClip}
          onMoveClip={onMoveClip}
          currentTime={currentTime}
          isPlaying={playback.isPlaying}
          onSeek={playback.handleSeek}
        />
      </div>
    </div>
  );
}

export default memo(EditPage);
