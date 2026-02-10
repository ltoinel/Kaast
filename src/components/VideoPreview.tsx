import { useEffect, useRef } from "react";
import "./VideoPreview.css";

interface VideoPreviewProps {
  videoPath: string;
}

function VideoPreview({ videoPath }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoPath) {
      videoRef.current.src = videoPath;
    }
  }, [videoPath]);

  return (
    <div className="video-preview">
      <div className="video-container">
        {videoPath ? (
          <video ref={videoRef} controls className="video-player">
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        ) : (
          <div className="video-placeholder">
            <p>Aucune vidéo sélectionnée</p>
            <p className="hint">Cliquez sur "Charger vidéo" pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoPreview;
