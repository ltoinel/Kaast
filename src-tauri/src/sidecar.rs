/// Sidecar binary resolution for FFmpeg and FFprobe.
/// Looks next to the current executable with the Tauri target-triple suffix,
/// then without suffix, then falls back to system PATH.

use std::path::PathBuf;

/// Resolve the path to a sidecar binary (ffmpeg or ffprobe).
pub fn sidecar_path(name: &str) -> PathBuf {
    let target = env!("TAURI_ENV_TARGET_TRIPLE");
    let ext = if cfg!(windows) { ".exe" } else { "" };

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // Tauri places sidecars next to the executable with target triple
            let with_triple = dir.join(format!("{name}-{target}{ext}"));
            if with_triple.exists() {
                return with_triple;
            }
            // Try without target triple (some bundle formats)
            let without_triple = dir.join(format!("{name}{ext}"));
            if without_triple.exists() {
                return without_triple;
            }
        }
    }

    // Fallback: bare name -> system PATH lookup
    PathBuf::from(format!("{name}{ext}"))
}
