import { Audio } from "remotion";

interface AudioClipSequenceProps {
  src: string;
  volume?: number;
}

const AudioClipSequence: React.FC<AudioClipSequenceProps> = ({
  src,
  volume = 1,
}) => {
  return <Audio src={src} volume={volume} />;
};

export default AudioClipSequence;
