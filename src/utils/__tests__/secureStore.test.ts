import { describe, it, expect, beforeEach } from "vitest";
import {
  getSecureValue, setSecureValue, removeSecureValue,
  GEMINI_API_KEY, PEXELS_API_KEY, SENSITIVE_KEYS,
} from "../secureStore";

// Outside Tauri, secureStore falls back to localStorage
describe("secureStore (localStorage fallback)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null for missing key", async () => {
    expect(await getSecureValue("nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", async () => {
    await setSecureValue("test_key", "test_value");
    expect(await getSecureValue("test_key")).toBe("test_value");
  });

  it("removes a value", async () => {
    await setSecureValue("test_key", "value");
    await removeSecureValue("test_key");
    expect(await getSecureValue("test_key")).toBeNull();
  });

  it("overwrites existing value", async () => {
    await setSecureValue("key", "old");
    await setSecureValue("key", "new");
    expect(await getSecureValue("key")).toBe("new");
  });

  it("exports correct API key constants", () => {
    expect(GEMINI_API_KEY).toBe("gemini_api_key");
    expect(PEXELS_API_KEY).toBe("pexels_api_key");
  });

  it("SENSITIVE_KEYS includes both API keys", () => {
    expect(SENSITIVE_KEYS).toContain(GEMINI_API_KEY);
    expect(SENSITIVE_KEYS).toContain(PEXELS_API_KEY);
    expect(SENSITIVE_KEYS).toHaveLength(2);
  });
});
