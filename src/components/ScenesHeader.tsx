/**
 * ScenesHeader — Toolbar for the Scenes tab with generate, feed, and produce actions.
 */
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../utils/timecode";
import { IconSparkles, IconDownload, IconFilmSmall as IconFilm } from "./Icons";
import type { VideoScene } from "../types";

interface ScenesHeaderProps {
  scenes: VideoScene[];
  script: string;
  isGenerating: boolean;
  isProducing: boolean;
  produceProgress: number;
  produceTotal: number;
  maxSceneDuration: number;
  totalScenesDuration: number;
  onMaxSceneDurationChange: (value: number) => void;
  onGenerate: () => void;
  onFeed: () => void;
  onProduce: () => void;
}

function ScenesHeader({
  scenes, script, isGenerating, isProducing,
  produceProgress, produceTotal, maxSceneDuration,
  totalScenesDuration, onMaxSceneDurationChange,
  onGenerate, onFeed, onProduce,
}: ScenesHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="scenes-header">
      <div className="scenes-header-left">
        <h2>{t('app.scenes')}</h2>
        {scenes.length > 0 && (
          <span className="scenes-count">
            {t('scenes.count', { count: scenes.length })} · {formatTime(totalScenesDuration)}
          </span>
        )}
      </div>
      <div className="scenes-header-actions">
        <div className="scenes-max-duration">
          <label htmlFor="max-scene-duration">{t('scenes.maxDuration')}</label>
          <input
            id="max-scene-duration"
            type="number"
            min={4}
            max={20}
            value={maxSceneDuration}
            onChange={(e) => onMaxSceneDurationChange(Math.min(20, Math.max(4, parseInt(e.target.value) || 10)))}
            className="scenes-max-duration-input"
          />
          <span className="scenes-max-duration-unit">s</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={isGenerating || !script.trim()}
        >
          {isGenerating ? (
            <>
              <span className="spinner"></span>
              {t('scenes.analyzing')}
            </>
          ) : (
            <>
              <IconSparkles />
              {t('scenes.generateScenes')}
            </>
          )}
        </button>
        {scenes.length > 0 && (
          <button
            className="btn btn-success"
            onClick={onFeed}
            disabled={isProducing}
          >
            {isProducing ? (
              <>
                <span className="spinner"></span>
                {t('scenes.feeding', { current: produceProgress, total: produceTotal })}
              </>
            ) : (
              <>
                <IconDownload />
                {t('scenes.feed')}
              </>
            )}
          </button>
        )}
        {scenes.some(s => s.videoPath) && (
          <button
            className="btn btn-info"
            onClick={onProduce}
          >
            <IconFilm />
            {t('scenes.produce')}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ScenesHeader);
