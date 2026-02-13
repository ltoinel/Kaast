import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./Timeline.css";
import { getStreamingUrl } from "../utils/tauri";
import type { AudioClip, VideoClip } from "../types";
export type { AudioClip, VideoClip };

interface TimelineProps {
  audioClips?: AudioClip[];
  videoClips?: VideoClip[];
  resolvedUrls?: Record<string, string>;
  selectedClipId?: string | null;
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
  resolvedUrls = {},
  selectedClipId: externalSelectedClip,
  onClipSelect,
  onPlayClip,
  onMoveClip,
  currentTime: externalCurrentTime,
  isPlaying: externalIsPlaying,
  onSeek
}: TimelineProps) {
  const { t } = useTranslation();
  const [internalSelectedClip, setInternalSelectedClip] = useState<string | null>(null);
  const selectedClip = externalSelectedClip !== undefined && externalSelectedClip !== null
    ? externalSelectedClip
    : internalSelectedClip;
  const [zoom, setZoom] = useState<number>(50);
  const [internalIsPlaying, setInternalIsPlaying] = useState<boolean>(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState<number>(0);
  const [dragOverTrack, setDragOverTrack] = useState<"audio" | "video" | null>(null);
  const [dragSnapX, setDragSnapX] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const dragOffsetRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const currentTime = externalCurrentTime !== undefined ? externalCurrentTime : internalCurrentTime;

  const totalDuration = Math.max(
    ...audioClips.map(c => c.startTime + c.duration),
    ...videoClips.map(c => c.startTime + c.duration),
    60
  );

  /** Snap a time value to the nearest grid step (1 second per zoom pixel) */
  const snapToGrid = useCallback((time: number): number => {
    const step = Math.max(1, Math.round(zoom / 10));
    return Math.round(time / step) * step;
  }, [zoom]);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = 10;
    for (let i = 0; i <= totalDuration; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [totalDuration]);

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
    setInternalSelectedClip(clipId);
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
          const url = await getStreamingUrl(clip.path);
          audioRef.current.src = url;
          audioRef.current.play();
          setInternalIsPlaying(true);
        } catch (err) {
          console.error("Audio playback error:", err);
        }
      }
    }
  };

  /** Compute time from a mouse X position relative to the ruler */
  const timeFromRulerX = useCallback((clientX: number): number => {
    if (!rulerRef.current) return 0;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(totalDuration, x / zoom));
  }, [zoom, totalDuration]);

  /** Start scrubbing on mousedown — playhead follows mouse */
  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const time = timeFromRulerX(e.clientX);
    setIsScrubbing(true);
    setScrubTime(time);
  }, [timeFromRulerX]);

  /** Track mouse during scrubbing, commit seek on mouseup */
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e: MouseEvent) => {
      setScrubTime(timeFromRulerX(e.clientX));
    };

    const handleMouseUp = (e: MouseEvent) => {
      const finalTime = timeFromRulerX(e.clientX);
      setIsScrubbing(false);
      if (onSeek) {
        onSeek(finalTime);
      } else {
        setInternalCurrentTime(finalTime);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, timeFromRulerX, onSeek]);


  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, clipId: string, type: "audio" | "video") => {
    e.dataTransfer.setData("application/clip-id", clipId);
    e.dataTransfer.setData("application/clip-type", type);
    e.dataTransfer.effectAllowed = "move";
    // Store offset between cursor and clip left edge
    const clipRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffsetRef.current = e.clientX - clipRect.left;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, trackType: "audio" | "video") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTrack(trackType);

    // Compute snapped position accounting for grab offset
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffsetRef.current;
    const rawTime = Math.max(0, x / zoom);
    const snappedTime = snapToGrid(rawTime);
    setDragSnapX(snappedTime * zoom);
  }, [zoom, snapToGrid]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverTrack(null);
      setDragSnapX(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, trackType: "audio" | "video") => {
    e.preventDefault();
    setDragOverTrack(null);
    setDragSnapX(null);

    const clipId = e.dataTransfer.getData("application/clip-id");
    const clipType = e.dataTransfer.getData("application/clip-type") as "audio" | "video";

    if (!clipId || !clipType || clipType !== trackType) return;
    if (!onMoveClip) return;

    // Calculate new startTime accounting for grab offset, snapped to grid
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffsetRef.current;
    const rawTime = Math.max(0, x / zoom);
    const snappedTime = snapToGrid(rawTime);

    onMoveClip(clipId, clipType, snappedTime);
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
            onClick={() => setZoom(z => Math.max(10, z - 10))}
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

      <div className="timeline-body" ref={timelineRef}>
        <div
          ref={rulerRef}
          className="timeline-ruler"
          style={{ width: totalDuration * zoom }}
          onMouseDown={handleRulerMouseDown}
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
            className={`playhead ${isPlaying ? "playing" : ""}${isScrubbing ? " scrubbing" : ""}`}
            style={{ left: (isScrubbing ? scrubTime : currentTime) * zoom }}
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
                  {clip.thumbnail && resolvedUrls[clip.thumbnail] && (
                    <img
                      className="clip-thumbnail-video"
                      src={resolvedUrls[clip.thumbnail]}
                      alt={clip.name}
                      loading="lazy"
                    />
                  )}
                  <span className="clip-name">{clip.name}</span>
                  <span className="clip-duration">{formatTime(clip.duration)}</span>
                </div>
              ))
            )}
            {dragOverTrack === "video" && dragSnapX !== null && (
              <div className="drop-snap-indicator" style={{ left: dragSnapX }} />
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
            {dragOverTrack === "audio" && dragSnapX !== null && (
              <div className="drop-snap-indicator" style={{ left: dragSnapX }} />
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
