import { useCallback } from "react";
import { convertToAssetUrl, safeInvoke } from "../utils/tauri";

interface MediaDurationResult {
  duration: number;
  width?: number;
  height?: number;
}

const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg", "flac"];

function probeWithElement(url: string, type: "video" | "audio"): Promise<MediaDurationResult> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(type);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const result: MediaDurationResult = { duration: el.duration };
      if (type === "video") {
        const video = el as HTMLVideoElement;
        result.width = video.videoWidth;
        result.height = video.videoHeight;
      }
      resolve(result);
    };
    el.onerror = () => reject(new Error(`Cannot load ${type} metadata`));
    el.src = url;
  });
}

export function useMediaDuration() {
  const probe = useCallback(async (filePath: string): Promise<MediaDurationResult> => {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const assetUrl = await convertToAssetUrl(filePath);

    // Try browser-native metadata probe
    try {
      if (VIDEO_EXTENSIONS.includes(ext)) {
        return await probeWithElement(assetUrl, "video");
      } else if (AUDIO_EXTENSIONS.includes(ext)) {
        return await probeWithElement(assetUrl, "audio");
      }
    } catch (err) {
      console.warn("Browser media probe failed, falling back to ffprobe:", err);
    }

    // Fallback: ffprobe via Rust command
    try {
      const infoJson = await safeInvoke<string>("get_video_info", { videoPath: filePath });
      const info = JSON.parse(infoJson);
      const durationStr = info?.format?.duration;
      if (durationStr) {
        return { duration: parseFloat(durationStr) };
      }
    } catch (err) {
      console.error("ffprobe fallback failed:", err);
    }

    return { duration: 30 };
  }, []);

  return { probe };
}
