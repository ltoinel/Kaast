import { AbsoluteFill, Audio, Sequence } from "remotion";
import type { AudioClip, VideoClip } from "../types";
import { secondsToFrames } from "./constants";
import VideoClipSequence from "./VideoClipSequence";

export interface PodcastCompositionProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  resolvedUrls: Record<string, string>;
}

export const PodcastComposition: React.FC<PodcastCompositionProps> = ({
  audioClips,
  videoClips,
  resolvedUrls,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Video layer */}
      {videoClips.map((clip) => {
        const fromFrame = secondsToFrames(clip.startTime);
        const durationInFrames = secondsToFrames(clip.duration);
        const src = resolvedUrls[clip.path];
        if (!src || durationInFrames <= 0) return null;

        return (
          <Sequence
            key={clip.id}
            from={fromFrame}
            durationInFrames={durationInFrames}
            name={clip.name}
          >
            <VideoClipSequence src={src} />
          </Sequence>
        );
      })}

      {/* Audio layer */}
      {audioClips.map((clip) => {
        const fromFrame = secondsToFrames(clip.startTime);
        const durationInFrames = secondsToFrames(clip.duration);
        const src = resolvedUrls[clip.path];
        if (!src || durationInFrames <= 0) return null;

        return (
          <Sequence
            key={clip.id}
            from={fromFrame}
            durationInFrames={durationInFrames}
            name={clip.name}
          >
            <Audio src={src} />
          </Sequence>
        );
      })}

      {/* Placeholder when no video */}
      {videoClips.length === 0 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            fontSize: 24,
            fontFamily: "sans-serif",
          }}
        >
          {audioClips.length > 0 ? "\u266B" : ""}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
