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

/** Cached streaming server port (resolved once, reused). */
let streamingPort: number | null = null;

/** Retrieve the local streaming server port from the Rust backend. */
export async function getStreamingPort(): Promise<number> {
  if (streamingPort !== null) return streamingPort;
  streamingPort = await safeInvoke<number>('get_streaming_port');
  return streamingPort;
}

/**
 * Build a streaming URL for a local file served by the Rust HTTP server.
 * The browser handles buffering, seeking, and Range requests natively.
 */
export async function getStreamingUrl(filePath: string): Promise<string> {
  const port = await getStreamingPort();
  return `http://127.0.0.1:${port}/stream?path=${encodeURIComponent(filePath)}`;
}

/** MIME type lookup for common video/audio extensions. */
const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
};

/**
 * Read a file via the Tauri FS plugin and return a blob URL.
 * Blob URLs are same-origin and work reliably with <video> / <audio> tags,
 * unlike Tauri asset-protocol URLs which can fail in WebKitGTK.
 */
export async function loadFileAsBlobUrl(filePath: string): Promise<string> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
