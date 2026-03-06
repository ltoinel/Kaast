/// File I/O utilities for reading media files and returning data URIs.

use std::path::Path;

use base64::{Engine as _, engine::general_purpose};

use crate::error::{AppError, CmdResult};

/// Read a file and return its contents as a base64 data URI.
/// Bypasses Tauri FS plugin restrictions by using std::fs directly.
#[tauri::command]
pub fn read_audio_file(file_path: String) -> CmdResult<String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(AppError::Validation(format!("File not found: {}", file_path)));
    }

    let bytes = std::fs::read(path)?;

    if bytes.is_empty() {
        return Err(AppError::Validation(format!("Empty file: {}", file_path)));
    }

    let b64 = general_purpose::STANDARD.encode(&bytes);

    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime = match ext.as_str() {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "audio/mpeg",
    };

    Ok(format!("data:{};base64,{}", mime, b64))
}
