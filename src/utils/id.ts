/**
 * Clip ID generation utility.
 * Produces unique identifiers for audio and video timeline clips.
 */

/**
 * Generate a unique clip identifier with the given prefix.
 * Format: `{prefix}_{timestamp}_{random5chars}`
 */
export function generateClipId(prefix: "audio" | "video"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}
