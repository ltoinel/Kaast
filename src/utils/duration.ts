/**
 * computeTotalDuration — Single source of truth for total timeline duration.
 *
 * Returns the end time of the last clip across both audio and video tracks,
 * or the given fallback when both arrays are empty.
 */

interface ClipTiming {
  readonly startTime: number;
  readonly duration: number;
}

/**
 * Compute the total duration covered by audio and video clips.
 *
 * @param audioClips  Audio clips with startTime + duration.
 * @param videoClips  Video clips with startTime + duration.
 * @param fallback    Value returned when both arrays are empty (default 0).
 */
export function computeTotalDuration(
  audioClips: ReadonlyArray<ClipTiming>,
  videoClips: ReadonlyArray<ClipTiming>,
  fallback = 0,
): number {
  let max = fallback;
  for (const c of audioClips) {
    const end = c.startTime + c.duration;
    if (end > max) max = end;
  }
  for (const c of videoClips) {
    const end = c.startTime + c.duration;
    if (end > max) max = end;
  }
  return max;
}
