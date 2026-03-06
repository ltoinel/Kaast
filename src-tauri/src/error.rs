/// Structured error types for the Kaast backend.
///
/// Replaces ad-hoc `Result<T, String>` with typed errors that carry context.
/// Each variant maps to a distinct failure domain (HTTP, I/O, FFmpeg, etc.).
/// Implements `Serialize` so Tauri can forward error details to the frontend.

use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("HTTP request failed: {0}")]
    Http(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("JSON error: {0}")]
    Json(String),

    #[error("Base64 decode error: {0}")]
    Base64(String),

    #[error("Task join error: {0}")]
    Join(String),

    #[error("API error ({status}): {body}")]
    Api { status: u16, body: String },

    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("{0}")]
    Other(String),
}

// ── From impls for automatic error conversion ──────────────────────────

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        Self::Http(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e.to_string())
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(e: base64::DecodeError) -> Self {
        Self::Base64(e.to_string())
    }
}

impl From<tokio::task::JoinError> for AppError {
    fn from(e: tokio::task::JoinError) -> Self {
        Self::Join(e.to_string())
    }
}

/// Convenience type alias for command return values.
pub type CmdResult<T> = Result<T, AppError>;
