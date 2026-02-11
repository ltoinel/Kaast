import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./PublishPage.css";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import type { AudioClip, VideoClip } from "../types";
import { formatTimecode } from "../remotion/constants";

type ExportQuality = "ultrafast" | "fast" | "medium" | "slow";

interface PublishPageProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  projectPath?: string;
  projectName?: string;
}

function PublishPage({ audioClips, videoClips, projectPath, projectName }: PublishPageProps) {
  const { t } = useTranslation();
  const [quality, setQuality] = useState<ExportQuality>("medium");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [exportResult, setExportResult] = useState<string>("");

  const totalDuration = useMemo(() => {
    return Math.max(
      ...audioClips.map(c => c.startTime + c.duration),
      ...videoClips.map(c => c.startTime + c.duration),
      0
    );
  }, [audioClips, videoClips]);

  const hasMedia = audioClips.length > 0 || videoClips.length > 0;

  const handleExport = async () => {
    if (!hasMedia) {
      setError(t("publish.errorNoMedia"));
      return;
    }

    setIsExporting(true);
    setError("");
    setExportResult("");
    setProgress(t("publish.preparing"));

    try {
      // Build export filename: {projectName}_{quality}_{timestamp}.mp4
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const safeName = (projectName || "podcast").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${safeName}_${quality}_${timestamp}.mp4`;

      // Determine output path
      let outputPath: string;

      if (projectPath) {
        const exportDir = `${projectPath}/export`;
        // Ensure export directory exists
        const { mkdir } = await import("@tauri-apps/plugin-fs");
        await mkdir(exportDir, { recursive: true });
        outputPath = `${exportDir}/${fileName}`;
      } else {
        // Ask user for save location
        const { save } = await import("@tauri-apps/plugin-dialog");
        const savePath = await save({
          filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
          defaultPath: fileName,
        });
        if (!savePath) {
          setIsExporting(false);
          return;
        }
        outputPath = savePath;
      }

      // Collect all media paths (video first, then audio)
      const allClips = [
        ...videoClips.map(c => c.path),
        ...audioClips.map(c => c.path),
      ];

      setProgress(t("publish.encoding"));

      const result = await safeInvoke<string>("export_project", {
        clips: allClips,
        outputPath,
        quality,
      });

      setExportResult(result);
      setProgress("");
    } catch (err) {
      setError(getTauriErrorMessage(err));
      setProgress("");
    } finally {
      setIsExporting(false);
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
        <h2>{t("publish.title")}</h2>
        <span className="publish-subtitle">{t("publish.subtitle")}</span>
      </div>

      <div className="publish-content">
        {/* Summary */}
        <div className="publish-section">
          <h3>{t("publish.summaryTitle")}</h3>
          <div className="publish-summary">
            <div className="summary-item">
              <span className="summary-label">{t("publish.videoClips")}</span>
              <span className="summary-value">{videoClips.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{t("publish.audioClips")}</span>
              <span className="summary-value">{audioClips.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{t("publish.totalDuration")}</span>
              <span className="summary-value">{formatTimecode(totalDuration)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{t("publish.outputFormat")}</span>
              <span className="summary-value">MP4 (H.264 + AAC)</span>
            </div>
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

        {/* Output */}
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

        {/* Export Button */}
        <div className="publish-actions">
          <button
            className="btn btn-primary btn-export"
            onClick={handleExport}
            disabled={isExporting || !hasMedia}
          >
            {isExporting ? (
              <>
                <span className="spinner"></span>
                {progress}
              </>
            ) : (
              t("publish.exportButton")
            )}
          </button>
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
  );
}

export default PublishPage;
