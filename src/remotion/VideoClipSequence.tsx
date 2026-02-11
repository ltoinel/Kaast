import { Video, AbsoluteFill } from "remotion";

interface VideoClipSequenceProps {
  src: string;
}

const VideoClipSequence: React.FC<VideoClipSequenceProps> = ({ src }) => {
  return (
    <AbsoluteFill>
      <Video
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </AbsoluteFill>
  );
};

export default VideoClipSequence;
