/**
 * Utilities for safe Tauri API calls
 */
import i18n from '../i18n';

// Check if we are running inside a Tauri v2 webview
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class TauriNotAvailableError extends Error {
  constructor() {
    super(i18n.t('tauri.errorNotAvailable', "The application must be launched with Tauri. Use 'npm run tauri dev' instead of 'npm run dev'"));
    this.name = 'TauriNotAvailableError';
  }
}

// Safe wrapper for invoke
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauriAvailable()) {
    throw new TauriNotAvailableError();
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Error calling ${command}:`, error);
    throw error;
  }
}

// Get a user-friendly error message
export function getTauriErrorMessage(error: unknown): string {
  if (error instanceof TauriNotAvailableError) {
    return "⚠️ " + i18n.t('tauri.errorMessage', "The application must be launched with 'npm run tauri dev'");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Convert a file path to a URL usable by the webview
export async function convertToAssetUrl(filePath: string): Promise<string> {
  if (!isTauriAvailable()) {
    return `file://${filePath}`;
  }

  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(filePath);
  } catch (error) {
    console.error("convertFileSrc error:", error);
    return `file://${filePath}`;
  }
}

// Revoke a Blob URL to free memory
export function revokeBlobUrl(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

// Load an audio file via Rust command (bypasses FS scope)
export async function loadAudioAsBlob(filePath: string): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("Tauri not available");
  }

  const dataUri = await safeInvoke<string>('read_audio_file', { filePath });
  return dataUri;
}

// Load any file as a data URI via Rust command (images, videos, etc.)
export async function loadFileAsDataUri(filePath: string): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("Tauri not available");
  }

  return await safeInvoke<string>('read_audio_file', { filePath });
}
