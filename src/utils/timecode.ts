/**
 * Timecode formatting utilities for the timeline UI.
 */

/** Display frame rate used for timecode display (HH:MM:SS:FF). */
const DISPLAY_FPS = 30;

/** Format a duration in seconds as a timecode string (HH:MM:SS:FF). */
export function formatTimecode(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.round((totalSeconds % 1) * DISPLAY_FPS);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

/** Format a duration in seconds as a compact time string (M:SS). */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
