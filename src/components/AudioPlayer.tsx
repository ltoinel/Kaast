/**
 * AudioPlayer — Shared playback control bar for audio clips.
 *
 * Displays play/pause, a seek slider, time display, and the current clip name.
 * Used in both the Script and Scenes tabs.
 */
import { useCallback, memo } from "react";
import { formatTime } from "../utils/timecode";
import type { AudioClip } from "../types";
import type { PlaybackHandle } from "../hooks/usePlaybackSync";
import "./AudioPlayer.css";

interface AudioPlayerProps {
  audioClips: AudioClip[];
  currentTime: number;
  totalDuration: number;
  playback: PlaybackHandle;
}

function AudioPlayer({ audioClips, currentTime, totalDuration, playback }: AudioPlayerProps) {
  const handleSeekInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    playback.handleSeek(parseFloat(e.target.value));
  }, [playback]);

  if (audioClips.length === 0) return null;

  return (
    <div className="audio-player">
      <button
        className="audio-play-btn"
        onClick={playback.handlePlayPause}
        disabled={audioClips.length === 0}
        aria-label={playback.isPlaying ? "Pause" : "Play"}
      >
        {playback.isPlaying ? "\u23F8" : "\u25B6"}
      </button>
      <div className="audio-progress-wrapper">
        <input
          type="range"
          className="audio-progress"
          min="0"
          max={totalDuration || 0}
          step="0.1"
          value={currentTime}
          onChange={handleSeekInput}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={totalDuration || 0}
          aria-valuenow={currentTime}
        />
      </div>
      <span className="audio-time">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>
      <span className="audio-name">
        {audioClips[0]?.name}
      </span>
    </div>
  );
}

export default memo(AudioPlayer);
