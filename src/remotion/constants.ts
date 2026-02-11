export const FPS = 30;
export const COMP_WIDTH = 1920;
export const COMP_HEIGHT = 1080;

export function secondsToFrames(seconds: number): number {
  return Math.round(seconds * FPS);
}

export function framesToSeconds(frames: number): number {
  return frames / FPS;
}

export function formatTimecode(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.round((totalSeconds % 1) * FPS);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}
