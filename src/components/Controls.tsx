import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import "./Controls.css";

interface ControlsProps {
  onVideoSelect: (path: string) => void;
  ffmpegAvailable: boolean;
  currentVideoPath: string;
}

function Controls({ onVideoSelect, ffmpegAvailable, currentVideoPath }: ControlsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  const handleOpenVideo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Vidéo",
          extensions: ["mp4", "avi", "mov", "mkv", "webm"]
        }]
      });

      if (selected && typeof selected === "string") {
        const assetUrl = convertFileSrc(selected);
        onVideoSelect(assetUrl);
      }
    } catch (error) {
      console.error("Erreur lors de l'ouverture du fichier:", error);
    }
  };

  const handleExport = async () => {
    if (!currentVideoPath) {
      alert("Veuillez charger une vidéo d'abord");
      return;
    }

    try {
      setIsExporting(true);
      setExportStatus("Sélection du fichier de sortie...");

      const outputPath = await save({
        defaultPath: "output.mp4",
        filters: [{
          name: "Vidéo MP4",
          extensions: ["mp4"]
        }]
      });

      if (!outputPath) {
        setIsExporting(false);
        setExportStatus("");
        return;
      }

      setExportStatus("Export en cours avec FFmpeg...");
      
      // Convertir l'URL du navigateur en chemin système
      const systemPath = currentVideoPath.replace(/^asset:\/\/localhost\//, "");
      const decodedPath = decodeURIComponent(systemPath);
      
      const result = await invoke<string>("export_project", {
        clips: [decodedPath],
        outputPath: outputPath,
        quality: "medium"
      });

      setExportStatus("✅ " + result);
      alert(result);
    } catch (error) {
      const errorMsg = `Erreur lors de l'export: ${error}`;
      setExportStatus("❌ " + errorMsg);
      alert(errorMsg);
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(""), 5000);
    }
  };

  return (
    <div className="controls">
      <div className="controls-group">
        <button onClick={handleOpenVideo} className="btn btn-primary">
          Charger vidéo
        </button>
        <button className="btn" disabled>
          Découper
        </button>
        <button className="btn" disabled>
          Fusionner
        </button>
        <button className="btn" disabled>
          Transition
        </button>
      </div>
      <div className="controls-group">
        {exportStatus && (
          <span className="export-status">{exportStatus}</span>
        )}
        <button 
          className="btn btn-success" 
          disabled={!ffmpegAvailable || !currentVideoPath || isExporting}
          onClick={handleExport}
        >
          {isExporting ? "Export..." : "Exporter MP4"}
        </button>
      </div>
    </div>
  );
}

export default Controls;
