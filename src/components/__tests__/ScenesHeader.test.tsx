import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScenesHeader from "../ScenesHeader";
import type { VideoScene } from "../../types";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "app.scenes": "Scenes",
        "scenes.count": `${opts?.count} scenes`,
        "scenes.maxDuration": "Max duration",
        "scenes.generateScenes": "Generate Scenes",
        "scenes.analyzing": "Analyzing...",
        "scenes.feed": "Feed",
        "scenes.feeding": `Feeding ${opts?.current}/${opts?.total}`,
        "scenes.produce": "Produce",
      };
      return translations[key] || key;
    },
  }),
}));

afterEach(cleanup);

const mockScene: VideoScene = {
  id: "scene-1",
  description: "A sunset over the ocean",
  duration: 10,
  scriptExcerpt: "The sun sets...",
};

const mockSceneWithVideo: VideoScene = {
  ...mockScene,
  id: "scene-2",
  videoPath: "/project/videos/scene_001.mp4",
};

const defaultProps = {
  scenes: [] as VideoScene[],
  script: "",
  isGenerating: false,
  isProducing: false,
  produceProgress: 0,
  produceTotal: 0,
  maxSceneDuration: 10,
  totalScenesDuration: 0,
  onMaxSceneDurationChange: vi.fn(),
  onGenerate: vi.fn(),
  onFeed: vi.fn(),
  onProduce: vi.fn(),
};

describe("ScenesHeader", () => {
  it("renders the title", () => {
    const { getByText } = render(<ScenesHeader {...defaultProps} />);
    expect(getByText("Scenes")).toBeDefined();
  });

  it("disables Generate button when no script", () => {
    const { getByText } = render(<ScenesHeader {...defaultProps} script="" />);
    const btn = getByText("Generate Scenes").closest("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("enables Generate button when script is present", () => {
    const { getByText } = render(<ScenesHeader {...defaultProps} script="Hello world" />);
    const btn = getByText("Generate Scenes").closest("button")!;
    expect(btn.disabled).toBe(false);
  });

  it("shows generating state", () => {
    const { getByText } = render(<ScenesHeader {...defaultProps} script="Hello" isGenerating={true} />);
    expect(getByText("Analyzing...")).toBeDefined();
  });

  it("calls onGenerate when Generate button is clicked", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    const { getByText } = render(<ScenesHeader {...defaultProps} script="Hello world" onGenerate={onGenerate} />);

    await user.click(getByText("Generate Scenes").closest("button")!);
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("does not show Feed button when no scenes", () => {
    const { queryByText } = render(<ScenesHeader {...defaultProps} />);
    expect(queryByText("Feed")).toBeNull();
  });

  it("shows Feed button when scenes exist", () => {
    const { getByText } = render(<ScenesHeader {...defaultProps} scenes={[mockScene]} />);
    expect(getByText("Feed")).toBeDefined();
  });

  it("shows feeding progress", () => {
    const { getByText } = render(
      <ScenesHeader
        {...defaultProps}
        scenes={[mockScene]}
        isProducing={true}
        produceProgress={2}
        produceTotal={5}
      />
    );
    expect(getByText("Feeding 2/5")).toBeDefined();
  });

  it("does not show Produce button when no scenes have video", () => {
    const { queryByText } = render(<ScenesHeader {...defaultProps} scenes={[mockScene]} />);
    expect(queryByText("Produce")).toBeNull();
  });

  it("shows Produce button when scenes have video", () => {
    const { getByText } = render(<ScenesHeader {...defaultProps} scenes={[mockSceneWithVideo]} />);
    expect(getByText("Produce")).toBeDefined();
  });

  it("calls onProduce when Produce button is clicked", async () => {
    const user = userEvent.setup();
    const onProduce = vi.fn();
    const { getByText } = render(<ScenesHeader {...defaultProps} scenes={[mockSceneWithVideo]} onProduce={onProduce} />);

    await user.click(getByText("Produce").closest("button")!);
    expect(onProduce).toHaveBeenCalledOnce();
  });

  it("shows scene count when scenes exist", () => {
    const { getByText } = render(
      <ScenesHeader
        {...defaultProps}
        scenes={[mockScene, mockSceneWithVideo]}
        totalScenesDuration={20}
      />
    );
    expect(getByText(/2 scenes/)).toBeDefined();
  });

  it("calls onMaxSceneDurationChange when input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { getByRole } = render(<ScenesHeader {...defaultProps} onMaxSceneDurationChange={onChange} />);

    const input = getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "15");
    expect(onChange).toHaveBeenCalled();
  });
});
