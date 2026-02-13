/**
 * usePlaybackSync — Master clock for media playback.
 *
 * Two time sources:
 * - `timeRef`     (MutableRefObject) — updated on every rAF tick, used by
 *                  MediaPreview for frame-accurate media synchronisation.
 * - `currentTime` (React state)      — updated ~15 fps, used by UI components
 *                  (timecode display, timeline playhead) to avoid 60 fps
 *                  re-renders of the whole component tree.
 */
import { useCallback, useRef, useState, useEffect } from "react";

/** Step size (in seconds) used for single-frame advance / rewind. */
const FRAME_STEP = 1 / 30;

/** Minimum interval (ms) between React state updates for currentTime. */
const UI_THROTTLE_MS = 66; // ~15 fps

interface UsePlaybackSyncOptions {
  totalDuration: number;
  volume: number;
  /** When false the clock auto-pauses (e.g. tab hidden). Defaults to true. */
  isActive?: boolean;
}

export interface PlaybackHandle {
  /** Precise time ref — read this for media sync (no re-render). */
  timeRef: React.MutableRefObject<number>;
  /** Throttled time for UI display (~15 fps re-renders). */
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  handlePlayPause: () => void;
  handleStop: () => void;
  handleSeek: (timeInSeconds: number) => void;
  handleNextFrame: () => void;
  handlePrevFrame: () => void;
  handleGoToEnd: () => void;
}

export function usePlaybackSync({ totalDuration, volume, isActive = true }: UsePlaybackSyncOptions): PlaybackHandle {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const timeRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const playingRef = useRef(false);
  const lastUiUpdateRef = useRef(0);

  const stopClock = useCallback(() => {
    playingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = 0;
    setIsPlaying(false);
    // Final sync so the UI shows the exact stop position
    setCurrentTime(timeRef.current);
  }, []);

  const tick = useCallback((ts: number) => {
    if (!playingRef.current) return;

    const delta = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
    lastTsRef.current = ts;

    timeRef.current = Math.min(timeRef.current + delta, totalDuration);

    // Throttle React state updates for the UI
    if (ts - lastUiUpdateRef.current >= UI_THROTTLE_MS) {
      lastUiUpdateRef.current = ts;
      setCurrentTime(timeRef.current);
    }

    if (timeRef.current >= totalDuration) {
      stopClock();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [totalDuration, stopClock]);

  const startClock = useCallback(() => {
    playingRef.current = true;
    lastTsRef.current = 0;
    lastUiUpdateRef.current = 0;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const seekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, totalDuration));
    timeRef.current = clamped;
    setCurrentTime(clamped);
  }, [totalDuration]);

  const handlePlayPause = useCallback(() => {
    if (playingRef.current) stopClock(); else startClock();
  }, [startClock, stopClock]);

  const handleStop = useCallback(() => {
    stopClock();
    seekTo(0);
  }, [stopClock, seekTo]);

  const handleSeek = useCallback((t: number) => seekTo(t), [seekTo]);

  const handleNextFrame = useCallback(() => {
    seekTo(Math.min(timeRef.current + FRAME_STEP, totalDuration));
  }, [seekTo, totalDuration]);

  const handlePrevFrame = useCallback(() => {
    seekTo(Math.max(timeRef.current - FRAME_STEP, 0));
  }, [seekTo]);

  const handleGoToEnd = useCallback(() => seekTo(totalDuration), [seekTo, totalDuration]);

  // Auto-pause when the tab becomes inactive (e.g. hidden by CSS display:none)
  useEffect(() => {
    if (!isActive && playingRef.current) {
      stopClock();
    }
  }, [isActive, stopClock]);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  return {
    timeRef,
    currentTime,
    isPlaying,
    volume,
    handlePlayPause,
    handleStop,
    handleSeek,
    handleNextFrame,
    handlePrevFrame,
    handleGoToEnd,
  };
}
