import { describe, it, expect } from "vitest";
import { computeTotalDuration } from "../duration";

describe("computeTotalDuration", () => {
  it("returns fallback when both arrays are empty", () => {
    expect(computeTotalDuration([], [])).toBe(0);
    expect(computeTotalDuration([], [], 42)).toBe(42);
  });

  it("computes duration from audio clips only", () => {
    const audio = [{ startTime: 0, duration: 10 }, { startTime: 10, duration: 5 }];
    expect(computeTotalDuration(audio, [])).toBe(15);
  });

  it("computes duration from video clips only", () => {
    const video = [{ startTime: 0, duration: 20 }];
    expect(computeTotalDuration([], video)).toBe(20);
  });

  it("returns the maximum across audio and video", () => {
    const audio = [{ startTime: 0, duration: 30 }];
    const video = [{ startTime: 5, duration: 40 }];
    expect(computeTotalDuration(audio, video)).toBe(45);
  });

  it("handles fractional durations", () => {
    const audio = [{ startTime: 0.5, duration: 2.7 }];
    expect(computeTotalDuration(audio, [])).toBeCloseTo(3.2);
  });

  it("returns fallback when clips sum to zero", () => {
    const audio = [{ startTime: 0, duration: 0 }];
    expect(computeTotalDuration(audio, [], 5)).toBe(5);
  });
});
