/**
 * TimelineTrack — A single track (audio or video) within the timeline.
 *
 * Renders clip blocks with drag-and-drop support, snap indicator,
 * and optional waveform or thumbnail visuals.
 */
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../utils/timecode";
import type { AudioClip, VideoClip } from "../types";
import { IconCamera, IconMusic } from "./Icons";

interface TimelineTrackProps {
  type: "audio" | "video";
  clips: (AudioClip | VideoClip)[];
  zoom: number;
  effectiveDuration: number;
  selectedClip: string | null;
  resolvedUrls: Record<string, string>;
  waveformHeights?: Record<string, number[]>;
  dragOverTrack: "audio" | "video" | null;
  dragSnapX: number | null;
  onDragStart: (e: React.DragEvent, clipId: string, type: "audio" | "video") => void;
  onDragOver: (e: React.DragEvent, trackType: "audio" | "video") => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, trackType: "audio" | "video") => void;
  onClipClick: (clipId: string, type: "audio" | "video") => void;
  onClipDoubleClick: (clip: AudioClip | VideoClip) => void;
}

function TimelineTrack({
  type, clips, zoom, effectiveDuration, selectedClip,
  resolvedUrls, waveformHeights, dragOverTrack, dragSnapX,
  onDragStart, onDragOver, onDragLeave, onDrop,
  onClipClick, onClipDoubleClick,
}: TimelineTrackProps) {
  const { t } = useTranslation();

  const isVideo = type === "video";
  const trackIcon = isVideo ? <IconCamera /> : <IconMusic />;
  const trackLabel = isVideo ? t('timeline.videoTrack') : t('timeline.audioTrack');
  const emptyMessage = isVideo ? t('timeline.dropVideos') : t('timeline.audioClipsAppear');

  return (
    <div className={`timeline-track ${type}-track`}>
      <div className="track-label">{trackIcon} {trackLabel}</div>
      <div
        className={`track-content ${dragOverTrack === type ? "drag-over" : ""}`}
        style={{ width: effectiveDuration * zoom }}
        onDragOver={(e) => onDragOver(e, type)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, type)}
      >
        {clips.length === 0 ? (
          <div className="track-empty">
            <span>{emptyMessage}</span>
          </div>
        ) : (
          clips.map(clip => {
            const width = isVideo
              ? clip.duration * zoom
              : Math.max(clip.duration * zoom, 100);
            const thumbnail = isVideo ? (clip as VideoClip).thumbnail : undefined;

            return (
              <div
                key={clip.id}
                className={`timeline-clip ${type}-clip ${selectedClip === clip.id ? "selected" : ""}`}
                style={{ left: clip.startTime * zoom, width }}
                draggable
                onDragStart={(e) => onDragStart(e, clip.id, type)}
                onClick={() => onClipClick(clip.id, type)}
                onDoubleClick={() => onClipDoubleClick(clip)}
                title={!isVideo ? t('timeline.doubleClickToPlay', { name: clip.name }) : undefined}
              >
                {isVideo && thumbnail && resolvedUrls[thumbnail] && (
                  <img
                    className="clip-thumbnail-video"
                    src={resolvedUrls[thumbnail]}
                    alt={clip.name}
                    loading="lazy"
                  />
                )}
                {!isVideo && waveformHeights?.[clip.id] && (
                  <div className="clip-waveform">
                    {waveformHeights[clip.id].map((height, i) => (
                      <div key={i} className="waveform-bar" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                )}
                <span className="clip-name">{clip.name}</span>
                <span className="clip-duration">{formatTime(clip.duration)}</span>
              </div>
            );
          })
        )}
        {dragOverTrack === type && dragSnapX !== null && (
          <div className="drop-snap-indicator" style={{ left: dragSnapX }} />
        )}
      </div>
    </div>
  );
}

export default memo(TimelineTrack);
