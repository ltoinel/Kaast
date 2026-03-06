/**
 * useScenes — Custom hook managing scene state, persistence, and operations.
 *
 * Extracts scene-related logic from ScenesPage to reduce component complexity
 * and enable independent testing.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { safeInvoke, getTauriErrorMessage, basename } from "../utils/tauri";
import { computeTotalDuration } from "../utils/duration";
import { getSecureValue, GEMINI_API_KEY, PEXELS_API_KEY } from "../utils/secureStore";
import { getStoredSceneStylePrompt } from "../components/StyleEditor";
import type { AudioClip, VideoClip, VideoScene } from "../types";

/** Persist scenes array to the project's scenes.json file. */
async function persistScenes(projectPath: string, scenes: VideoScene[]): Promise<void> {
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(
      `${projectPath}/scenes.json`,
      JSON.stringify(scenes, null, 2)
    );
  } catch (e) {
    console.error("Scene save error:", e);
  }
}

interface UseScenesOptions {
  audioClips: AudioClip[];
  projectPath?: string;
  onOpenSettings?: () => void;
  onProduceToTimeline?: (clips: VideoClip[]) => void;
  isActive?: boolean;
}

export function useScenes({ audioClips, projectPath, onOpenSettings, onProduceToTimeline, isActive }: UseScenesOptions) {
  const { t, i18n } = useTranslation();
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [script, setScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isProducing, setIsProducing] = useState(false);
  const [produceProgress, setProduceProgress] = useState(0);
  const [produceTotal, setProduceTotal] = useState(0);
  const [downloadingSceneId, setDownloadingSceneId] = useState<string | null>(null);
  const [maxSceneDuration, setMaxSceneDuration] = useState(10);

  const totalDuration = useMemo(
    () => computeTotalDuration(audioClips, []),
    [audioClips],
  );

  const totalScenesDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  // Reload script from project each time the tab becomes active
  useEffect(() => {
    if (!isActive || !projectPath) return;
    const loadScript = async () => {
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(`${projectPath}/script.md`);
        setScript(content);
      } catch {
        // No script yet
      }
    };
    loadScript();
  }, [projectPath, isActive]);

  // Load saved scenes
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
        // No saved scenes
      }
    };
    loadScenes();
  }, [projectPath]);

  // Compute scene timings using actual scene durations
  const sceneTimings = useMemo(() => {
    if (scenes.length === 0) return [];
    let cumulative = 0;
    return scenes.map((scene) => {
      const start = cumulative;
      cumulative += scene.duration;
      return { start, end: cumulative };
    });
  }, [scenes]);

  /** Generate scenes from the script via Gemini API */
  const handleGenerateScenes = useCallback(async () => {
    const apiKey = await getSecureValue(GEMINI_API_KEY);
    if (!apiKey) {
      setError(t('scenes.errorNoApiKey'));
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!script.trim()) {
      setError(t('scenes.errorNoScript'));
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const result = await safeInvoke<string>("generate_video_scenes", {
        script: script.trim(),
        apiKey,
        totalDuration,
        maxSceneDuration,
        language: i18n.language,
        sceneStylePrompt: getStoredSceneStylePrompt(),
      });

      const parsed = JSON.parse(result) as Array<{
        description: string;
        duration: number;
        scriptExcerpt: string;
        searchKeywords?: string;
      }>;

      // Scale durations so their sum matches totalDuration
      const rawSum = parsed.reduce((sum, s) => sum + Math.max(1, s.duration), 0);
      const scale = totalDuration > 0 && rawSum > 0 ? totalDuration / rawSum : 1;

      const newScenes: VideoScene[] = parsed.map((scene, index) => ({
        id: `scene_${Date.now()}_${index}`,
        description: scene.description,
        duration: Math.round(Math.max(1, scene.duration) * scale),
        scriptExcerpt: scene.scriptExcerpt,
        searchKeywords: scene.searchKeywords,
      }));

      // Adjust last scene to absorb rounding errors
      if (newScenes.length > 0 && totalDuration > 0) {
        const currentSum = newScenes.reduce((sum, s) => sum + s.duration, 0);
        const diff = Math.round(totalDuration) - currentSum;
        newScenes[newScenes.length - 1].duration = Math.max(1, newScenes[newScenes.length - 1].duration + diff);
      }

      setScenes(newScenes);
      if (projectPath) await persistScenes(projectPath, newScenes);
    } catch (err) {
      setError(getTauriErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  }, [script, totalDuration, maxSceneDuration, i18n.language, projectPath, t, onOpenSettings]);

  /** Start editing a scene description */
  const handleStartEdit = useCallback((e: React.MouseEvent, scene: VideoScene) => {
    e.stopPropagation();
    setEditingSceneId(scene.id);
    setEditingText(scene.description);
  }, []);

  /** Save edited description */
  const handleSaveEdit = useCallback(async () => {
    if (!editingSceneId) return;
    const updatedScenes = scenes.map((s) =>
      s.id === editingSceneId ? { ...s, description: editingText } : s
    );
    setScenes(updatedScenes);
    setEditingSceneId(null);
    if (projectPath) await persistScenes(projectPath, updatedScenes);
  }, [editingSceneId, editingText, scenes, projectPath]);

  /** Cancel editing */
  const handleCancelEdit = useCallback(() => {
    setEditingSceneId(null);
  }, []);

  /** Download Pexels videos for all scenes sequentially */
  const handleFeed = useCallback(async () => {
    const pexelsKey = await getSecureValue(PEXELS_API_KEY);
    if (!pexelsKey) {
      setError(t('scenes.errorNoPexelsKey'));
      if (onOpenSettings) onOpenSettings();
      return;
    }
    if (!projectPath || scenes.length === 0) return;

    setIsProducing(true);
    setError("");
    setProduceTotal(scenes.length);

    const updatedScenes = [...scenes];
    for (let i = 0; i < updatedScenes.length; i++) {
      setProduceProgress(i + 1);
      setDownloadingSceneId(updatedScenes[i].id);

      // Skip if video already exists
      if (updatedScenes[i].videoPath) continue;

      try {
        const videoPath = await safeInvoke<string>("search_and_download_pexels_video", {
          apiKey: pexelsKey,
          query: updatedScenes[i].searchKeywords || updatedScenes[i].description,
          minDuration: updatedScenes[i].duration,
          projectPath,
          sceneIndex: i + 1,
        });
        const thumbPath = `${projectPath}/cache/scene_${String(i + 1).padStart(3, "0")}.jpg`;
        let thumbnailPath: string | undefined;
        try {
          thumbnailPath = await safeInvoke<string>("generate_video_thumbnail", {
            videoPath,
            thumbnailPath: thumbPath,
          });
        } catch (thumbErr) {
          console.error(`Thumbnail generation failed for scene ${i + 1}:`, thumbErr);
        }
        let proxyPath: string | undefined;
        try {
          const proxyFile = `${projectPath}/cache/proxy_${String(i + 1).padStart(3, "0")}.mp4`;
          proxyPath = await safeInvoke<string>("generate_video_proxy", {
            videoPath,
            proxyPath: proxyFile,
          });
        } catch (proxyErr) {
          console.error(`Proxy generation failed for scene ${i + 1}:`, proxyErr);
        }
        updatedScenes[i] = { ...updatedScenes[i], videoPath, thumbnailPath, proxyPath };
      } catch (err) {
        console.error(`Error downloading video for scene ${i + 1}:`, err);
      }
    }

    setScenes(updatedScenes);
    setDownloadingSceneId(null);
    await persistScenes(projectPath, updatedScenes);
    setIsProducing(false);
  }, [scenes, projectPath, t, onOpenSettings]);

  /** Assemble scene videos as VideoClips on the Edit timeline */
  const handleProduceToTimeline = useCallback(() => {
    const scenesWithVideo = scenes.filter(s => s.videoPath);
    if (scenesWithVideo.length === 0 || !onProduceToTimeline) return;

    let offset = 0;
    const clips: VideoClip[] = scenesWithVideo.map((scene, index) => {
      const clip: VideoClip = {
        id: `video_${Date.now()}_${index}`,
        name: basename(scene.videoPath!) || `Scene ${index + 1}`,
        path: scene.videoPath!,
        duration: scene.duration,
        startTime: offset,
        thumbnail: scene.thumbnailPath,
        proxyPath: scene.proxyPath,
      };
      offset += scene.duration;
      return clip;
    });

    onProduceToTimeline(clips);
  }, [scenes, onProduceToTimeline]);

  /** Remove video and thumbnail from a scene */
  const handleDeleteVideo = useCallback(async (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    const updatedScenes = scenes.map((s) =>
      s.id === sceneId ? { ...s, videoPath: undefined, thumbnailPath: undefined } : s
    );
    setScenes(updatedScenes);
    if (projectPath) await persistScenes(projectPath, updatedScenes);
  }, [scenes, projectPath]);

  return {
    scenes,
    script,
    isGenerating,
    error,
    editingSceneId,
    editingText,
    isProducing,
    produceProgress,
    produceTotal,
    downloadingSceneId,
    maxSceneDuration,
    totalDuration,
    totalScenesDuration,
    sceneTimings,
    setEditingText,
    setMaxSceneDuration,
    handleGenerateScenes,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleFeed,
    handleProduceToTimeline,
    handleDeleteVideo,
  };
}
