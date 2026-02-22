/**
 * useTimelinePersistence — Save and load timeline state to/from a project JSON file.
 *
 * Provides `saveTimeline` and `loadTimeline` callbacks plus a periodic
 * auto-save that runs every 60 seconds while a project is open.
 *
 * The auto-save interval uses a ref-based pattern so the interval is only
 * restarted when the project or startup state changes — not on every clip edit.
 */
import { useCallback, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import type { AudioClip, VideoClip } from "../types";
import { isTauriAvailable } from "../utils/tauri";

/** Interval in milliseconds between automatic timeline saves. */
const AUTOSAVE_INTERVAL_MS = 60_000;

interface UseTimelinePersistenceOptions {
  currentProject: { path: string } | null;
  showStartup: boolean;
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  setAudioClips: Dispatch<SetStateAction<AudioClip[]>>;
  setVideoClips: Dispatch<SetStateAction<VideoClip[]>>;
  loadProjectAudioFiles: (path: string, signal?: { cancelled: boolean }) => Promise<void>;
}

interface UseTimelinePersistenceReturn {
  saveTimeline: () => Promise<void>;
  loadTimeline: (path: string, signal?: { cancelled: boolean }) => Promise<void>;
}

/**
 * Persist and restore the timeline (audio + video clips) to/from
 * `timeline.json` inside the project directory.
 */
export function useTimelinePersistence({
  currentProject,
  showStartup,
  audioClips,
  videoClips,
  setAudioClips,
  setVideoClips,
  loadProjectAudioFiles,
}: UseTimelinePersistenceOptions): UseTimelinePersistenceReturn {
  const autoSaveRef = useRef<number | null>(null);
  const lastSaveRef = useRef<string>("");

  /** Write the current timeline state to the project's timeline.json. */
  const saveTimeline = useCallback(async () => {
    if (!currentProject || !isTauriAvailable()) return;

    const timelineData = {
      audioClips,
      videoClips,
      savedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(timelineData, null, 2);

    if (jsonString === lastSaveRef.current) return;

    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const timelinePath = `${currentProject.path}/timeline.json`;
      await writeTextFile(timelinePath, jsonString);
      lastSaveRef.current = jsonString;
    } catch (error) {
      console.error("Timeline save error:", error);
    }
  }, [currentProject, audioClips, videoClips]);

  /** Load timeline state from the project's timeline.json, falling back to audio file scan. */
  const loadTimeline = useCallback(async (projectPath: string, signal?: { cancelled: boolean }) => {
    if (!isTauriAvailable()) return;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const timelinePath = `${projectPath}/timeline.json`;
      const content = await readTextFile(timelinePath);
      if (signal?.cancelled) return;
      const data = JSON.parse(content);

      if (data.audioClips && Array.isArray(data.audioClips)) {
        setAudioClips(data.audioClips);
      }
      if (data.videoClips && Array.isArray(data.videoClips)) {
        setVideoClips(data.videoClips);
      }
      lastSaveRef.current = JSON.stringify(data, null, 2);
    } catch {
      await loadProjectAudioFiles(projectPath, signal);
    }
  }, [loadProjectAudioFiles, setAudioClips, setVideoClips]);

  // Keep a ref to the latest saveTimeline to avoid restarting the interval on every clip change
  const saveTimelineRef = useRef(saveTimeline);
  saveTimelineRef.current = saveTimeline;

  // Auto-save every AUTOSAVE_INTERVAL_MS
  useEffect(() => {
    if (currentProject && !showStartup) {
      autoSaveRef.current = window.setInterval(() => {
        saveTimelineRef.current();
      }, AUTOSAVE_INTERVAL_MS);
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [currentProject, showStartup]);

  return { saveTimeline, loadTimeline };
}
