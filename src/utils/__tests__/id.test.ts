import { describe, it, expect } from "vitest";
import { generateClipId } from "../id";

describe("generateClipId", () => {
  it("returns a string starting with the given prefix", () => {
    expect(generateClipId("audio")).toMatch(/^audio_/);
    expect(generateClipId("video")).toMatch(/^video_/);
  });

  it("matches the expected format: prefix_timestamp_random", () => {
    const id = generateClipId("audio");
    expect(id).toMatch(/^audio_\d+_[a-z0-9]{1,5}$/);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateClipId("video")));
    expect(ids.size).toBe(50);
  });
});
