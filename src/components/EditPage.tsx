import { useState, useRef, useEffect, useCallback } from "react";
import "./EditPage.css";
import Timeline, { AudioClip, VideoClip } from "./Timeline";
import { convertToAssetUrl, loadAudioAsBlob } from "../utils/tauri";

interface EditPageProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  onAddMedia?: () => void;
  projectPath?: string;
}

function EditPage({ audioClips, videoClips, onAddMedia }: EditPageProps) {
  const [selectedClip, setSelectedClip] = useState<AudioClip | VideoClip | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string | null>(null);
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Calculer la durée totale du projet
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
    const frames = Math.floor((seconds % 1) * 25); // 25 fps
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  // Charger le premier clip audio quand disponible
  useEffect(() => {
    const loadFirstClip = async () => {
      if (audioClips.length > 0 && !currentAudioSrc) {
        const firstClip = audioClips[0];
        try {
          const url = await loadAudioAsBlob(firstClip.path);
          console.log("Audio chargé en blob:", url);
          setCurrentAudioSrc(url);
        } catch (err) {
          console.error("Erreur chargement audio:", err);
          // Fallback vers convertToAssetUrl
          const url = await convertToAssetUrl(firstClip.path);
          setCurrentAudioSrc(url);
        }
      }
    };
    loadFirstClip();
  }, [audioClips, currentAudioSrc]);

  // Charger le premier clip vidéo quand disponible
  useEffect(() => {
    const loadFirstVideoClip = async () => {
      if (videoClips.length > 0 && !currentVideoSrc) {
        const firstClip = videoClips[0];
        const url = await convertToAssetUrl(firstClip.path);
        setCurrentVideoSrc(url);
      }
    };
    loadFirstVideoClip();
  }, [videoClips, currentVideoSrc]);

  // Configurer l'audio source
  useEffect(() => {
    if (audioRef.current && currentAudioSrc) {
      audioRef.current.src = currentAudioSrc;
      audioRef.current.volume = volume;
    }
  }, [currentAudioSrc, volume]);

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error("Pas d'élément audio");
      return;
    }

    console.log("handlePlayPause - isPlaying:", isPlaying, "audioClips:", audioClips.length, "currentAudioSrc:", currentAudioSrc);

    if (isPlaying) {
      audio.pause();
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // S'assurer qu'on a une source audio
      if (!audio.src && audioClips.length > 0) {
        try {
          const url = await loadAudioAsBlob(audioClips[0].path);
          console.log("Chargement audio blob URL:", url);
          audio.src = url;
          setCurrentAudioSrc(url);
        } catch (err) {
          console.error("Erreur chargement blob:", err);
        }
      }
      
      console.log("Audio src:", audio.src, "readyState:", audio.readyState);
      
      if (audio.src) {
        audio.currentTime = currentTime;
        audio.play().then(() => {
          console.log("Lecture démarrée");
          setIsPlaying(true);
        }).catch(err => {
          console.error("Erreur lecture audio:", err);
        });
      } else {
        console.error("Pas de source audio disponible");
      }
    }
  }, [isPlaying, currentTime, audioClips, currentAudioSrc]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
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

  const handleClipSelect = useCallback(async (clipId: string, type: "audio" | "video") => {
    const clip = type === "audio" 
      ? audioClips.find(c => c.id === clipId)
      : videoClips.find(c => c.id === clipId);
    setSelectedClip(clip || null);
    
    // Si c'est un clip audio, le définir comme source
    if (clip && type === "audio") {
      try {
        const url = await loadAudioAsBlob(clip.path);
        setCurrentAudioSrc(url);
      } catch (err) {
        console.error("Erreur chargement clip:", err);
      }
    }
  }, [audioClips, videoClips]);

  const handlePlayClip = useCallback(async (clip: AudioClip | VideoClip) => {
    if ("path" in clip) {
      try {
        const newSrc = await loadAudioAsBlob(clip.path);
        setCurrentAudioSrc(newSrc);
        setCurrentTime(0);
        
        // Attendre que l'audio soit chargé avant de lancer la lecture
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => {
              setIsPlaying(true);
            }).catch(console.error);
          }
        }, 100);
      } catch (err) {
        console.error("Erreur lecture clip:", err);
      }
    }
  }, []);

  // Animation fluide du curseur de lecture
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

  // Gérer la fin de lecture et les erreurs
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      const audioEl = e.target as HTMLAudioElement;
      console.error("Erreur audio:", audioEl.error?.message || "Erreur inconnue");
      console.error("Code erreur:", audioEl.error?.code);
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      console.log("Audio prêt à jouer, durée:", audio.duration);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
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
            <span className="panel-title">🎬 Médias</span>
            <button className="panel-btn" onClick={onAddMedia} title="Importer">
              ➕
            </button>
          </div>
          <div className="media-list">
            {audioClips.length === 0 && videoClips.length === 0 ? (
              <div className="media-empty">
                <span className="empty-icon">📁</span>
                <p>Aucun média</p>
                <button className="btn-import" onClick={onAddMedia}>
                  Importer des fichiers
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
            <span className="panel-title">📺 Prévisualisation</span>
            <div className="monitor-tabs">
              <button className="tab-btn active">Source</button>
              <button className="tab-btn">Programme</button>
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
                  <p>Aucune vidéo à prévisualiser</p>
                  <p className="placeholder-hint">Importez des fichiers vidéo pour commencer</p>
                </div>
              )}
            </div>
            
            {/* Timecode Display */}
            <div className="timecode-display">
              <span className="timecode">{formatTimecode(currentTime)}</span>
              <span className="timecode-separator">/</span>
              <span className="timecode total">{formatTimecode(duration)}</span>
            </div>
          </div>
          
          {/* Transport Controls */}
          <div className="transport-controls">
            <div className="transport-left">
              <button className="transport-btn" title="Aller au début" onClick={handleStop}>
                ⏮️
              </button>
              <button className="transport-btn" title="Image précédente">
                ⏪
              </button>
            </div>
            
            <button 
              className={`transport-btn play-btn ${isPlaying ? "playing" : ""}`}
              onClick={handlePlayPause}
              title={isPlaying ? "Pause" : "Lecture"}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>
            
            <div className="transport-right">
              <button className="transport-btn" title="Image suivante">
                ⏩
              </button>
              <button className="transport-btn" title="Aller à la fin">
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
            <span className="panel-title">🔍 Inspecteur</span>
          </div>
          <div className="inspector-content">
            {selectedClip ? (
              <div className="clip-properties">
                <h4>Propriétés du clip</h4>
                <div className="property-group">
                  <label>Nom</label>
                  <input type="text" value={selectedClip.name} readOnly />
                </div>
                <div className="property-group">
                  <label>Durée</label>
                  <span className="property-value">{formatTimecode(selectedClip.duration)}</span>
                </div>
                <div className="property-group">
                  <label>Position</label>
                  <span className="property-value">{formatTimecode(selectedClip.startTime)}</span>
                </div>
                <div className="property-group">
                  <label>Chemin</label>
                  <span className="property-value path">{selectedClip.path}</span>
                </div>
              </div>
            ) : (
              <div className="inspector-empty">
                <p>Sélectionnez un clip pour voir ses propriétés</p>
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
