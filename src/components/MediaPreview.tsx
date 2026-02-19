/**
 * MediaPreview — Native HTML5 video + audio preview player.
 * Sole controller of all <video> and <audio> DOM elements.
 *
 * Uses double-buffered video: two <video> elements, one active (visible)
 * and one preloading the next clip (hidden). When transitioning between
 * clips, the preloaded element is swapped in instantly — no freeze.
 *
 * During playback it runs its own requestAnimationFrame loop that reads
 * `playback.timeRef.current` (the precise master clock) to sync media
 * elements.  This avoids the cost of React re-renders on every frame.
 */
import { useEffect, useRef, useCallback, memo } from "react";
import type { AudioClip, VideoClip } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";

interface MediaPreviewProps {
  audioClips: AudioClip[];
  videoClips: VideoClip[];
  resolvedUrls: Record<string, string>;
  playback: PlaybackHandle;
  /** When true the component renders only audio (no visible video). */
  audioOnly?: boolean;
  /** When true the component renders only video (no audio elements). */
  videoOnly?: boolean;
}

/** Maximum drift (in seconds) before we force-correct a video element's currentTime. */
const VIDEO_DRIFT_THRESHOLD = 0.3;

/** Audio drift below this value is considered in sync — playbackRate stays at 1.0. */
const AUDIO_SYNC_TOLERANCE = 0.08;

/** Audio drift above this value triggers a hard seek (e.g. after manual seek or clip change). */
const AUDIO_HARD_SEEK_THRESHOLD = 1.0;

/**
 * Maximum playback rate adjustment for gradual audio drift correction (±5%).
 * Instead of seeking (which causes audible glitches), we slightly speed up
 * or slow down the audio to smoothly catch up with the master clock.
 * The actual correction is proportional to drift magnitude.
 */
const AUDIO_MAX_RATE_CORRECTION = 0.05;

/** Minimum readyState to allow seeking (HAVE_METADATA). */
const READY_FOR_SEEK = 1;

/** Minimum readyState to consider the preload element ready for swap (HAVE_FUTURE_DATA). */
const READY_FOR_SWAP = 3;

/** Seconds before the end of a clip to start preloading the next one. */
const PRELOAD_AHEAD_SEC = 3;

/** Minimum buffered data ahead of seek target (seconds) before allowing a forced seek. */
const MIN_BUFFER_AHEAD = 0.3;

/** Shared video element styles (absolute-positioned for double-buffering). */
const VIDEO_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  background: "#000",
};

/** Check if a media element has buffered data covering [time, time + minAhead]. */
function hasBufferAt(el: HTMLMediaElement, time: number, minAhead: number = MIN_BUFFER_AHEAD): boolean {
  for (let i = 0; i < el.buffered.length; i++) {
    if (time >= el.buffered.start(i) && time + minAhead <= el.buffered.end(i)) {
      return true;
    }
  }
  return false;
}

/** Find the video clip visible at a given point in time. */
function findActiveVideoClip(videoClips: VideoClip[], time: number): VideoClip | null {
  for (const clip of videoClips) {
    if (time >= clip.startTime && time < clip.startTime + clip.duration) {
      return clip;
    }
  }
  return null;
}

/** Find the next video clip on the timeline after the given clip. */
function findNextVideoClip(videoClips: VideoClip[], current: VideoClip): VideoClip | null {
  const endTime = current.startTime + current.duration;
  let best: VideoClip | null = null;
  for (const clip of videoClips) {
    if (clip.startTime >= endTime && (!best || clip.startTime < best.startTime)) {
      best = clip;
    }
  }
  return best;
}

/**
 * Memoised audio element that never re-renders after mount.
 * Uses a stable `onRef` callback so the parent's audioRefs Map stays consistent
 * across React commits (no null→el flicker from inline ref callbacks).
 */
const AudioElement = memo(({ clipId, onRef }: {
  clipId: string;
  onRef: (id: string, el: HTMLAudioElement | null) => void;
}) => (
  <audio ref={(el) => onRef(clipId, el)} preload="auto" />
));

function MediaPreview({ audioClips, videoClips, resolvedUrls, playback, audioOnly, videoOnly }: MediaPreviewProps) {
  // ── Double-buffered video refs ──────────────────────────────────
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  /** Which slot ('A' or 'B') is currently the visible active element. */
  const activeSlotRef = useRef<"A" | "B">("A");
  /** The streaming URL currently shown on the active element. */
  const activeSrcRef = useRef("");
  /** The streaming URL loaded on the preloading (hidden) element. */
  const preloadSrcRef = useRef("");
  /** True while the active video is loading a new source. */
  const videoLoadingRef = useRef(false);

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const syncRafRef = useRef(0);

  /** Stable callback for AudioElement refs — avoids ref churn on re-renders. */
  const setAudioRef = useCallback((id: string, el: HTMLAudioElement | null) => {
    if (el) audioRefs.current.set(id, el);
    else audioRefs.current.delete(id);
  }, []);

  // ── Refs for latest props (avoids stale closures in rAF loop) ──
  const videoClipsRef = useRef(videoClips);
  const audioClipsRef = useRef(audioClips);
  const resolvedUrlsRef = useRef(resolvedUrls);
  const volumeRef = useRef(playback.volume);
  const isPlayingRef = useRef(playback.isPlaying);

  videoClipsRef.current = videoClips;
  audioClipsRef.current = audioClips;
  resolvedUrlsRef.current = resolvedUrls;
  volumeRef.current = playback.volume;
  isPlayingRef.current = playback.isPlaying;

  // ── Helpers to get active / preload video element ───────────────
  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    return activeSlotRef.current === "A" ? videoARef.current : videoBRef.current;
  }, []);

  const getPreloadVideo = useCallback((): HTMLVideoElement | null => {
    return activeSlotRef.current === "A" ? videoBRef.current : videoARef.current;
  }, []);

  /** Swap active and preload slots (imperatively update DOM visibility). */
  const swapSlots = useCallback(() => {
    activeSlotRef.current = activeSlotRef.current === "A" ? "B" : "A";
    const a = videoARef.current;
    const b = videoBRef.current;
    if (a) a.style.visibility = activeSlotRef.current === "A" ? "visible" : "hidden";
    if (b) b.style.visibility = activeSlotRef.current === "B" ? "visible" : "hidden";
  }, []);

  // ── Video event handlers ────────────────────────────────────────
  const onVideoCanPlay = useCallback((e: Event) => {
    const video = e.target as HTMLVideoElement;
    const isActive = video === getActiveVideo();
    if (isActive) {
      videoLoadingRef.current = false;
      video.volume = volumeRef.current;
      if (isPlayingRef.current && video.paused) {
        video.play().catch(() => {});
      }
    }
  }, [getActiveVideo]);

  const onVideoError = useCallback((e: Event) => {
    const video = e.target as HTMLVideoElement;
    if (video === getActiveVideo()) {
      videoLoadingRef.current = false;
    }
    console.error("Video element error:", (video as HTMLVideoElement).error?.message);
  }, [getActiveVideo]);

  // Attach event listeners on both video elements
  useEffect(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    const elements = [a, b].filter(Boolean) as HTMLVideoElement[];
    for (const el of elements) {
      el.addEventListener("canplay", onVideoCanPlay);
      el.addEventListener("error", onVideoError);
    }
    return () => {
      for (const el of elements) {
        el.removeEventListener("canplay", onVideoCanPlay);
        el.removeEventListener("error", onVideoError);
      }
    };
  }, [onVideoCanPlay, onVideoError]);

  // ── Imperative sync: video ─────────────────────────────────────
  const syncVideo = useCallback(() => {
    if (audioOnly) return;
    const active = getActiveVideo();
    if (!active) return;
    const clips = videoClipsRef.current;
    const urls = resolvedUrlsRef.current;
    if (clips.length === 0) return;

    const t = playback.timeRef.current;
    const currentClip = findActiveVideoClip(clips, t);
    const src = currentClip ? urls[currentClip.path] ?? "" : "";

    // ── Source changed → switch clip ──────────────────────────────
    if (src !== activeSrcRef.current) {
      const preload = getPreloadVideo();

      // If the preload element already has the right source and is ready → swap
      if (preload && src && src === preloadSrcRef.current && preload.readyState >= READY_FOR_SWAP) {
        // Pause old active element
        if (!active.paused) active.pause();

        // Swap visibility
        swapSlots();
        activeSrcRef.current = src;
        preloadSrcRef.current = "";

        // Seek preloaded element to the correct offset and play
        const newActive = getActiveVideo()!;
        const offset = t - (currentClip?.startTime ?? 0);
        newActive.currentTime = offset;
        newActive.volume = volumeRef.current;
        videoLoadingRef.current = false;
        if (isPlayingRef.current) newActive.play().catch(() => {});
      } else {
        // Fallback: load on the current active element
        activeSrcRef.current = src;
        if (src) {
          videoLoadingRef.current = true;
          active.src = src;
          active.load();
        } else {
          videoLoadingRef.current = false;
          active.removeAttribute("src");
          active.load();
        }
      }
      return;
    }

    // While loading a new source, skip drift correction
    if (videoLoadingRef.current) return;

    // ── Same source — correct drift (buffer-aware) ────────────────
    if (!src || !currentClip) return;
    if (active.readyState < READY_FOR_SEEK) return;

    const offset = t - currentClip.startTime;
    if (Math.abs(active.currentTime - offset) > VIDEO_DRIFT_THRESHOLD) {
      // Only seek if the target position is buffered to avoid micro-freeze
      if (hasBufferAt(active, offset)) {
        active.currentTime = offset;
      }
    }
    if (active.volume !== volumeRef.current) active.volume = volumeRef.current;

    // ── Preload next clip when approaching end ────────────────────
    const timeLeft = (currentClip.startTime + currentClip.duration) - t;
    if (timeLeft < PRELOAD_AHEAD_SEC && timeLeft > 0) {
      const nextClip = findNextVideoClip(clips, currentClip);
      const nextSrc = nextClip ? urls[nextClip.path] ?? "" : "";
      if (nextSrc && nextSrc !== preloadSrcRef.current && nextSrc !== activeSrcRef.current) {
        const preload = getPreloadVideo();
        if (preload) {
          preloadSrcRef.current = nextSrc;
          preload.src = nextSrc;
          preload.load();
        }
      }
    }
  }, [audioOnly, playback.timeRef, getActiveVideo, getPreloadVideo, swapSlots]);

  // ── Imperative sync: audio ─────────────────────────────────────
  const syncAudio = useCallback(() => {
    if (videoOnly) return;
    const clips = audioClipsRef.current;
    const t = playback.timeRef.current;
    const playing = isPlayingRef.current;

    for (const clip of clips) {
      const el = audioRefs.current.get(clip.id);
      if (!el) continue;
      if (!el.src || el.src === "about:blank" || el.src === window.location.href) continue;

      const inRange = t >= clip.startTime && t < clip.startTime + clip.duration;
      if (inRange) {
        const offset = t - clip.startTime;
        const drift = el.currentTime - offset;
        const absDrift = Math.abs(drift);

        // Compute target playback rate based on drift magnitude
        let targetRate = 1.0;
        if (absDrift > AUDIO_HARD_SEEK_THRESHOLD) {
          // Large drift (manual seek or clip change) — hard seek required
          if (hasBufferAt(el, offset)) {
            el.currentTime = offset;
          }
        } else if (absDrift > AUDIO_SYNC_TOLERANCE) {
          // Proportional drift correction — gradually adjust playback rate.
          // The correction scales linearly with drift: small drift → tiny correction
          // (imperceptible), large drift → up to ±AUDIO_MAX_RATE_CORRECTION.
          // drift > 0 → audio is ahead → slow down; drift < 0 → audio is behind → speed up
          const correction = Math.min(absDrift / AUDIO_HARD_SEEK_THRESHOLD, 1) * AUDIO_MAX_RATE_CORRECTION;
          targetRate = drift > 0 ? 1.0 - correction : 1.0 + correction;
        }

        // Only touch playbackRate when it actually changes (avoids browser overhead)
        if (el.playbackRate !== targetRate) el.playbackRate = targetRate;
        if (el.volume !== volumeRef.current) el.volume = volumeRef.current;
        if (playing && el.paused) el.play().catch(() => {});
        if (!playing && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
        if (el.playbackRate !== 1.0) el.playbackRate = 1.0;
      }
    }
  }, [videoOnly, playback.timeRef]);

  // ── Assign audio src when URLs or clips change (not in 60fps loop) ──
  useEffect(() => {
    if (videoOnly) return;
    const urls = resolvedUrlsRef.current;
    for (const clip of audioClipsRef.current) {
      const el = audioRefs.current.get(clip.id);
      const src = urls[clip.path];
      if (el && src && (!el.src || el.src === "about:blank" || el.src === window.location.href)) {
        el.src = src;
      }
    }
  }, [videoOnly, resolvedUrls, audioClips]);

  // ── rAF sync loop: runs ONLY while playing ────────────────────
  useEffect(() => {
    if (!playback.isPlaying) {
      // Stopped → one final sync pass so elements stop at the right position
      syncVideo();
      if (!videoOnly) syncAudio();
      // Pause all media
      const active = getActiveVideo();
      if (active && !active.paused) active.pause();
      if (!videoOnly) audioRefs.current.forEach((el) => { if (!el.paused) el.pause(); });
      return;
    }

    // Start playing: kick video if ready
    const active = getActiveVideo();
    if (active && activeSrcRef.current && !videoLoadingRef.current && active.paused) {
      active.play().catch(() => {});
    }
    if (!videoOnly) syncAudio();

    const syncLoop = () => {
      syncVideo();
      if (!videoOnly) syncAudio();
      syncRafRef.current = requestAnimationFrame(syncLoop);
    };
    syncRafRef.current = requestAnimationFrame(syncLoop);

    return () => { cancelAnimationFrame(syncRafRef.current); };
  }, [playback.isPlaying, videoOnly, syncVideo, syncAudio, getActiveVideo]);

  // ── Sync once when resolvedUrls or clips change (initial load) ─
  useEffect(() => {
    syncVideo();
    if (!videoOnly) syncAudio();
  }, [resolvedUrls, videoClips, audioClips, videoOnly, syncVideo, syncAudio]);

  return (
    <>
      {!audioOnly && (
        <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
          <video
            ref={videoARef}
            style={{ ...VIDEO_STYLE, visibility: "visible" }}
            playsInline
            preload="auto"
          />
          <video
            ref={videoBRef}
            style={{ ...VIDEO_STYLE, visibility: "hidden" }}
            playsInline
            preload="auto"
          />
        </div>
      )}

      {!videoOnly && audioClips.map((clip) => (
        <AudioElement key={clip.id} clipId={clip.id} onRef={setAudioRef} />
      ))}
    </>
  );
}

export default memo(MediaPreview);
