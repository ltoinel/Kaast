import { useState, useRef, useEffect, useCallback } from "react";
import "./ScenesPage.css";
import { safeInvoke, getTauriErrorMessage, isTauriAvailable, loadAudioAsBlob, convertToAssetUrl, revokeBlobUrl } from "../utils/tauri";
import type { AudioClip, VideoScene } from "../types";

interface ScenesPageProps {
  audioClips: AudioClip[];
  projectPath?: string;
  onOpenSettings?: () => void;
}

function ScenesPage({ audioClips, projectPath, onOpenSettings }: ScenesPageProps) {
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [script, setScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Charger le script depuis le projet
  useEffect(() => {
    const loadScript = async () => {
      if (!projectPath) return;
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(`${projectPath}/script.md`);
        setScript(content);
      } catch {
        // Pas de script encore
      }
    };
    loadScript();
  }, [projectPath]);

  // Charger les scènes sauvegardées
  useEffect(() => {
    const loadScenes = async () => {
      if (!projectPath) return;
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(`${projectPath}/scenes.json`);
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          setScenes(data);
        }
      } catch {
        // Pas de scènes sauvegardées
      }
    };
    loadScenes();
  }, [projectPath]);

  // Charger l'audio du premier clip via Blob URL (comme EditPage)
  useEffect(() => {
    const loadAudio = async () => {
      if (audioClips.length === 0 || !isTauriAvailable()) return;
      // Libérer l'ancienne URL blob
      revokeBlobUrl(audioSrc);

      const clip = audioClips[0];
      try {
        // Méthode principale : lire les octets et créer un blob URL
        const url = await loadAudioAsBlob(clip.path);
        setAudioSrc(url);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }
      } catch (err) {
        console.error("Erreur loadAudioAsBlob:", err);
        // Fallback : asset protocol
        try {
          const url = await convertToAssetUrl(clip.path);
          setAudioSrc(url);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.load();
          }
        } catch (err2) {
          console.error("Fallback convertToAssetUrl échoué:", err2);
        }
      }
    };
    loadAudio();
    return () => {
      revokeBlobUrl(audioSrc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioClips]);

  // Animation du curseur de lecture
  useEffect(() => {
    let animationFrameId: number;
    const updateTime = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Si l'audio n'est pas encore prêt, attendre le chargement
    if (audio.readyState < 2) {
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout chargement audio")), 10000);
          audio.addEventListener("canplay", () => { clearTimeout(timeout); resolve(); }, { once: true });
          audio.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Erreur chargement audio")); }, { once: true });
        });
      } catch (err) {
        console.error("Erreur chargement audio:", err);
        setError("Impossible de charger le fichier audio");
        return;
      }
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Erreur lecture:", err);
      setError("Erreur lors de la lecture audio");
    }
  }, [isPlaying, audioSrc]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleGenerateScenes = async () => {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      setError("Clé API Gemini non configurée. Allez dans les paramètres.");
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!script.trim()) {
      setError("Aucun script disponible. Écrivez ou générez un script d'abord.");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const result = await safeInvoke<string>("generate_video_scenes", {
        script: script.trim(),
        apiKey,
      });

      const parsed = JSON.parse(result) as Array<{
        description: string;
        duration: number;
        scriptExcerpt: string;
      }>;

      const newScenes: VideoScene[] = parsed.map((scene, index) => ({
        id: `scene_${Date.now()}_${index}`,
        description: scene.description,
        duration: Math.min(20, Math.max(5, scene.duration)),
        scriptExcerpt: scene.scriptExcerpt,
      }));

      setScenes(newScenes);

      // Sauvegarder les scènes
      if (projectPath) {
        try {
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          await writeTextFile(
            `${projectPath}/scenes.json`,
            JSON.stringify(newScenes, null, 2)
          );
        } catch (e) {
          console.error("Erreur sauvegarde scènes:", e);
        }
      }
    } catch (err) {
      setError(getTauriErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const totalScenesDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="scenes-page">
      <audio
        ref={audioRef}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Header */}
      <div className="scenes-header">
        <div className="scenes-header-left">
          <h2>Scènes vidéo</h2>
          {scenes.length > 0 && (
            <span className="scenes-count">
              {scenes.length} scènes · {formatTime(totalScenesDuration)}
            </span>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerateScenes}
          disabled={isGenerating || !script.trim()}
        >
          {isGenerating ? (
            <>
              <span className="spinner"></span>
              Analyse en cours...
            </>
          ) : (
            "Générer les scènes"
          )}
        </button>
      </div>

      {error && <div className="scenes-error">{error}</div>}

      {/* Audio Player */}
      {audioClips.length > 0 && (
        <div className="scenes-audio-player">
          <button
            className="audio-play-btn"
            onClick={handlePlayPause}
            disabled={!audioSrc}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <div className="audio-progress-wrapper">
            <input
              type="range"
              className="audio-progress"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
            />
          </div>
          <span className="audio-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span className="audio-name">
            {audioClips[0]?.name}
          </span>
        </div>
      )}

      {/* Scenes Grid */}
      <div className="scenes-content">
        {scenes.length === 0 ? (
          <div className="scenes-empty">
            {!script.trim() ? (
              <>
                <span className="empty-icon">📝</span>
                <p>Aucun script disponible</p>
                <p className="empty-hint">Écrivez ou générez un script dans l'onglet Script</p>
              </>
            ) : (
              <>
                <span className="empty-icon">🎬</span>
                <p>Aucune scène identifiée</p>
                <p className="empty-hint">
                  Cliquez sur « Générer les scènes » pour identifier des scènes vidéo depuis votre script
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="scenes-grid">
            {scenes.map((scene, index) => (
              <div key={scene.id} className="scene-card">
                <div className="scene-card-header">
                  <span className="scene-number">Scène {index + 1}</span>
                  <span className="scene-duration">{scene.duration}s</span>
                </div>
                <p className="scene-description">{scene.description}</p>
                <p className="scene-excerpt">« {scene.scriptExcerpt} »</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenesPage;
