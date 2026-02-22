/**
 * useThumbnailLoader — Lazy-loads scene thumbnails as cards scroll into view.
 *
 * Uses an IntersectionObserver with a 200 px root margin so images start
 * loading just before the user scrolls to them. The functional-setState
 * pattern avoids the stale-closure bug present in the original inline version.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { loadFileAsDataUri } from "../utils/tauri";

export interface ThumbnailLoader {
  /** Map of sceneId → data-URI (or empty string on failure). */
  thumbnailUrls: Record<string, string>;
  /**
   * Ref callback: attach to a scene card element that carries
   * `data-scene-id` and `data-thumb-path` attributes.
   */
  observeCard: (el: HTMLDivElement | null) => void;
}

/**
 * Provide lazy thumbnail loading driven by IntersectionObserver.
 *
 * @returns An object with the current thumbnail URL map and an `observeCard` ref callback.
 */
export function useThumbnailLoader(): ThumbnailLoader {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  /** Load a single thumbnail and store its data-URI. */
  const loadThumbnail = useCallback(async (sceneId: string, thumbnailPath: string) => {
    // Use functional setState to avoid stale-closure reads
    setThumbnailUrls((prev) => {
      if (prev[sceneId] !== undefined) return prev; // already loaded or loading
      // Mark as loading with a sentinel so concurrent calls are ignored
      return { ...prev, [sceneId]: "" };
    });

    try {
      const dataUri = await loadFileAsDataUri(thumbnailPath);
      setThumbnailUrls((prev) => ({ ...prev, [sceneId]: dataUri }));
    } catch {
      // Keep the empty-string sentinel — no thumbnail available
    }
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const sceneId = el.dataset.sceneId;
            const thumbPath = el.dataset.thumbPath;
            if (sceneId && thumbPath) {
              loadThumbnail(sceneId, thumbPath);
              observerRef.current?.unobserve(el);
            }
          }
        });
      },
      { rootMargin: "200px" },
    );
    return () => { observerRef.current?.disconnect(); };
  }, [loadThumbnail]);

  /** Ref callback to start observing a scene card element. */
  const observeCard = useCallback((el: HTMLDivElement | null) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }, []);

  return { thumbnailUrls, observeCard };
}
