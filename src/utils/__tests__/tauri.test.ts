import { describe, it, expect } from "vitest";
import { basename } from "../tauri";

describe("basename", () => {
  it("extracts filename from Unix path", () => {
    expect(basename("/a/b/c.mp4")).toBe("c.mp4");
  });

  it("extracts filename from Windows path", () => {
    expect(basename("C:\\Users\\test\\file.mp4")).toBe("file.mp4");
  });

  it("handles mixed separators", () => {
    expect(basename("C:\\Users/test\\file.mp4")).toBe("file.mp4");
  });

  it("returns the string itself when no separator is found", () => {
    expect(basename("file.mp4")).toBe("file.mp4");
  });

  it("returns empty string for empty input", () => {
    expect(basename("")).toBe("");
  });

  it("handles trailing separator", () => {
    expect(basename("/a/b/c/")).toBe("");
  });

  it("handles root path", () => {
    expect(basename("/")).toBe("");
  });
});
