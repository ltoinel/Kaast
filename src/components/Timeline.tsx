import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "./Timeline.css";
import { formatTime } from "../utils/timecode";
import { computeTotalDuration } from "../utils/duration";
import { IconFilm } from "./Icons";
import { useTimelineDrag } from "../hooks/useTimelineDrag";
import TimelineTrack from "./TimelineTrack";
import type { AudioClip, VideoClip } from "../types";
export type { AudioClip, VideoClip };

interface TimelineProps {
  audioClips?: AudioClip[];
  videoClips?: VideoClip[];
  totalDuration?: number;
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
  totalDuration: totalDurationProp,
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
  const [internalIsPlaying] = useState<boolean>(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const rulerRef = useRef<HTMLDivElement>(null);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const currentTime = externalCurrentTime !== undefined ? externalCurrentTime : internalCurrentTime;

  const effectiveDuration = Math.max(
    totalDurationProp ?? computeTotalDuration(audioClips, videoClips),
    60,
  );

  /** Snap a time value to the nearest grid step */
  const snapToGrid = useCallback((time: number): number => {
    const step = Math.max(1, Math.round(zoom / 10));
    return Math.round(time / step) * step;
  }, [zoom]);

  const {
    dragOverTrack, dragSnapX,
    handleDragStart, handleDragOver, handleDragLeave, handleDrop,
  } = useTimelineDrag({ zoom, snapToGrid, onMoveClip });

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = 10;
    for (let i = 0; i <= effectiveDuration; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [effectiveDuration]);

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

  const handleClipClick = useCallback((clipId: string, type: "audio" | "video") => {
    setInternalSelectedClip(clipId);
    if (onClipSelect) onClipSelect(clipId, type);
  }, [onClipSelect]);

  const handleClipDoubleClick = useCallback((clip: AudioClip | VideoClip) => {
    if (onPlayClip) onPlayClip(clip);
  }, [onPlayClip]);

  /** Compute time from a mouse X position relative to the ruler */
  const timeFromRulerX = useCallback((clientX: number): number => {
    if (!rulerRef.current) return 0;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(effectiveDuration, x / zoom));
  }, [zoom, effectiveDuration]);

  /** Start scrubbing on mousedown */
  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsScrubbing(true);
    setScrubTime(timeFromRulerX(e.clientX));
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

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3><IconFilm /> {t('timeline.title')}</h3>
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

      <div className="timeline-body">
        <div
          ref={rulerRef}
          className="timeline-ruler"
          style={{ width: effectiveDuration * zoom }}
          onMouseDown={handleRulerMouseDown}
        >
          {timeMarkers.map(marker => (
            <div key={marker} className="time-marker" style={{ left: marker * zoom }}>
              <span>{formatTime(marker)}</span>
            </div>
          ))}
          <div
            className={`playhead ${isPlaying ? "playing" : ""}${isScrubbing ? " scrubbing" : ""}`}
            style={{ left: (isScrubbing ? scrubTime : currentTime) * zoom }}
          />
        </div>

        <TimelineTrack
          type="video"
          clips={videoClips}
          zoom={zoom}
          effectiveDuration={effectiveDuration}
          selectedClip={selectedClip}
          resolvedUrls={resolvedUrls}
          dragOverTrack={dragOverTrack}
          dragSnapX={dragSnapX}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClipClick={handleClipClick}
          onClipDoubleClick={handleClipDoubleClick}
        />

        <TimelineTrack
          type="audio"
          clips={audioClips}
          zoom={zoom}
          effectiveDuration={effectiveDuration}
          selectedClip={selectedClip}
          resolvedUrls={resolvedUrls}
          waveformHeights={waveformHeights}
          dragOverTrack={dragOverTrack}
          dragSnapX={dragSnapX}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClipClick={handleClipClick}
          onClipDoubleClick={handleClipDoubleClick}
        />
      </div>

      {isPlaying && (
        <div className="timeline-playback-indicator">
          {"\u25B6\uFE0F"} {t('timeline.playbackIndicator', { time: formatTime(currentTime) })}
        </div>
      )}
    </div>
  );
}

export default memo(Timeline);
