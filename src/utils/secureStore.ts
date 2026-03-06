/**
 * secureStore — Secure key-value storage using Tauri's plugin-store.
 *
 * Replaces localStorage for sensitive data (API keys).
 * The store is saved to disk in the app data directory and is
 * not accessible from the browser devtools unlike localStorage.
 *
 * Falls back to localStorage when running outside Tauri (e.g. in tests).
 */

const STORE_NAME = "settings.json";

/** Check if we're running inside Tauri */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Get a value from the secure store.
 * Falls back to localStorage outside of Tauri.
 */
export async function getSecureValue(key: string): Promise<string | null> {
  if (!isTauri()) {
    return localStorage.getItem(key);
  }

  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_NAME);
    const value = await store.get<string>(key);
    return value ?? null;
  } catch (e) {
    console.error("Secure store get error:", e);
    // Fallback: try localStorage (for migration)
    return localStorage.getItem(key);
  }
}

/**
 * Set a value in the secure store.
 * Also removes it from localStorage if it was previously stored there (migration).
 */
export async function setSecureValue(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(key, value);
    return;
  }

  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_NAME);
    await store.set(key, value);
    await store.save();
    // Clean up legacy localStorage entry
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Secure store set error:", e);
    // Fallback to localStorage
    localStorage.setItem(key, value);
  }
}

/**
 * Remove a value from the secure store (and localStorage for migration).
 */
export async function removeSecureValue(key: string): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem(key);
    return;
  }

  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_NAME);
    await store.delete(key);
    await store.save();
  } catch (e) {
    console.error("Secure store remove error:", e);
  }
  // Always clean localStorage too
  localStorage.removeItem(key);
}

/**
 * Migrate existing keys from localStorage to the secure store.
 * Call this once at app startup.
 */
export async function migrateToSecureStore(keys: string[]): Promise<void> {
  if (!isTauri()) return;

  for (const key of keys) {
    const legacyValue = localStorage.getItem(key);
    if (legacyValue) {
      await setSecureValue(key, legacyValue);
    }
  }
}

// ── API key storage keys ──────────────────────────────────────────────
export const GEMINI_API_KEY = "gemini_api_key";
export const PEXELS_API_KEY = "pexels_api_key";

/** All sensitive keys that should be migrated to secure store at startup. */
export const SENSITIVE_KEYS = [GEMINI_API_KEY, PEXELS_API_KEY];
