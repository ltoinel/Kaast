/**
 * usePlaybackSync — Master clock for media playback.
 *
 * The PlaybackHandle is intentionally **stable during playback** (its reference
 * only changes on play/pause, seek, stop, or volume change).  This prevents
 * cascading re-renders from the App component down to heavy children like
 * MediaPreview.
 *
 * UI components that need a frequently-updating display time (progress bar,
 * timecode, timeline playhead) should use the companion `usePlaybackTime` hook
 * which runs its own lightweight rAF loop (~15 fps) scoped to the consuming
 * component.
 */
import { useCallback, useRef, useState, useEffect, useMemo } from "react";

/** Step size (in seconds) used for single-frame advance / rewind. */
const FRAME_STEP = 1 / 30;

/** Minimum interval (ms) between React state updates for usePlaybackTime. */
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
  /**
   * Snapshot of the current time, updated only on seek / stop.
   * For smooth ~15 fps UI updates during playback, use the
   * `usePlaybackTime` hook instead.
   */
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

    if (timeRef.current >= totalDuration) {
      stopClock();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [totalDuration, stopClock]);

  const startClock = useCallback(() => {
    playingRef.current = true;
    lastTsRef.current = 0;
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

  return useMemo<PlaybackHandle>(() => ({
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
  }), [currentTime, isPlaying, volume, handlePlayPause, handleStop, handleSeek, handleNextFrame, handlePrevFrame, handleGoToEnd]);
}

/**
 * usePlaybackTime — Provides a smooth ~15 fps display time for UI components.
 *
 * Runs its own lightweight rAF loop scoped to the consuming component,
 * so only the component calling this hook re-renders at ~15 fps — not the
 * entire tree.
 *
 * @param playback  The stable PlaybackHandle from usePlaybackSync.
 * @param isActive  When false (e.g. tab is hidden), the rAF loop is paused
 *                  to avoid unnecessary work.  Defaults to true.
 */
export function usePlaybackTime(playback: PlaybackHandle, isActive: boolean = true): number {
  const [displayTime, setDisplayTime] = useState(playback.currentTime);

  // Sync when the handle's currentTime changes (seek / stop events)
  useEffect(() => {
    setDisplayTime(playback.currentTime);
  }, [playback.currentTime]);

  // During playback, run a local rAF loop for smooth UI updates
  useEffect(() => {
    if (!playback.isPlaying || !isActive) return;

    let rafId = 0;
    let lastUpdate = 0;
    const update = (ts: number) => {
      if (ts - lastUpdate >= UI_THROTTLE_MS) {
        lastUpdate = ts;
        setDisplayTime(playback.timeRef.current);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(rafId); };
  }, [playback.timeRef, playback.isPlaying, isActive]);

  return displayTime;
}
