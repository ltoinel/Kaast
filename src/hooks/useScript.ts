/**
 * useScript — Manages script loading, saving, generation, and audio synthesis.
 *
 * Extracts all script-related business logic from ScriptEditor
 * to reduce component complexity and enable independent testing.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { safeInvoke } from "../utils/tauri";
import { getSecureValue, GEMINI_API_KEY } from "../utils/secureStore";
import { getStoredStylePrompt, getStoredVoiceStylePrompt } from "../components/StyleEditor";
import { getCurrentProject } from "../utils/project";
import { useMediaDuration } from "./useMediaDuration";
import { useAsyncAction } from "./useAsyncAction";
import { computeTotalDuration } from "../utils/duration";
import type { AudioClip } from "../types";

interface UseScriptOptions {
  audioClips: AudioClip[];
  onAudioGenerated?: (audioPath: string, duration: number) => void;
  onOpenSettings?: () => void;
}

export function useScript({ audioClips, onAudioGenerated, onOpenSettings }: UseScriptOptions) {
  const { t, i18n } = useTranslation();
  const { probe } = useMediaDuration();
  const [script, setScript] = useState("");
  const [url, setUrl] = useState("");
  const scriptAction = useAsyncAction();
  const audioAction = useAsyncAction();
  const [success, setSuccess] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const totalDuration = useMemo(
    () => computeTotalDuration(audioClips, []),
    [audioClips],
  );

  const wordCount = useMemo(() => script.split(/\s+/).filter(w => w).length, [script]);
  const charCount = script.length;
  const estimatedMinutes = Math.ceil(wordCount / 150);

  useEffect(() => {
    loadScript();
  }, []);

  const handleScriptChange = useCallback((value: string) => {
    setScript(value);
    setHasUnsavedChanges(true);
  }, []);

  const loadScript = async () => {
    const project = getCurrentProject();
    if (!project) return;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const content = await readTextFile(`${project.path}/script.md`);
      setScript(content);
      setHasUnsavedChanges(false);
    } catch {
      // File doesn't exist yet
    }
  };

  const saveScript = useCallback(async () => {
    const project = getCurrentProject();
    if (!project || !script.trim()) return;

    try {
      const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
      try {
        await mkdir(project.path, { recursive: true });
      } catch {
        // Directory already exists
      }
      await writeTextFile(`${project.path}/script.md`, script);
      setLastSaved(new Date().toLocaleTimeString());
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Script save error:", e);
    }
  }, [script]);

  /** Register Ctrl+S keyboard shortcut */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveScript();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveScript]);

  const getApiKey = useCallback(async (): Promise<string | null> => {
    return getSecureValue(GEMINI_API_KEY);
  }, []);

  const generateScript = useCallback(async () => {
    const apiKey = await getApiKey();
    if (!apiKey) {
      scriptAction.setError(t('script.errorNoApiKey'));
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!url.trim()) {
      scriptAction.setError(t('script.errorNoUrl'));
      return;
    }

    setSuccess("");
    await scriptAction.run(async () => {
      const stylePrompt = getStoredStylePrompt();
      let generatedScript = await safeInvoke<string>("generate_podcast_script", {
        url: url.trim(),
        apiKey,
        stylePrompt,
        language: i18n.language,
      });

      generatedScript = generatedScript.replace(/^```(?:markdown|md)?\s*\n?/, "").replace(/\n?```\s*$/, "");

      setScript(generatedScript);
      setHasUnsavedChanges(true);
      setSuccess(t('script.successGenerated'));
      setUrl("");
    });
  }, [url, getApiKey, scriptAction, t, i18n.language, onOpenSettings]);

  const generateAudio = useCallback(async () => {
    const apiKey = await getApiKey();
    if (!apiKey) {
      audioAction.setError(t('script.errorNoApiKey'));
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!script.trim()) {
      audioAction.setError(t('script.errorEmptyScript'));
      return;
    }

    const project = getCurrentProject();
    if (!project) {
      audioAction.setError(t('script.errorNoProject'));
      return;
    }

    setSuccess("");
    await audioAction.run(async () => {
      const { mkdir, readDir, remove } = await import("@tauri-apps/plugin-fs");

      const audioDir = `${project.path}/audios`;
      try {
        await mkdir(audioDir, { recursive: true });
      } catch {
        // Directory already exists
      }

      // Delete previous generated podcast audio files
      try {
        const entries = await readDir(audioDir);
        for (const entry of entries) {
          if (entry.isFile && entry.name?.startsWith("podcast_") && entry.name.endsWith(".wav")) {
            await remove(`${audioDir}/${entry.name}`);
          }
        }
      } catch {
        // Directory empty or read error — continue
      }

      const outputPath = `${audioDir}/podcast_${Date.now()}.wav`;

      const resultPath = await safeInvoke<string>("generate_voice", {
        text: script,
        apiKey,
        outputPath,
        language: i18n.language,
        voiceStylePrompt: getStoredVoiceStylePrompt(),
      });

      setSuccess(t('script.audioGenerated', { path: resultPath }));

      const { duration: realDuration } = await probe(resultPath);

      if (onAudioGenerated) {
        onAudioGenerated(resultPath, realDuration);
      }
    });
  }, [script, getApiKey, audioAction, t, i18n.language, probe, onAudioGenerated, onOpenSettings]);

  return {
    script,
    url,
    setUrl,
    scriptAction,
    audioAction,
    success,
    lastSaved,
    hasUnsavedChanges,
    totalDuration,
    wordCount,
    charCount,
    estimatedMinutes,
    handleScriptChange,
    saveScript,
    generateScript,
    generateAudio,
  };
}
