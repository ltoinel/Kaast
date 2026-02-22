/**
 * SceneCard — Renders a single scene inside the ScenesPage grid.
 *
 * Shows thumbnail preview (or download spinner), progress bar when active,
 * description (editable inline), keywords and script excerpt.
 */
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { VideoScene } from "../types";
import "./SceneCard.css";

export interface SceneCardProps {
  scene: VideoScene;
  index: number;
  isActive: boolean;
  isPast: boolean;
  progress: number;
  thumbnailUrl: string | undefined;
  isEditing: boolean;
  editingText: string;
  isDownloading: boolean;
  onSceneClick: (index: number) => void;
  onOpenVideoModal: (e: React.MouseEvent, scene: VideoScene) => void;
  onDeleteVideo: (e: React.MouseEvent, sceneId: string) => void;
  onStartEdit: (e: React.MouseEvent, scene: VideoScene) => void;
  onEditTextChange: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  /** Ref callback for lazy thumbnail loading via IntersectionObserver. */
  observeRef: (el: HTMLDivElement | null) => void;
  /** Ref callback for auto-scrolling the active card into view. */
  activeCardRef: React.Ref<HTMLDivElement>;
  needsLazyLoad: boolean;
}

function SceneCard({
  scene, index, isActive, isPast, progress,
  thumbnailUrl, isEditing, editingText, isDownloading,
  onSceneClick, onOpenVideoModal, onDeleteVideo,
  onStartEdit, onEditTextChange, onSaveEdit, onCancelEdit,
  observeRef, activeCardRef, needsLazyLoad,
}: SceneCardProps) {
  const { t } = useTranslation();
  const hasThumbnail = !!scene.thumbnailPath && !!thumbnailUrl;

  const handleClick = useCallback(() => onSceneClick(index), [onSceneClick, index]);

  return (
    <div
      ref={(el) => {
        if (isActive && typeof activeCardRef === "function") activeCardRef(el);
        if (typeof activeCardRef === "object" && activeCardRef) {
          (activeCardRef as React.MutableRefObject<HTMLDivElement | null>).current = isActive ? el : (activeCardRef as React.MutableRefObject<HTMLDivElement | null>).current;
        }
        if (needsLazyLoad) observeRef(el);
      }}
      data-scene-id={scene.id}
      data-thumb-path={scene.thumbnailPath || undefined}
      className={`scene-card${isActive ? " scene-card--active" : ""}${isPast ? " scene-card--past" : ""}`}
      onClick={handleClick}
    >
      {isActive && (
        <div className="scene-progress-bar">
          <div className="scene-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {hasThumbnail ? (
        <div className="scene-video-container" onClick={(e) => onOpenVideoModal(e, scene)}>
          <img
            className="scene-video-preview"
            src={thumbnailUrl}
            alt={scene.description}
          />
          <div className="scene-video-play-btn">&#9654;</div>
          <div className="scene-video-overlay">
            <button
              className="scene-video-action"
              title={t("scenes.deleteVideo")}
              onClick={(e) => onDeleteVideo(e, scene.id)}
            >
              ✕
            </button>
            <button
              className="scene-video-action"
              title={t("scenes.editDescription")}
              onClick={(e) => onStartEdit(e, scene)}
            >
              ✎
            </button>
          </div>
        </div>
      ) : isDownloading ? (
        <div className="scene-video-container">
          <div className="scene-producing-overlay">
            <span className="spinner"></span>
            <span>{t("scenes.downloading")}</span>
          </div>
        </div>
      ) : null}

      <div className="scene-card-header">
        <span className="scene-number">{t("scenes.sceneNumber", { number: index + 1 })}</span>
        <span className="scene-duration">{scene.duration}s</span>
      </div>

      {isEditing ? (
        <textarea
          className="scene-description-edit"
          value={editingText}
          onChange={(e) => onEditTextChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSaveEdit(); }
            if (e.key === "Escape") onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <p className="scene-description" onClick={(e) => onStartEdit(e, scene)}>
          {scene.description}
        </p>
      )}

      {scene.searchKeywords && (
        <p className="scene-keywords">{scene.searchKeywords}</p>
      )}
      <p className="scene-excerpt">{"\u00AB"} {scene.scriptExcerpt} {"\u00BB"}</p>
    </div>
  );
}

export default memo(SceneCard);
