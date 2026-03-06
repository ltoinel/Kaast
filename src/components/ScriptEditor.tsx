/**
 * ScriptEditor — Markdown editor for podcast scripts with AI generation.
 *
 * Provides a split-view editor (markdown + preview), script generation from URLs,
 * audio synthesis via Gemini, and an integrated audio player.
 */
import { useState, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { AudioClip } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";
import { usePlaybackTime } from "../hooks/usePlaybackSync";
import { useScript } from "../hooks/useScript";
import { IconEdit, IconEye, IconColumns, IconSave, IconSparkles } from "./Icons";
import AudioPlayer from "./AudioPlayer";
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

marked.setOptions({ breaks: true, gfm: true });

function ScriptEditor({ audioClips, onAudioGenerated, onOpenSettings, playback, isActive = true }: ScriptEditorProps) {
  const { t } = useTranslation();
  const currentTime = usePlaybackTime(playback, isActive);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  const {
    script, url, setUrl, scriptAction, audioAction,
    success, lastSaved, hasUnsavedChanges, totalDuration,
    wordCount, charCount, estimatedMinutes,
    handleScriptChange, saveScript, generateScript, generateAudio,
  } = useScript({ audioClips, onAudioGenerated, onOpenSettings });

  const renderedMarkdown = useMemo(() => {
    if (!script.trim()) return "";
    const rawHtml = marked.parse(script) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return cleanHtml.replace(/(\[[^\]]+\])/g, '<span class="script-stage-direction">$1</span>');
  }, [script]);

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
                <><span className="spinner" />{t('script.generating')}</>
              ) : (
                <><IconSparkles />{t('script.generate')}</>
              )}
            </button>
          </div>
        </div>

        <div className="toolbar-center">
          <div className="view-toggle">
            <button className={`toggle-btn ${viewMode === "edit" ? "active" : ""}`} onClick={() => setViewMode("edit")} title={t('script.editor')}>
              <IconEdit />
            </button>
            <button className={`toggle-btn ${viewMode === "split" ? "active" : ""}`} onClick={() => setViewMode("split")} title={t('script.editorAndPreview')}>
              <IconColumns />
            </button>
            <button className={`toggle-btn ${viewMode === "preview" ? "active" : ""}`} onClick={() => setViewMode("preview")} title={t('script.preview')}>
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
              <><span className="spinner" />{t('script.generatingAudio')}</>
            ) : (
              <><IconSparkles />{t('script.generateAudio')}</>
            )}
          </button>
        </div>
      </div>

      {(scriptAction.error || audioAction.error) && <div className="message error" role="alert">{scriptAction.error || audioAction.error}</div>}
      {success && <div className="message success" role="status">{success}</div>}

      <AudioPlayer audioClips={audioClips} currentTime={currentTime} totalDuration={totalDuration} playback={playback} />

      {/* Editor Area */}
      <div className={`editor-area mode-${viewMode}`}>
        {viewMode !== "preview" && (
          <div className="editor-pane">
            <div className="pane-header"><span className="pane-label">{t('script.markdown')}</span></div>
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
            <div className="pane-header"><span className="pane-label">{t('script.previewLabel')}</span></div>
            <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
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
          {lastSaved && <span className="status-saved">{t('script.savedAt', { time: lastSaved })}</span>}
          {hasUnsavedChanges && <span className="status-unsaved">{t('script.unsavedChanges')}</span>}
        </div>
      </div>
    </div>
  );
}

export default memo(ScriptEditor);
