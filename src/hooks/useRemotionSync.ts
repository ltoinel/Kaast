import { useCallback, useRef, useEffect, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { secondsToFrames, framesToSeconds } from "../remotion/constants";

interface UseRemotionSyncOptions {
  totalDuration: number;
  volume: number;
}

export function useRemotionSync({ totalDuration, volume }: UseRemotionSyncOptions) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Force re-run of effect when player mounts
  const [playerReady, setPlayerReady] = useState(false);

  const durationInFrames = Math.max(1, secondsToFrames(totalDuration));

  // Detect when the player ref becomes available
  useEffect(() => {
    const check = setInterval(() => {
      if (playerRef.current && !playerReady) {
        setPlayerReady(true);
        clearInterval(check);
      }
    }, 100);
    return () => clearInterval(check);
  }, [playerReady]);

  // Attach event listeners once the player is ready
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentTime(framesToSeconds(e.detail.frame));
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player.addEventListener("frameupdate", onFrameUpdate as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player.addEventListener("play", onPlay as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player.addEventListener("pause", onPause as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player.addEventListener("ended", onEnded as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.removeEventListener("frameupdate", onFrameUpdate as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.removeEventListener("play", onPlay as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.removeEventListener("pause", onPause as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.removeEventListener("ended", onEnded as any);
    };
  }, [playerReady]);

  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume, playerReady]);

  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    player.seekTo(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback((timeInSeconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    const frame = secondsToFrames(timeInSeconds);
    player.seekTo(frame);
    setCurrentTime(timeInSeconds);
  }, []);

  const handleNextFrame = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const currentFrame = secondsToFrames(currentTime);
    const nextFrame = Math.min(currentFrame + 1, durationInFrames - 1);
    player.seekTo(nextFrame);
    setCurrentTime(framesToSeconds(nextFrame));
  }, [currentTime, durationInFrames]);

  const handlePrevFrame = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const currentFrame = secondsToFrames(currentTime);
    const prevFrame = Math.max(currentFrame - 1, 0);
    player.seekTo(prevFrame);
    setCurrentTime(framesToSeconds(prevFrame));
  }, [currentTime]);

  const handleGoToEnd = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const lastFrame = durationInFrames - 1;
    player.seekTo(lastFrame);
    setCurrentTime(framesToSeconds(lastFrame));
  }, [durationInFrames]);

  return {
    playerRef,
    currentTime,
    isPlaying,
    durationInFrames,
    handlePlayPause,
    handleStop,
    handleSeek,
    handleNextFrame,
    handlePrevFrame,
    handleGoToEnd,
  };
}
