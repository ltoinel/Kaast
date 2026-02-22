/**
 * VideoModal — Full-screen backdrop with a video player for scene preview.
 */
import { memo } from "react";
import "./VideoModal.css";

interface VideoModalProps {
  videoUrl: string;
  onClose: () => void;
}

function VideoModal({ videoUrl, onClose }: VideoModalProps) {
  return (
    <div className="scene-modal-backdrop" onClick={onClose}>
      <div className="scene-modal" onClick={(e) => e.stopPropagation()}>
        <video
          className="scene-modal-video"
          src={videoUrl}
          controls
          autoPlay
        />
        <button className="scene-modal-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

export default memo(VideoModal);
