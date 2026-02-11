import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./Timeline.css";
import { loadAudioAsBlob, revokeBlobUrl } from "../utils/tauri";
import type { AudioClip, VideoClip } from "../types";
export type { AudioClip, VideoClip };

interface TimelineProps {
  audioClips?: AudioClip[];
  videoClips?: VideoClip[];
  onClipSelect?: (clipId: string, type: "audio" | "video") => void;
  onPlayClip?: (clip: AudioClip | VideoClip) => void;
  onMoveClip?: (clipId: string, type: "audio" | "video", newStartTime: number) => void;
  currentTime?: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
}

function Timeline({
  audioClips = [],
  videoClips = [],
  onClipSelect,
  onPlayClip,
  onMoveClip,
  currentTime: externalCurrentTime,
  isPlaying: externalIsPlaying,
  onSeek
}: TimelineProps) {
  const { t } = useTranslation();
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(50);
  const [scrollX, setScrollX] = useState<number>(0);
  const [internalIsPlaying, setInternalIsPlaying] = useState<boolean>(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState<number>(0);
  const [dragOverTrack, setDragOverTrack] = useState<"audio" | "video" | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const currentTime = externalCurrentTime !== undefined ? externalCurrentTime : internalCurrentTime;

  const totalDuration = Math.max(
    ...audioClips.map(c => c.startTime + c.duration),
    ...videoClips.map(c => c.startTime + c.duration),
    60
  );

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = zoom >= 100 ? 5 : zoom >= 50 ? 10 : 30;
    for (let i = 0; i <= totalDuration; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [zoom, totalDuration]);

  const waveformHeights = useMemo(() => {
    const heights: Record<string, number[]> = {};
    audioClips.forEach(clip => {
      const barCount = Math.max(5, Math.floor(clip.duration));
      const seed = clip.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      heights[clip.id] = Array.from({ length: barCount }, (_, i) => {
        return 30 + ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280 * 40;
      });
    });
    return heights;
  }, [audioClips]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClipClick = (clipId: string, type: "audio" | "video") => {
    setSelectedClip(clipId);
    if (onClipSelect) {
      onClipSelect(clipId, type);
    }
  };

  const handleClipDoubleClick = async (clip: AudioClip | VideoClip) => {
    if (onPlayClip) {
      onPlayClip(clip);
    } else if ("path" in clip) {
      if (audioRef.current) {
        try {
          if (audioRef.current.src.startsWith('blob:')) {
            revokeBlobUrl(audioRef.current.src);
          }
          const url = await loadAudioAsBlob(clip.path);
          audioRef.current.src = url;
          audioRef.current.play();
          setInternalIsPlaying(true);
        } catch (err) {
          console.error("Audio playback error:", err);
        }
      }
    }
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const time = x / zoom;
    if (onSeek) {
      onSeek(time);
    } else {
      setInternalCurrentTime(time);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollX(e.currentTarget.scrollLeft);
  };

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, clipId: string, type: "audio" | "video") => {
    e.dataTransfer.setData("application/clip-id", clipId);
    e.dataTransfer.setData("application/clip-type", type);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, trackType: "audio" | "video") => {
    // Allow drop — we validate type on drop
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTrack(trackType);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the track-content (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverTrack(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, trackType: "audio" | "video") => {
    e.preventDefault();
    setDragOverTrack(null);

    const clipId = e.dataTransfer.getData("application/clip-id");
    const clipType = e.dataTransfer.getData("application/clip-type") as "audio" | "video";

    if (!clipId || !clipType || clipType !== trackType) return;
    if (!onMoveClip) return;

    // Calculate new startTime from drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newStartTime = Math.max(0, x / zoom);

    onMoveClip(clipId, clipType, newStartTime);
  }, [zoom, onMoveClip]);

  useEffect(() => {
    let animationFrame: number;

    if (internalIsPlaying && audioRef.current) {
      const updateTime = () => {
        if (audioRef.current) {
          setInternalCurrentTime(audioRef.current.currentTime);
          if (!audioRef.current.paused) {
            animationFrame = requestAnimationFrame(updateTime);
          } else {
            setInternalIsPlaying(false);
          }
        }
      };
      animationFrame = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [internalIsPlaying]);

  return (
    <div className="timeline">
      <audio ref={audioRef} onEnded={() => setInternalIsPlaying(false)} />

      <div className="timeline-header">
        <h3>{"\uD83C\uDFAC"} {t('timeline.title')}</h3>
        <div className="timeline-controls">
          <button
            className="timeline-btn"
            onClick={() => setZoom(z => Math.max(20, z - 10))}
            title={t('timeline.zoomOut')}
          >
            {"\u2796"}
          </button>
          <span className="zoom-level">{zoom}px/s</span>
          <button
            className="timeline-btn"
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            title={t('timeline.zoomIn')}
          >
            {"\u2795"}
          </button>
        </div>
      </div>

      <div className="timeline-body" onScroll={handleScroll} ref={timelineRef}>
        <div
          className="timeline-ruler"
          style={{ width: totalDuration * zoom }}
          onClick={handleRulerClick}
        >
          {timeMarkers.map(marker => (
            <div
              key={marker}
              className="time-marker"
              style={{ left: marker * zoom }}
            >
              <span>{formatTime(marker)}</span>
            </div>
          ))}
          <div
            className={`playhead ${isPlaying ? "playing" : ""}`}
            style={{ left: currentTime * zoom }}
          />
        </div>

        <div className="timeline-track video-track">
          <div className="track-label">{"\uD83C\uDFA5"} {t('timeline.videoTrack')}</div>
          <div
            className={`track-content ${dragOverTrack === "video" ? "drag-over" : ""}`}
            style={{ width: totalDuration * zoom }}
            onDragOver={(e) => handleDragOver(e, "video")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "video")}
          >
            {videoClips.length === 0 ? (
              <div className="track-empty">
                <span>{t('timeline.dropVideos')}</span>
              </div>
            ) : (
              videoClips.map(clip => (
                <div
                  key={clip.id}
                  className={`timeline-clip video-clip ${selectedClip === clip.id ? "selected" : ""}`}
                  style={{
                    left: clip.startTime * zoom,
                    width: clip.duration * zoom,
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, clip.id, "video")}
                  onClick={() => handleClipClick(clip.id, "video")}
                  onDoubleClick={() => handleClipDoubleClick(clip)}
                >
                  <span className="clip-name">{clip.name}</span>
                  <span className="clip-duration">{formatTime(clip.duration)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="timeline-track audio-track">
          <div className="track-label">{"\uD83C\uDF99\uFE0F"} {t('timeline.audioTrack')}</div>
          <div
            className={`track-content ${dragOverTrack === "audio" ? "drag-over" : ""}`}
            style={{ width: totalDuration * zoom }}
            onDragOver={(e) => handleDragOver(e, "audio")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "audio")}
          >
            {audioClips.length === 0 ? (
              <div className="track-empty">
                <span>{t('timeline.audioClipsAppear')}</span>
              </div>
            ) : (
              audioClips.map(clip => (
                <div
                  key={clip.id}
                  className={`timeline-clip audio-clip ${selectedClip === clip.id ? "selected" : ""}`}
                  style={{
                    left: clip.startTime * zoom,
                    width: Math.max(clip.duration * zoom, 100),
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, clip.id, "audio")}
                  onClick={() => handleClipClick(clip.id, "audio")}
                  onDoubleClick={() => handleClipDoubleClick(clip)}
                  title={t('timeline.doubleClickToPlay', { name: clip.name })}
                >
                  <div className="clip-waveform">
                    {(waveformHeights[clip.id] || []).map((height, i) => (
                      <div
                        key={i}
                        className="waveform-bar"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <span className="clip-name">{clip.name}</span>
                  <span className="clip-duration">{formatTime(clip.duration)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isPlaying && (
        <div className="timeline-playback-indicator">
          {"\u25B6\uFE0F"} {t('timeline.playbackIndicator', { time: formatTime(currentTime) })}
        </div>
      )}
    </div>
  );
}

export default Timeline;
