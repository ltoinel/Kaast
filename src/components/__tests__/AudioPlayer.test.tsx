import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AudioPlayer from "../AudioPlayer";
import type { AudioClip } from "../../types";
import type { PlaybackHandle } from "../../hooks/usePlaybackSync";

// Mock CSS import
vi.mock("../AudioPlayer.css", () => ({}));

afterEach(cleanup);

const mockClip: AudioClip = {
  id: "clip-1",
  name: "podcast_001.wav",
  path: "/project/audios/podcast_001.wav",
  duration: 120,
  startTime: 0,
};

function createMockPlayback(overrides?: Partial<PlaybackHandle>): PlaybackHandle {
  return {
    timeRef: { current: 0 },
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    handlePlayPause: vi.fn(),
    handleStop: vi.fn(),
    handleSeek: vi.fn(),
    handleNextFrame: vi.fn(),
    handlePrevFrame: vi.fn(),
    handleGoToEnd: vi.fn(),
    ...overrides,
  };
}

describe("AudioPlayer", () => {
  it("renders nothing when there are no audio clips", () => {
    const playback = createMockPlayback();
    const { container } = render(
      <AudioPlayer audioClips={[]} currentTime={0} totalDuration={0} playback={playback} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders play button and time display with audio clips", () => {
    const playback = createMockPlayback();
    const { getByText, getByRole } = render(
      <AudioPlayer audioClips={[mockClip]} currentTime={30} totalDuration={120} playback={playback} />
    );

    expect(getByRole("button")).toBeDefined();
    expect(getByText("podcast_001.wav")).toBeDefined();
    expect(getByText(/0:30/)).toBeDefined();
    expect(getByText(/2:00/)).toBeDefined();
  });

  it("shows pause icon when playing", () => {
    const playback = createMockPlayback({ isPlaying: true });
    const { getByRole } = render(
      <AudioPlayer audioClips={[mockClip]} currentTime={0} totalDuration={120} playback={playback} />
    );

    expect(getByRole("button").textContent).toBe("\u23F8");
  });

  it("shows play icon when paused", () => {
    const playback = createMockPlayback({ isPlaying: false });
    const { getByRole } = render(
      <AudioPlayer audioClips={[mockClip]} currentTime={0} totalDuration={120} playback={playback} />
    );

    expect(getByRole("button").textContent).toBe("\u25B6");
  });

  it("calls handlePlayPause when play button is clicked", async () => {
    const user = userEvent.setup();
    const playback = createMockPlayback();
    const { getByRole } = render(
      <AudioPlayer audioClips={[mockClip]} currentTime={0} totalDuration={120} playback={playback} />
    );

    await user.click(getByRole("button"));
    expect(playback.handlePlayPause).toHaveBeenCalledOnce();
  });

  it("calls handleSeek when slider value changes", () => {
    const playback = createMockPlayback();
    const { getByRole } = render(
      <AudioPlayer audioClips={[mockClip]} currentTime={0} totalDuration={120} playback={playback} />
    );

    const slider = getByRole("slider");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(slider, "60");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(playback.handleSeek).toHaveBeenCalledWith(60);
  });

  it("displays first clip name", () => {
    const clips: AudioClip[] = [
      mockClip,
      { ...mockClip, id: "clip-2", name: "second.wav" },
    ];
    const playback = createMockPlayback();
    const { getByText } = render(
      <AudioPlayer audioClips={clips} currentTime={0} totalDuration={120} playback={playback} />
    );

    expect(getByText("podcast_001.wav")).toBeDefined();
  });
});
