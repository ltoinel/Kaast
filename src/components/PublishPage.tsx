import { useState, useMemo, useRef, memo } from "react";
import { useTranslation } from "react-i18next";
import "./PublishPage.css";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import type { AudioClip, VideoClip } from "../types";
import { formatTimecode } from "../utils/timecode";

type ExportQuality = "ultrafast" | "fast" | "medium" | "slow";
type ExportFormat = "h264" | "h265" | "vp9" | "prores";

/** Configuration for each export format (label i18n key, file extension, save dialog filter). */
const FORMAT_CONFIGS: Record<ExportFormat, { labelKey: string; extension: string; filterName: string }> = {
  h264: { labelKey: "publish.formatH264", extension: "mp4", filterName: "MP4 Video" },
  h265: { labelKey: "publish.formatH265", extension: "mp4", filterName: "MP4 Video" },
  vp9:  { labelKey: "publish.formatVP9",  extension: "webm", filterName: "WebM Video" },
  prores: { labelKey: "publish.formatProRes", extension: "mov", filterName: "MOV Video" },
};

/** Estimated video bitrates in Mbps at 1080p30 per format and quality. */
const VIDEO_BITRATES_MBPS: Record<ExportFormat, Record<ExportQuality, number>> = {
  h264:   { ultrafast: 5.0, fast: 3.5, medium: 3.0, slow: 2.5 },
  h265:   { ultrafast: 3.0, fast: 2.0, medium: 1.5, slow: 1.2 },
  vp9:    { ultrafast: 3.5, fast: 2.5, medium: 2.0, slow: 1.5 },
  prores: { ultrafast: 45,  fast: 102, medium: 147, slow: 220 },
};

/** Audio bitrate in Mbps per format. */
const AUDIO_BITRATES_MBPS: Record<ExportFormat, number> = {
  h264: 0.192,
  h265: 0.192,
  vp9: 0.128,
  prores: 0.192,
};

/** Format a file size in bytes to a human-readable string (KB / MB / GB). */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface PublishPageProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  projectPath?: string;
  projectName?: string;
}

function PublishPage({ audioClips, videoClips, projectPath, projectName }: PublishPageProps) {
  const { t } = useTranslation();
  const [quality, setQuality] = useState<ExportQuality>("medium");
  const [format, setFormat] = useState<ExportFormat>("h264");
  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [exportResult, setExportResult] = useState<string>("");
  const unlistenRef = useRef<(() => void) | null>(null);

  const totalDuration = useMemo(() => {
    return Math.max(
      ...audioClips.map(c => c.startTime + c.duration),
      ...videoClips.map(c => c.startTime + c.duration),
      0
    );
  }, [audioClips, videoClips]);

  const hasMedia = audioClips.length > 0 || videoClips.length > 0;

  /** Estimated output file size in bytes based on format, quality and duration. */
  const estimatedSizeBytes = useMemo(() => {
    if (totalDuration <= 0) return 0;
    const videoBitrate = VIDEO_BITRATES_MBPS[format][quality];
    const audioBitrate = AUDIO_BITRATES_MBPS[format];
    const sizeMB = (videoBitrate + audioBitrate) * totalDuration / 8;
    return sizeMB * 1024 * 1024;
  }, [format, quality, totalDuration]);

  const handleExport = async () => {
    if (!hasMedia) {
      setError(t("publish.errorNoMedia"));
      return;
    }

    setIsExporting(true);
    setError("");
    setExportResult("");
    setProgressText(t("publish.preparing"));
    setProgressPercent(0);

    try {
      const formatConfig = FORMAT_CONFIGS[format];
      // Build export filename: {projectName}_{quality}_{timestamp}.{ext}
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const safeName = (projectName || "podcast").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${safeName}_${quality}_${timestamp}.${formatConfig.extension}`;

      // Determine output path
      let outputPath: string;

      if (projectPath) {
        const exportDir = `${projectPath}/export`;
        const { mkdir } = await import("@tauri-apps/plugin-fs");
        await mkdir(exportDir, { recursive: true });
        outputPath = `${exportDir}/${fileName}`;
      } else {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const savePath = await save({
          filters: [{ name: formatConfig.filterName, extensions: [formatConfig.extension] }],
          defaultPath: fileName,
        });
        if (!savePath) {
          setIsExporting(false);
          return;
        }
        outputPath = savePath;
      }

      // Listen for FFmpeg progress events from Rust
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen<number>("export-progress", (event) => {
        const percent = Math.round(event.payload);
        setProgressPercent(percent);
        setProgressText(t("publish.encoding") + ` ${percent}%`);
      });
      unlistenRef.current = unlisten;

      // Send structured clip data for proper FFmpeg assembly
      const exportVideoClips = videoClips.map(c => ({
        path: c.path,
        duration: c.duration,
      }));
      const audioPath = audioClips.length > 0 ? audioClips[0].path : null;

      const result = await safeInvoke<string>("export_project", {
        videoClips: exportVideoClips,
        audioPath,
        outputPath,
        quality,
        totalDuration,
        format,
      });

      setExportResult(result);
      setProgressText("");
    } catch (err) {
      setError(getTauriErrorMessage(err));
      setProgressText("");
    } finally {
      // Clean up event listener
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      setIsExporting(false);
      setProgressPercent(0);
    }
  };

  const handleOpenFolder = async () => {
    if (!projectPath) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(`${projectPath}/export`);
    } catch (err) {
      console.error("Open folder error:", err);
    }
  };

  const formatOptions: { value: ExportFormat; label: string; desc: string }[] = [
    { value: "h264", label: t("publish.formatH264"), desc: t("publish.formatH264Desc") },
    { value: "h265", label: t("publish.formatH265"), desc: t("publish.formatH265Desc") },
    { value: "vp9", label: t("publish.formatVP9"), desc: t("publish.formatVP9Desc") },
    { value: "prores", label: t("publish.formatProRes"), desc: t("publish.formatProResDesc") },
  ];

  const qualityOptions: { value: ExportQuality; label: string; desc: string }[] = [
    { value: "ultrafast", label: t("publish.qualityUltrafast"), desc: t("publish.qualityUltrafastDesc") },
    { value: "fast", label: t("publish.qualityFast"), desc: t("publish.qualityFastDesc") },
    { value: "medium", label: t("publish.qualityMedium"), desc: t("publish.qualityMediumDesc") },
    { value: "slow", label: t("publish.qualitySlow"), desc: t("publish.qualitySlowDesc") },
  ];

  return (
    <div className="publish-page">
      {/* Header */}
      <div className="publish-header">
        <h2>{t("app.publish")}</h2>
        <span className="publish-subtitle">{t("publish.subtitle")}</span>
      </div>

      <div className="publish-content">
        {/* Left column — Settings */}
        <div className="publish-col-left">
          {/* Format */}
          <div className="publish-section">
            <h3>{t("publish.formatTitle")}</h3>
            <div className="format-options">
              {formatOptions.map(opt => (
                <label
                  key={opt.value}
                  className={`format-option ${format === opt.value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    disabled={isExporting}
                  />
                  <div className="format-info">
                    <span className="format-label">{opt.label}</span>
                    <span className="format-desc">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="publish-section">
            <h3>{t("publish.qualityTitle")}</h3>
            <div className="quality-options">
              {qualityOptions.map(opt => (
                <label
                  key={opt.value}
                  className={`quality-option ${quality === opt.value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="quality"
                    value={opt.value}
                    checked={quality === opt.value}
                    onChange={() => setQuality(opt.value)}
                    disabled={isExporting}
                  />
                  <div className="quality-info">
                    <span className="quality-label">{opt.label}</span>
                    <span className="quality-desc">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Output */}
        <div className="publish-col-right">
          {/* Output path */}
          <div className="publish-section">
            <h3>{t("publish.outputTitle")}</h3>
            <div className="output-path">
              <span className="output-path-value">
                {projectPath ? `${projectPath}/export/` : t("publish.chooseOnExport")}
              </span>
              {projectPath && (
                <button className="btn btn-sm" onClick={handleOpenFolder}>
                  {t("publish.openFolder")}
                </button>
              )}
            </div>
          </div>

          {/* Estimated size */}
          {totalDuration > 0 && (
            <div className="publish-section">
              <h3>{t("publish.estimatedSize")}</h3>
              <div className="estimated-size-display">
                <span className="estimated-size-value">~ {formatFileSize(estimatedSizeBytes)}</span>
              </div>
            </div>
          )}

          {/* Export Button + Progress */}
          <div className="publish-actions">
            <button
              className="btn btn-primary btn-export"
              onClick={handleExport}
              disabled={isExporting || !hasMedia}
            >
              {isExporting ? (
                <>
                  <span className="spinner"></span>
                  {progressText}
                </>
              ) : (
                t("publish.exportButton")
              )}
            </button>

            {isExporting && (
              <div className="export-progress">
                <div className="export-progress-bar">
                  <div
                    className="export-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="export-progress-label">{progressPercent}%</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="publish-error">
              {error}
            </div>
          )}

          {/* Success */}
          {exportResult && (
            <div className="publish-success">
              {exportResult}
            </div>
          )}

          {/* Empty state */}
          {!hasMedia && (
            <div className="publish-empty">
              <p>{t("publish.noMedia")}</p>
              <p className="publish-empty-hint">{t("publish.noMediaHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PublishPage);
