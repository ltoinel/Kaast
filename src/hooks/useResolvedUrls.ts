/**
 * useResolvedUrls — Resolves local file paths to URLs consumable by the webview.
 *
 * Handles three categories of paths:
 * - Video thumbnails → Tauri asset protocol URLs
 * - Audio clip paths → streaming server URLs
 * - Video clip paths → streaming server URLs (prefers proxy when available)
 *
 * When all audio clips are removed the resolved map is reset so stale entries
 * don't linger.
 */
import { useState, useEffect } from "react";
import type { AudioClip, VideoClip } from "../types";
import { convertToAssetUrl, getStreamingUrl } from "../utils/tauri";

/**
 * Resolve file paths for audio clips, video clips, and thumbnails into
 * URLs the webview can consume (asset protocol or streaming server).
 */
export function useResolvedUrls(
  audioClips: AudioClip[],
  videoClips: VideoClip[],
): Record<string, string> {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Resolve thumbnail paths via Tauri asset protocol (instant)
  useEffect(() => {
    const thumbPaths = [...new Set(videoClips.map(c => c.thumbnail).filter(Boolean) as string[])];
    if (thumbPaths.length === 0) return;

    let cancelled = false;
    Promise.all(
      thumbPaths.map(async (p) => {
        try {
          const url = await convertToAssetUrl(p);
          return [p, url] as const;
        } catch {
          return [p, ""] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setResolvedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [videoClips]);

  // Resolve audio clip paths to streaming URLs
  useEffect(() => {
    const audioPaths = [...new Set(audioClips.map(c => c.path))];
    if (audioPaths.length === 0) {
      setResolvedUrls(prev => Object.keys(prev).length === 0 ? prev : {});
      return;
    }
    let cancelled = false;
    Promise.all(
      audioPaths.map(async (p) => {
        try {
          const url = await getStreamingUrl(p);
          return [p, url] as const;
        } catch {
          return [p, ""] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setResolvedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [audioClips]);

  // Resolve video clip paths to streaming URLs (using proxy when available)
  useEffect(() => {
    const videoPaths = [...new Set(videoClips.map(c => c.path))];
    if (videoPaths.length === 0) return;

    const proxyMap = new Map<string, string>();
    for (const c of videoClips) {
      if (c.proxyPath && !proxyMap.has(c.path)) {
        proxyMap.set(c.path, c.proxyPath);
      }
    }

    let cancelled = false;
    Promise.all(
      videoPaths.map(async (p) => {
        try {
          const fileToStream = proxyMap.get(p) || p;
          const url = await getStreamingUrl(fileToStream);
          return [p, url] as const;
        } catch {
          return [p, ""] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setResolvedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [videoClips]);

  return resolvedUrls;
}
