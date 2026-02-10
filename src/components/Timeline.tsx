import { useState, useRef, useEffect } from "react";
import "./Timeline.css";
import { loadAudioAsBlob } from "../utils/tauri";

export interface AudioClip {
  id: string;
  name: string;
  path: string;
  duration: number;
  startTime: number;
}

export interface VideoClip {
  id: string;
  name: string;
  path: string;
  duration: number;
  startTime: number;
  thumbnail?: string;
}

interface TimelineProps {
  audioClips?: AudioClip[];
  videoClips?: VideoClip[];
  onClipSelect?: (clipId: string, type: "audio" | "video") => void;
  onPlayClip?: (clip: AudioClip | VideoClip) => void;
  currentTime?: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
}

function Timeline({ 
  audioClips = [], 
  videoClips = [], 
  onClipSelect, 
  onPlayClip,
  currentTime: externalCurrentTime,
  isPlaying: externalIsPlaying,
  onSeek
}: TimelineProps) {
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(50); // pixels per second
  const [scrollX, setScrollX] = useState<number>(0);
  const [internalIsPlaying, setInternalIsPlaying] = useState<boolean>(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Utiliser les props externes ou l'état interne
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const currentTime = externalCurrentTime !== undefined ? externalCurrentTime : internalCurrentTime;

  // Calculer la durée totale
  const totalDuration = Math.max(
    ...audioClips.map(c => c.startTime + c.duration),
    ...videoClips.map(c => c.startTime + c.duration),
    60 // minimum 60 secondes
  );

  // Générer les marqueurs de temps
  const timeMarkers: number[] = [];
  const interval = zoom >= 100 ? 5 : zoom >= 50 ? 10 : 30;
  for (let t = 0; t <= totalDuration; t += interval) {
    timeMarkers.push(t);
  }

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
      // Lire l'audio directement
      if (audioRef.current) {
        const url = await convertToAssetUrl(clip.path);
        audioRef.current.src = url;
        audioRef.current.play();
        setInternalIsPlaying(true);
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
  }, [isPlaying]);

  return (
    <div className="timeline">
      <audio ref={audioRef} onEnded={() => setInternalIsPlaying(false)} />
      
      <div className="timeline-header">
        <h3>🎬 Timeline</h3>
        <div className="timeline-controls">
          <button
            className="timeline-btn"
            onClick={() => setZoom(z => Math.max(20, z - 10))}
            title="Zoom -"
          >
            ➖
          </button>
          <span className="zoom-level">{zoom}px/s</span>
          <button
            className="timeline-btn"
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            title="Zoom +"
          >
            ➕
          </button>
        </div>
      </div>

      <div className="timeline-body" onScroll={handleScroll} ref={timelineRef}>
        {/* Règle du temps */}
        <div 
          className="timeline-ruler"
          style={{ width: totalDuration * zoom }}
          onClick={handleRulerClick}
        >
          {timeMarkers.map(t => (
            <div
              key={t}
              className="time-marker"
              style={{ left: t * zoom }}
            >
              <span>{formatTime(t)}</span>
            </div>
          ))}
          {/* Curseur de lecture */}
          <div
            className={`playhead ${isPlaying ? "playing" : ""}`}
            style={{ left: currentTime * zoom }}
          />
        </div>

        {/* Piste vidéo */}
        <div className="timeline-track video-track">
          <div className="track-label">🎥 Vidéo</div>
          <div 
            className="track-content"
            style={{ width: totalDuration * zoom }}
          >
            {videoClips.length === 0 ? (
              <div className="track-empty">
                <span>Glissez des vidéos ici</span>
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

        {/* Piste audio */}
        <div className="timeline-track audio-track">
          <div className="track-label">🎙️ Audio</div>
          <div 
            className="track-content"
            style={{ width: totalDuration * zoom }}
          >
            {audioClips.length === 0 ? (
              <div className="track-empty">
                <span>Les clips audio générés apparaîtront ici</span>
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
                  onClick={() => handleClipClick(clip.id, "audio")}
                  onDoubleClick={() => handleClipDoubleClick(clip)}
                  title={`Double-cliquez pour écouter: ${clip.name}`}
                >
                  <div className="clip-waveform">
                    {[...Array(Math.max(5, Math.floor(clip.duration)))].map((_, i) => (
                      <div
                        key={i}
                        className="waveform-bar"
                        style={{ height: `${30 + Math.random() * 40}%` }}
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
          ▶️ Lecture en cours - {formatTime(currentTime)}
        </div>
      )}
    </div>
  );
}

export default Timeline;
