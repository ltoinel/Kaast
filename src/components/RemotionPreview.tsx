import { Player, type PlayerRef } from "@remotion/player";
import { PodcastComposition, type PodcastCompositionProps } from "../remotion/PodcastComposition";
import { FPS, COMP_WIDTH, COMP_HEIGHT } from "../remotion/constants";

interface RemotionPreviewProps {
  playerRef: React.RefObject<PlayerRef | null>;
  compositionProps: PodcastCompositionProps;
  durationInFrames: number;
}

const RemotionPreview: React.FC<RemotionPreviewProps> = ({
  playerRef,
  compositionProps,
  durationInFrames,
}) => {
  return (
    <Player
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={playerRef as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={PodcastComposition as any}
      inputProps={compositionProps}
      durationInFrames={durationInFrames}
      compositionWidth={COMP_WIDTH}
      compositionHeight={COMP_HEIGHT}
      fps={FPS}
      style={{ width: "100%", height: "100%" }}
      controls={false}
      clickToPlay={false}
      acknowledgeRemotionLicense
    />
  );
};

export default RemotionPreview;
