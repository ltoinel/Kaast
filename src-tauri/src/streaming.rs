/// Local HTTP streaming server for video files with Range request support.
/// Uses Axum on 127.0.0.1 with a random port. Serves media files with
/// HTTP 206 Partial Content for efficient seeking and progressive buffering.
///
/// The server runs on a dedicated thread with its own tokio runtime,
/// completely isolated from the Tauri event loop to avoid startup freezes.

use std::path::PathBuf;

use axum::body::Body;
use axum::extract::Query;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

/// Chunk size for streaming video data (64 KB).
const VIDEO_CHUNK_SIZE: usize = 65536;

/// Chunk size for streaming audio data (512 KB — ~10s of WAV 48kHz 16-bit mono).
const AUDIO_CHUNK_SIZE: usize = 524288;

/// Allowed media file extensions for the streaming server.
const ALLOWED_EXTENSIONS: &[&str] = &[
    "mp4", "webm", "mkv", "avi", "mov", "wav", "mp3", "ogg", "flac", "m4a",
];

/// Shared Tauri state holding the streaming server port.
pub struct StreamingServerState {
    pub port: u16,
}

/// Query parameters for the `/stream` endpoint.
#[derive(Deserialize)]
struct StreamParams {
    path: String,
}

/// Start the local HTTP streaming server synchronously.
/// Binds with std::net (instant), then spawns the Axum server on a
/// dedicated background thread with its own tokio runtime.
/// Returns the assigned port immediately — no async, no blocking Tauri init.
pub fn start_streaming_server() -> u16 {
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind streaming server");
    let port = std_listener.local_addr().unwrap().port();
    std_listener.set_nonblocking(true).unwrap();

    println!("Streaming server listening on http://127.0.0.1:{}", port);

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create streaming server runtime");

        rt.block_on(async move {
            let listener = tokio::net::TcpListener::from_std(std_listener)
                .expect("Failed to convert TcpListener to async");
            let app = Router::new().route("/stream", get(handle_stream));
            axum::serve(listener, app).await.ok();
        });
    });

    port
}

/// Return the streaming server port to the frontend.
#[tauri::command]
pub fn get_streaming_port(state: tauri::State<StreamingServerState>) -> u16 {
    state.port
}

/// Handle GET /stream?path=... with optional Range header.
async fn handle_stream(Query(params): Query<StreamParams>, headers: HeaderMap) -> Response {
    let validated = match validate_path(&params.path) {
        Ok(p) => p,
        Err(msg) => return error_response(StatusCode::FORBIDDEN, msg),
    };

    let range_header = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok());

    match serve_file(&validated, range_header).await {
        Ok(resp) => resp,
        Err(msg) => error_response(StatusCode::INTERNAL_SERVER_ERROR, msg),
    }
}

/// Pick the streaming chunk size based on content type.
fn chunk_size_for(content_type: &str) -> usize {
    if content_type.starts_with("audio/") {
        AUDIO_CHUNK_SIZE
    } else {
        VIDEO_CHUNK_SIZE
    }
}

/// Serve a validated file with optional Range support.
async fn serve_file(path: &PathBuf, range_header: Option<&str>) -> Result<Response, String> {
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Cannot read file metadata: {}", e))?;
    let file_size = metadata.len();
    let content_type = mime_from_ext(
        path.extension().and_then(|e| e.to_str()).unwrap_or(""),
    );
    let chunk_size = chunk_size_for(content_type);

    if let Some(range_str) = range_header {
        let (start, end) = parse_range(range_str, file_size)
            .ok_or_else(|| "Invalid Range header".to_string())?;
        let content_length = end - start + 1;

        let mut file = tokio::fs::File::open(path)
            .await
            .map_err(|e| format!("Cannot open file: {}", e))?;
        file.seek(std::io::SeekFrom::Start(start))
            .await
            .map_err(|e| format!("Seek error: {}", e))?;

        let stream = ReaderStream::with_capacity(file.take(content_length), chunk_size);
        let body = Body::from_stream(stream);

        let mut resp = (StatusCode::PARTIAL_CONTENT, body).into_response();
        let h = resp.headers_mut();
        h.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
        h.insert(header::CONTENT_LENGTH, content_length.into());
        h.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
        h.insert(
            header::CONTENT_RANGE,
            format!("bytes {}-{}/{}", start, end, file_size)
                .parse()
                .unwrap(),
        );
        apply_cors_headers(h);
        Ok(resp)
    } else {
        let file = tokio::fs::File::open(path)
            .await
            .map_err(|e| format!("Cannot open file: {}", e))?;
        let stream = ReaderStream::with_capacity(file, chunk_size);
        let body = Body::from_stream(stream);

        let mut resp = body.into_response();
        let h = resp.headers_mut();
        h.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
        h.insert(header::CONTENT_LENGTH, file_size.into());
        h.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
        apply_cors_headers(h);
        Ok(resp)
    }
}

/// Parse an HTTP Range header value into (start, end) byte positions.
/// Supports `bytes=START-END`, `bytes=START-`, and `bytes=-SUFFIX`.
fn parse_range(header: &str, file_size: u64) -> Option<(u64, u64)> {
    let range_spec = header.strip_prefix("bytes=")?;
    let (start_str, end_str) = range_spec.split_once('-')?;

    if start_str.is_empty() {
        let suffix: u64 = end_str.parse().ok()?;
        let start = file_size.saturating_sub(suffix);
        Some((start, file_size - 1))
    } else if end_str.is_empty() {
        let start: u64 = start_str.parse().ok()?;
        if start >= file_size {
            return None;
        }
        Some((start, file_size - 1))
    } else {
        let start: u64 = start_str.parse().ok()?;
        let end: u64 = end_str.parse().ok()?;
        if start > end || start >= file_size {
            return None;
        }
        Some((start, end.min(file_size - 1)))
    }
}

/// Validate a file path for security: reject traversal, verify existence and extension.
fn validate_path(path_str: &str) -> Result<PathBuf, String> {
    if path_str.contains("..") {
        return Err("Directory traversal not allowed".to_string());
    }

    let canonical = std::fs::canonicalize(path_str).map_err(|_| "File not found".to_string())?;

    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!("File extension '{}' not allowed", ext));
    }

    Ok(canonical)
}

/// Map a file extension to its MIME type.
fn mime_from_ext(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        _ => "application/octet-stream",
    }
}

/// Apply CORS headers to a response (localhost-only, no security risk).
fn apply_cors_headers(h: &mut axum::http::HeaderMap) {
    h.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        "*".parse().unwrap(),
    );
    h.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        "Content-Range, Content-Length, Accept-Ranges"
            .parse()
            .unwrap(),
    );
}

/// Build an error response with CORS headers.
fn error_response(status: StatusCode, message: String) -> Response {
    let mut resp = (status, message).into_response();
    resp.headers_mut().insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        "*".parse().unwrap(),
    );
    resp
}
