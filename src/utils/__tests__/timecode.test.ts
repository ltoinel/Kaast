import { describe, it, expect } from "vitest";
import { formatTimecode, formatTime } from "../timecode";

describe("formatTimecode", () => {
  it("formats 0 seconds", () => {
    expect(formatTimecode(0)).toBe("00:00:00:00");
  });

  it("formats 1 second", () => {
    expect(formatTimecode(1)).toBe("00:00:01:00");
  });

  it("formats 61 seconds", () => {
    expect(formatTimecode(61)).toBe("00:01:01:00");
  });

  it("formats 3661 seconds (1h 1m 1s)", () => {
    expect(formatTimecode(3661)).toBe("01:01:01:00");
  });

  it("formats fractional seconds as frames (1.5s → 15 frames at 30fps)", () => {
    expect(formatTimecode(1.5)).toBe("00:00:01:15");
  });

  it("formats small fractional (0.1s → 3 frames)", () => {
    expect(formatTimecode(0.1)).toBe("00:00:00:03");
  });

  it("formats large value (86400s = 24h)", () => {
    expect(formatTimecode(86400)).toBe("24:00:00:00");
  });
});

describe("formatTime", () => {
  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 59 seconds", () => {
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats 60 seconds", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats 61 seconds", () => {
    expect(formatTime(61)).toBe("1:01");
  });

  it("formats 3661 seconds", () => {
    expect(formatTime(3661)).toBe("61:01");
  });

  it("truncates fractional seconds", () => {
    expect(formatTime(1.9)).toBe("0:01");
  });
});
