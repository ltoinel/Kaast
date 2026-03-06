import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimelineTrack from "../TimelineTrack";
import type { AudioClip, VideoClip } from "../../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "timeline.videoTrack": "Video",
        "timeline.audioTrack": "Audio",
        "timeline.dropVideos": "Drop videos here",
        "timeline.audioClipsAppear": "Audio clips appear here",
        "timeline.doubleClickToPlay": `Double-click to play ${opts?.name}`,
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("../Timeline.css", () => ({}));

afterEach(cleanup);

const mockAudioClip: AudioClip = {
  id: "audio-1",
  name: "podcast.wav",
  path: "/project/audios/podcast.wav",
  duration: 60,
  startTime: 0,
};

const mockVideoClip: VideoClip = {
  id: "video-1",
  name: "scene_001.mp4",
  path: "/project/videos/scene_001.mp4",
  duration: 10,
  startTime: 0,
  thumbnail: "/project/cache/scene_001.jpg",
};

const defaultProps = {
  type: "video" as const,
  clips: [] as VideoClip[],
  zoom: 50,
  effectiveDuration: 120,
  selectedClip: null,
  resolvedUrls: {},
  dragOverTrack: null,
  dragSnapX: null,
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDragLeave: vi.fn(),
  onDrop: vi.fn(),
  onClipClick: vi.fn(),
  onClipDoubleClick: vi.fn(),
};

describe("TimelineTrack", () => {
  it("shows empty message for video track with no clips", () => {
    const { getByText } = render(<TimelineTrack {...defaultProps} type="video" />);
    expect(getByText("Drop videos here")).toBeDefined();
  });

  it("shows empty message for audio track with no clips", () => {
    const { getByText } = render(<TimelineTrack {...defaultProps} type="audio" />);
    expect(getByText("Audio clips appear here")).toBeDefined();
  });

  it("renders video clip with name and duration", () => {
    const { getByText } = render(
      <TimelineTrack {...defaultProps} clips={[mockVideoClip]} />
    );
    expect(getByText("scene_001.mp4")).toBeDefined();
    expect(getByText("0:10")).toBeDefined();
  });

  it("renders audio clip with name", () => {
    const { getByText } = render(
      <TimelineTrack {...defaultProps} type="audio" clips={[mockAudioClip]} />
    );
    expect(getByText("podcast.wav")).toBeDefined();
  });

  it("highlights selected clip", () => {
    const { container } = render(
      <TimelineTrack {...defaultProps} clips={[mockVideoClip]} selectedClip="video-1" />
    );
    const clip = container.querySelector(".timeline-clip.selected");
    expect(clip).not.toBeNull();
  });

  it("does not highlight unselected clip", () => {
    const { container } = render(
      <TimelineTrack {...defaultProps} clips={[mockVideoClip]} selectedClip="other" />
    );
    const clip = container.querySelector(".timeline-clip.selected");
    expect(clip).toBeNull();
  });

  it("calls onClipClick when clip is clicked", async () => {
    const user = userEvent.setup();
    const onClipClick = vi.fn();
    const { getByText } = render(
      <TimelineTrack {...defaultProps} clips={[mockVideoClip]} onClipClick={onClipClick} />
    );

    await user.click(getByText("scene_001.mp4"));
    expect(onClipClick).toHaveBeenCalledWith("video-1", "video");
  });

  it("calls onClipDoubleClick on double click", async () => {
    const user = userEvent.setup();
    const onClipDoubleClick = vi.fn();
    const { getByText } = render(
      <TimelineTrack {...defaultProps} clips={[mockVideoClip]} onClipDoubleClick={onClipDoubleClick} />
    );

    await user.dblClick(getByText("scene_001.mp4"));
    expect(onClipDoubleClick).toHaveBeenCalledWith(mockVideoClip);
  });

  it("renders waveform bars for audio clips", () => {
    const waveformHeights = { "audio-1": [40, 60, 50, 70, 30] };
    const { container } = render(
      <TimelineTrack
        {...defaultProps}
        type="audio"
        clips={[mockAudioClip]}
        waveformHeights={waveformHeights}
      />
    );
    const bars = container.querySelectorAll(".waveform-bar");
    expect(bars.length).toBe(5);
  });

  it("renders thumbnail for video clip when URL is resolved", () => {
    const resolvedUrls = { "/project/cache/scene_001.jpg": "blob:http://localhost/thumb" };
    const { container } = render(
      <TimelineTrack {...defaultProps} clips={[mockVideoClip]} resolvedUrls={resolvedUrls} />
    );
    const img = container.querySelector("img.clip-thumbnail-video");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("blob:http://localhost/thumb");
  });

  it("shows drag-over state", () => {
    const { container } = render(
      <TimelineTrack {...defaultProps} dragOverTrack="video" dragSnapX={100} />
    );
    expect(container.querySelector(".track-content.drag-over")).not.toBeNull();
    expect(container.querySelector(".drop-snap-indicator")).not.toBeNull();
  });

  it("positions clip according to zoom and startTime", () => {
    const clip = { ...mockVideoClip, startTime: 5 };
    const { container } = render(
      <TimelineTrack {...defaultProps} clips={[clip]} zoom={50} />
    );
    const clipEl = container.querySelector(".timeline-clip") as HTMLElement;
    expect(clipEl.style.left).toBe("250px"); // 5 * 50
    expect(clipEl.style.width).toBe("500px"); // 10 * 50
  });
});
