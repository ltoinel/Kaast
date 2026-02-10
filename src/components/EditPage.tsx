import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./EditPage.css";
import type { AudioClip, VideoClip } from "../types";
import Timeline from "./Timeline";
import { convertToAssetUrl, loadAudioAsBlob, revokeBlobUrl } from "../utils/tauri";

interface EditPageProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  onAddMedia?: () => void;
  onDeleteClip?: (clipId: string, type: "audio" | "video") => void;
  projectPath?: string;
}

function EditPage({ audioClips, videoClips, onAddMedia, onDeleteClip }: EditPageProps) {
  const { t } = useTranslation();
  const [selectedClip, setSelectedClip] = useState<AudioClip | VideoClip | null>(null);
  const [selectedClipType, setSelectedClipType] = useState<"audio" | "video" | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string | null>(null);
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const totalDuration = Math.max(
      ...audioClips.map(c => c.startTime + c.duration),
      ...videoClips.map(c => c.startTime + c.duration),
      0
    );
    setDuration(totalDuration);
  }, [audioClips, videoClips]);

  const formatTimecode = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 25);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  // Load first audio clip when available
  useEffect(() => {
    const loadFirstClip = async () => {
      if (audioClips.length > 0 && !currentAudioSrc) {
        const firstClip = audioClips[0];
        try {
          const url = await loadAudioAsBlob(firstClip.path);
          setCurrentAudioSrc(url);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.load();
          }
        } catch (err) {
          console.error("Audio load error:", err);
          try {
            const url = await convertToAssetUrl(firstClip.path);
            setCurrentAudioSrc(url);
            if (audioRef.current) {
              audioRef.current.src = url;
              audioRef.current.load();
            }
          } catch (e) {
            console.error("Fallback failed:", e);
          }
        }
      }
    };
    loadFirstClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioClips]);

  // Load first video clip when available
  useEffect(() => {
    const loadFirstVideoClip = async () => {
      if (videoClips.length > 0 && !currentVideoSrc) {
        const firstClip = videoClips[0];
        const url = await convertToAssetUrl(firstClip.path);
        setCurrentVideoSrc(url);
      }
    };
    loadFirstVideoClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoClips]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      revokeBlobUrl(currentAudioSrc);
      revokeBlobUrl(currentVideoSrc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current && currentAudioSrc) {
      audioRef.current.src = currentAudioSrc;
      audioRef.current.volume = volume;
    }
  }, [currentAudioSrc, volume]);

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!audio.src || audio.src === window.location.href) {
        if (audioClips.length > 0) {
          try {
            const url = await loadAudioAsBlob(audioClips[0].path);
            revokeBlobUrl(currentAudioSrc);
            audio.src = url;
            audio.load();
            setCurrentAudioSrc(url);
            await new Promise((resolve) => {
              audio.addEventListener('canplay', resolve, { once: true });
            });
          } catch (err) {
            console.error("Load error:", err);
            return;
          }
        } else {
          return;
        }
      }

      try {
        audio.currentTime = currentTime;
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Play error:", err);
      }
    }
  }, [isPlaying, currentTime, audioClips, currentAudioSrc]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

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

  const handleClipSelect = useCallback(async (clipId: string, type: "audio" | "video") => {
    const clip = type === "audio"
      ? audioClips.find(c => c.id === clipId)
      : videoClips.find(c => c.id === clipId);
    setSelectedClip(clip || null);
    setSelectedClipType(clip ? type : null);

    if (clip && type === "audio") {
      try {
        revokeBlobUrl(currentAudioSrc);
        const url = await loadAudioAsBlob(clip.path);
        setCurrentAudioSrc(url);
      } catch (err) {
        console.error("Clip load error:", err);
      }
    }
  }, [audioClips, videoClips, currentAudioSrc]);

  const handlePlayClip = useCallback(async (clip: AudioClip | VideoClip) => {
    if ("path" in clip) {
      try {
        revokeBlobUrl(currentAudioSrc);
        const newSrc = await loadAudioAsBlob(clip.path);
        setCurrentAudioSrc(newSrc);
        setCurrentTime(0);

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => {
              setIsPlaying(true);
            }).catch(console.error);
          }
        }, 100);
      } catch (err) {
        console.error("Clip playback error:", err);
      }
    }
  }, [currentAudioSrc]);

  // Smooth playback cursor animation
  useEffect(() => {
    let animationFrameId: number;

    const updatePlayhead = () => {
      const audio = audioRef.current;
      if (audio && isPlaying && !audio.paused) {
        setCurrentTime(audio.currentTime);
        animationFrameId = requestAnimationFrame(updatePlayhead);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updatePlayhead);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying]);

  // Handle playback end and errors
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      const audioEl = e.target as HTMLAudioElement;
      console.error("Audio error:", audioEl.error?.message || "Unknown error");
      setIsPlaying(false);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <div className="edit-page">
      <audio ref={audioRef} />

      {/* Top Section: Media Browser + Preview */}
      <div className="edit-top">
        {/* Media Browser Panel */}
        <div className="media-browser">
          <div className="panel-header">
            <span className="panel-title">🎬 {t('edit.mediaTitle')}</span>
            <button className="panel-btn" onClick={onAddMedia} title={t('edit.import')}>
              ➕
            </button>
          </div>
          <div className="media-list">
            {audioClips.length === 0 && videoClips.length === 0 ? (
              <div className="media-empty">
                <span className="empty-icon">📁</span>
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
                    onClick={() => handleClipSelect(clip.id, "video")}
                    onDoubleClick={() => handlePlayClip(clip)}
                  >
                    <div className="media-thumbnail video-thumb">
                      {clip.thumbnail ? (
                        <img src={clip.thumbnail} alt={clip.name} />
                      ) : (
                        <span>🎥</span>
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
                    onClick={() => handleClipSelect(clip.id, "audio")}
                    onDoubleClick={() => handlePlayClip(clip)}
                  >
                    <div className="media-thumbnail audio-thumb">
                      <span>🎙️</span>
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
            <span className="panel-title">📺 {t('edit.previewTitle')}</span>
            <div className="monitor-tabs">
              <button className="tab-btn active">{t('edit.source')}</button>
              <button className="tab-btn">{t('edit.program')}</button>
            </div>
          </div>
          <div className="monitor-viewport">
            <div className="viewport-content">
              {videoClips.length > 0 ? (
                <video
                  ref={videoRef}
                  className="preview-video"
                  src={currentVideoSrc || undefined}
                />
              ) : (
                <div className="viewport-placeholder">
                  <span className="placeholder-icon">🎬</span>
                  <p>{t('edit.noVideoPreview')}</p>
                  <p className="placeholder-hint">{t('edit.importVideoHint')}</p>
                </div>
              )}
            </div>

            <div className="timecode-display">
              <span className="timecode">{formatTimecode(currentTime)}</span>
              <span className="timecode-separator">/</span>
              <span className="timecode total">{formatTimecode(duration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="transport-controls">
            <div className="transport-left">
              <button className="transport-btn" title={t('edit.goToStart')} onClick={handleStop}>
                ⏮️
              </button>
              <button className="transport-btn" title={t('edit.previousFrame')}>
                ⏪
              </button>
            </div>

            <button
              className={`transport-btn play-btn ${isPlaying ? "playing" : ""}`}
              onClick={handlePlayPause}
              title={isPlaying ? t('edit.pause') : t('edit.play')}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>

            <div className="transport-right">
              <button className="transport-btn" title={t('edit.nextFrame')}>
                ⏩
              </button>
              <button className="transport-btn" title={t('edit.goToEnd')}>
                ⏭️
              </button>
            </div>

            <div className="volume-control">
              <span className="volume-icon">🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                className="volume-slider"
              />
            </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="inspector-panel">
          <div className="panel-header">
            <span className="panel-title">🔍 {t('edit.inspectorTitle')}</span>
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
          onClipSelect={handleClipSelect}
          onPlayClip={handlePlayClip}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

export default EditPage;
