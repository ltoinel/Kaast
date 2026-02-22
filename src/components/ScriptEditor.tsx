import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { safeInvoke } from "../utils/tauri";
import { getStoredStylePrompt, getStoredVoiceStylePrompt } from "./StyleEditor";
import { getCurrentProject } from "../utils/project";
import { useMediaDuration } from "../hooks/useMediaDuration";
import { formatTime } from "../utils/timecode";
import type { AudioClip } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";
import { usePlaybackTime } from "../hooks/usePlaybackSync";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { computeTotalDuration } from "../utils/duration";
import "./ScriptEditor.css";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface ScriptEditorProps {
  audioClips: AudioClip[];
  onAudioGenerated?: (audioPath: string, duration: number) => void;
  onOpenSettings?: () => void;
  playback: PlaybackHandle;
  isActive?: boolean;
}

type ViewMode = "edit" | "preview" | "split";

marked.setOptions({
  breaks: true,
  gfm: true,
});

// SVG icons for the toolbar
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconColumns = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);

const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const IconSparkles = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M9.813 3.563a.5.5 0 0 1 .874 0l1.121 2.012a.5.5 0 0 0 .262.233l2.151.905a.5.5 0 0 1 0 .914l-2.151.905a.5.5 0 0 0-.262.233L10.687 10.777a.5.5 0 0 1-.874 0L8.692 8.765a.5.5 0 0 0-.262-.233l-2.151-.905a.5.5 0 0 1 0-.914l2.151-.905a.5.5 0 0 0 .262-.233L9.813 3.563z" />
    <path d="M17.406 10.969a.5.5 0 0 1 .874 0l.813 1.458a.5.5 0 0 0 .262.233l1.559.655a.5.5 0 0 1 0 .914l-1.559.655a.5.5 0 0 0-.262.233l-.813 1.458a.5.5 0 0 1-.874 0l-.813-1.458a.5.5 0 0 0-.262-.233l-1.559-.655a.5.5 0 0 1 0-.914l1.559-.655a.5.5 0 0 0 .262-.233l.813-1.458z" />
    <path d="M10.406 15.969a.5.5 0 0 1 .874 0l.813 1.458a.5.5 0 0 0 .262.233l1.559.655a.5.5 0 0 1 0 .914l-1.559.655a.5.5 0 0 0-.262.233l-.813 1.458a.5.5 0 0 1-.874 0l-.813-1.458a.5.5 0 0 0-.262-.233l-1.559-.655a.5.5 0 0 1 0-.914l1.559-.655a.5.5 0 0 0 .262-.233l.813-1.458z" />
  </svg>
);

function ScriptEditor({ audioClips, onAudioGenerated, onOpenSettings, playback, isActive = true }: ScriptEditorProps) {
  const { t, i18n } = useTranslation();
  const { probe } = useMediaDuration();
  const currentTime = usePlaybackTime(playback, isActive);
  const [script, setScript] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const scriptAction = useAsyncAction();
  const audioAction = useAsyncAction();
  const [success, setSuccess] = useState<string>("");
  const [lastSaved, setLastSaved] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Total audio duration (for UI display only — playback is managed by App)
  const totalDuration = useMemo(
    () => computeTotalDuration(audioClips, []),
    [audioClips],
  );

  const handleSeekInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    playback.handleSeek(parseFloat(e.target.value));
  }, [playback]);

  useEffect(() => {
    loadScript();
  }, []);

  const handleScriptChange = useCallback((value: string) => {
    setScript(value);
    setHasUnsavedChanges(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveScript();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [script]);

  const loadScript = async () => {
    const project = getCurrentProject();
    if (!project) return;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const scriptPath = `${project.path}/script.md`;
      const content = await readTextFile(scriptPath);
      setScript(content);
      setHasUnsavedChanges(false);
    } catch {
      // File doesn't exist yet
    }
  };

  const saveScript = async () => {
    const project = getCurrentProject();
    if (!project || !script.trim()) return;

    try {
      const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
      const scriptPath = `${project.path}/script.md`;

      try {
        await mkdir(project.path, { recursive: true });
      } catch {
        // Directory already exists
      }

      await writeTextFile(scriptPath, script);
      setLastSaved(new Date().toLocaleTimeString());
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Script save error:", e);
    }
  };

  const renderedMarkdown = useMemo(() => {
    if (!script.trim()) return "";
    const rawHtml = marked.parse(script) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    // Highlight bracketed text [like this] in bold green
    return cleanHtml.replace(/(\[[^\]]+\])/g, '<span class="script-stage-direction">$1</span>');
  }, [script]);

  const getApiKey = useCallback((): string | null => {
    return localStorage.getItem("gemini_api_key");
  }, []);

  const generateScript = async () => {
    const apiKey = getApiKey();
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
  };

  const generateAudio = async () => {
    const apiKey = getApiKey();
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

      const timestamp = Date.now();
      const outputPath = `${audioDir}/podcast_${timestamp}.wav`;

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
  };

  const wordCount = useMemo(() => script.split(/\s+/).filter(w => w).length, [script]);
  const charCount = script.length;
  const estimatedMinutes = Math.ceil(wordCount / 150);

  return (
    <div className="script-editor">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <h3 className="toolbar-title">{t('app.script')}</h3>
          <div className="url-input-group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('script.urlPlaceholder')}
              className="url-input"
              disabled={scriptAction.isLoading}
            />
            <button
              onClick={generateScript}
              disabled={scriptAction.isLoading || !url.trim()}
              className="btn btn-primary toolbar-btn"
            >
              {scriptAction.isLoading ? (
                <>
                  <span className="spinner" />
                  {t('script.generating')}
                </>
              ) : (
                <>
                  <IconSparkles />
                  {t('script.generate')}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="toolbar-center">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === "edit" ? "active" : ""}`}
              onClick={() => setViewMode("edit")}
              title={t('script.editor')}
            >
              <IconEdit />
            </button>
            <button
              className={`toggle-btn ${viewMode === "split" ? "active" : ""}`}
              onClick={() => setViewMode("split")}
              title={t('script.editorAndPreview')}
            >
              <IconColumns />
            </button>
            <button
              className={`toggle-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
              title={t('script.preview')}
            >
              <IconEye />
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button
            onClick={saveScript}
            className={`btn btn-secondary toolbar-btn ${hasUnsavedChanges ? "btn-unsaved" : ""}`}
            disabled={!script.trim()}
            title={t('script.save')}
          >
            <IconSave />
            {hasUnsavedChanges ? t('script.saveUnsaved') : t('script.saved')}
          </button>
          <button
            onClick={generateAudio}
            disabled={audioAction.isLoading || !script.trim()}
            className="btn btn-success toolbar-btn"
          >
            {audioAction.isLoading ? (
              <>
                <span className="spinner" />
                {t('script.generatingAudio')}
              </>
            ) : (
              <>
                <IconSparkles />
                {t('script.generateAudio')}
              </>
            )}
          </button>
        </div>
      </div>

      {(scriptAction.error || audioAction.error) && <div className="message error">{scriptAction.error || audioAction.error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Audio Player */}
      {audioClips.length > 0 && (
        <div className="script-audio-player">
          <button
            className="audio-play-btn"
            onClick={playback.handlePlayPause}
            disabled={audioClips.length === 0}
          >
            {playback.isPlaying ? "\u23F8" : "\u25B6"}
          </button>
          <div className="audio-progress-wrapper">
            <input
              type="range"
              className="audio-progress"
              min="0"
              max={totalDuration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeekInput}
            />
          </div>
          <span className="audio-time">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
          <span className="audio-name">
            {audioClips[0]?.name}
          </span>
        </div>
      )}

      {/* Editor Area */}
      <div className={`editor-area mode-${viewMode}`}>
        {viewMode !== "preview" && (
          <div className="editor-pane">
            <div className="pane-header">
              <span className="pane-label">{t('script.markdown')}</span>
            </div>
            <textarea
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              placeholder={t('script.placeholder')}
              className="editor-textarea"
              spellCheck={false}
            />
          </div>
        )}

        {viewMode !== "edit" && (
          <div className="preview-pane">
            <div className="pane-header">
              <span className="pane-label">{t('script.previewLabel')}</span>
            </div>
            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="editor-statusbar">
        <div className="statusbar-left">
          <span className="status-item">{wordCount} {t('script.words')}</span>
          <span className="status-item">{charCount} {t('script.chars')}</span>
          <span className="status-item">~{estimatedMinutes} {t('script.minutes')}</span>
        </div>
        <div className="statusbar-right">
          {lastSaved && (
            <span className="status-saved">{t('script.savedAt', { time: lastSaved })}</span>
          )}
          {hasUnsavedChanges && (
            <span className="status-unsaved">{t('script.unsavedChanges')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ScriptEditor);
