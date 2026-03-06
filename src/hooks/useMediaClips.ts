/**
 * useMediaClips — Manages audio and video clip state on the timeline.
 *
 * Owns the `audioClips` / `videoClips` arrays together with every handler
 * that mutates them (add, delete, move, generate, import from file dialog).
 * Also exposes a derived `totalDuration` covering both tracks.
 */
import { useState, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { AudioClip, VideoClip } from "../types";
import { generateClipId } from "../utils/id";
import { basename, isTauriAvailable } from "../utils/tauri";
import { computeTotalDuration } from "../utils/duration";

export interface UseMediaClipsReturn {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  setAudioClips: Dispatch<SetStateAction<AudioClip[]>>;
  setVideoClips: Dispatch<SetStateAction<VideoClip[]>>;
  totalDuration: number;
  loadProjectAudioFiles: (path: string, signal?: { cancelled: boolean }) => Promise<void>;
  handleAudioGenerated: (audioPath: string, duration: number) => void;
  handleDeleteClip: (clipId: string, type: "audio" | "video") => void;
  handleMoveClip: (clipId: string, type: "audio" | "video", newStartTime: number) => void;
  handleProduceToTimeline: (clips: VideoClip[]) => void;
  handleAddMedia: () => Promise<void>;
}

/**
 * Manage audio/video clips, their computed total duration, and all mutation handlers.
 *
 * @param probe      Function that returns the duration of a media file.
 * @param navigateToEdit  Callback to switch the active tab to "edit" after producing.
 */
export function useMediaClips(
  probe: (filePath: string) => Promise<{ duration: number }>,
  navigateToEdit: () => void,
): UseMediaClipsReturn {
  const { t } = useTranslation();
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);

  const totalDuration = useMemo(
    () => computeTotalDuration(audioClips, videoClips),
    [audioClips, videoClips],
  );

  /** Scan a project directory for audio files and populate the audio track. */
  const loadProjectAudioFiles = useCallback(async (projectPath: string, signal?: { cancelled: boolean }) => {
    if (!isTauriAvailable()) return;

    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(projectPath);

      const audioExtensions = ["mp3", "wav", "m4a", "ogg", "flac"];
      const audioFiles = entries.filter(entry => {
        if (entry.isFile && entry.name) {
          const ext = entry.name.split(".").pop()?.toLowerCase() || "";
          return audioExtensions.includes(ext);
        }
        return false;
      });

      if (audioFiles.length > 0) {
        let offset = 0;
        const newClips: AudioClip[] = [];
        for (let index = 0; index < audioFiles.length; index++) {
          if (signal?.cancelled) return;
          const file = audioFiles[index];
          const filePath = `${projectPath}/${file.name}`;
          const { duration: realDuration } = await probe(filePath);
          newClips.push({
            id: `audio_${Date.now()}_${index}`,
            name: file.name || "Audio",
            path: filePath,
            duration: realDuration,
            startTime: offset,
          });
          offset += realDuration;
        }
        if (!signal?.cancelled) setAudioClips(newClips);
      }
    } catch {
      // No audio files in project directory
    }
  }, [probe]);

  /** Replace the audio track with a single newly-generated clip. */
  const handleAudioGenerated = useCallback((audioPath: string, duration: number) => {
    const newClip: AudioClip = {
      id: generateClipId("audio"),
      name: basename(audioPath) || "Podcast",
      path: audioPath,
      duration,
      startTime: 0,
    };
    setAudioClips([newClip]);
  }, []);

  /** Remove a clip by ID from the appropriate track. */
  const handleDeleteClip = useCallback((clipId: string, type: "audio" | "video") => {
    if (type === "audio") {
      setAudioClips(prev => prev.filter(c => c.id !== clipId));
    } else {
      setVideoClips(prev => prev.filter(c => c.id !== clipId));
    }
  }, []);

  /** Move a clip to a new start time on the timeline. */
  const handleMoveClip = useCallback((clipId: string, type: "audio" | "video", newStartTime: number) => {
    if (type === "audio") {
      setAudioClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: newStartTime } : c));
    } else {
      setVideoClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: newStartTime } : c));
    }
  }, []);

  /** Replace the video track and navigate to the edit tab. */
  const handleProduceToTimeline = useCallback((clips: VideoClip[]) => {
    setVideoClips(clips);
    navigateToEdit();
  }, [navigateToEdit]);

  /** Open a file dialog and import selected media files into the timeline. */
  const handleAddMedia = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const files = await open({
        multiple: true,
        filters: [
          { name: t('app.filterMedia'), extensions: ["mp4", "mov", "avi", "mkv", "mp3", "wav", "m4a", "ogg"] },
          { name: t('app.filterVideo'), extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
          { name: t('app.filterAudio'), extensions: ["mp3", "wav", "m4a", "ogg", "flac"] },
        ],
      });

      if (files && Array.isArray(files)) {
        for (const file of files) {
          const fileName = basename(file) || "Media";
          const ext = fileName.split(".").pop()?.toLowerCase() || "";
          const { duration: realDuration } = await probe(file);

          if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
            const newClip: VideoClip = {
              id: generateClipId("video"),
              name: fileName,
              path: file,
              duration: realDuration,
              startTime: videoClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
            };
            setVideoClips(prev => [...prev, newClip]);
          } else if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) {
            const newClip: AudioClip = {
              id: generateClipId("audio"),
              name: fileName,
              path: file,
              duration: realDuration,
              startTime: audioClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
            };
            setAudioClips(prev => [...prev, newClip]);
          }
        }
      }
    } catch (error) {
      console.error("Media import error:", error);
    }
  }, [t, probe, videoClips, audioClips]);

  return {
    audioClips,
    videoClips,
    setAudioClips,
    setVideoClips,
    totalDuration,
    loadProjectAudioFiles,
    handleAudioGenerated,
    handleDeleteClip,
    handleMoveClip,
    handleProduceToTimeline,
    handleAddMedia,
  };
}
