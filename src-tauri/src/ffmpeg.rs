/// FFmpeg/FFprobe commands for video processing: cutting, merging,
/// transitions, probing, thumbnail/proxy generation, and final export.

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};

use serde::Deserialize;
use tauri::Emitter;

use crate::sidecar::sidecar_path;

/// Check whether FFmpeg is available (bundled sidecar or system PATH).
/// Returns the FFmpeg version string with the source indicator.
#[tauri::command]
pub fn check_ffmpeg() -> Result<String, String> {
    let ffmpeg = sidecar_path("ffmpeg");
    let is_bundled = ffmpeg.is_absolute() && ffmpeg.exists();
    let output = Command::new(&ffmpeg)
        .arg("-version")
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                let version = String::from_utf8_lossy(&result.stdout);
                let first_line = version.lines().next().unwrap_or("FFmpeg installed");
                let source = if is_bundled { " (bundled)" } else { " (system)" };
                Ok(format!("{}{}", first_line, source))
            } else {
                Err("FFmpeg found but execution failed".to_string())
            }
        }
        Err(_) => Err("FFmpeg not available. Run 'bash scripts/download-ffmpeg.sh' then restart the application.".to_string())
    }
}

/// Cut a segment from a video file between `start` and `end` seconds.
#[tauri::command]
pub fn cut_video(input_path: String, start: f64, end: f64, output_path: String) -> Result<String, String> {
    println!("Cutting video: {} from {} to {} -> {}", input_path, start, end, output_path);

    let duration = end - start;

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i").arg(&input_path)
        .arg("-ss").arg(format!("{:.2}", start))
        .arg("-t").arg(format!("{:.2}", duration))
        .arg("-c:v").arg("libx264")
        .arg("-c:a").arg("aac")
        .arg("-y").arg(&output_path)
        .output()
        .map_err(|e| format!("FFmpeg execution error: {}", e))?;

    if output.status.success() {
        Ok(format!("Video cut successfully: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg error: {}", error))
    }
}

/// Merge multiple video files using FFmpeg concat demuxer.
#[tauri::command]
pub fn merge_videos(input_paths: Vec<String>, output_path: String) -> Result<String, String> {
    println!("Merging {} videos -> {}", input_paths.len(), output_path);

    if input_paths.is_empty() {
        return Err("No videos to merge".to_string());
    }
    if input_paths.len() == 1 {
        return Err("At least 2 videos are required for merging".to_string());
    }

    let list_path = Path::new(&output_path)
        .parent()
        .unwrap_or(Path::new("."))
        .join("concat_list.txt");

    let mut list_content = String::new();
    for path in &input_paths {
        list_content.push_str(&format!("file '{}'\n", path.replace('\\', "/")));
    }

    std::fs::write(&list_path, list_content)
        .map_err(|e| format!("Error creating list file: {}", e))?;

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-f").arg("concat")
        .arg("-safe").arg("0")
        .arg("-i").arg(&list_path)
        .arg("-c").arg("copy")
        .arg("-y").arg(&output_path)
        .output()
        .map_err(|e| format!("FFmpeg execution error: {}", e))?;

    let _ = std::fs::remove_file(&list_path);

    if output.status.success() {
        Ok(format!("Videos merged successfully: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg error: {}", error))
    }
}

/// Add a video transition (fade, dissolve, wipeleft) between two clips.
#[tauri::command]
pub fn add_transition(video1: String, video2: String, transition_type: String, duration: f64, output_path: String) -> Result<String, String> {
    println!("Adding {} transition ({}s) between {} and {}", transition_type, duration, video1, video2);

    let filter = match transition_type.as_str() {
        "fade" => format!("[0:v][0:a][1:v][1:a]xfade=transition=fade:duration={}:offset=0[v][a]", duration),
        "dissolve" => format!("[0:v][0:a][1:v][1:a]xfade=transition=dissolve:duration={}:offset=0[v][a]", duration),
        "wipeleft" => format!("[0:v][0:a][1:v][1:a]xfade=transition=wipeleft:duration={}:offset=0[v][a]", duration),
        _ => format!("[0:v][0:a][1:v][1:a]xfade=transition=fade:duration={}:offset=0[v][a]", duration)
    };

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i").arg(&video1)
        .arg("-i").arg(&video2)
        .arg("-filter_complex").arg(&filter)
        .arg("-map").arg("[v]")
        .arg("-map").arg("[a]")
        .arg("-c:v").arg("libx264")
        .arg("-c:a").arg("aac")
        .arg("-y").arg(&output_path)
        .output()
        .map_err(|e| format!("FFmpeg execution error: {}", e))?;

    if output.status.success() {
        Ok(format!("Transition added successfully: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg error: {}", error))
    }
}

/// Get detailed media information (streams, format) for a video file via FFprobe.
#[tauri::command]
pub fn get_video_info(video_path: String) -> Result<String, String> {
    let output = Command::new(sidecar_path("ffprobe"))
        .arg("-v").arg("quiet")
        .arg("-print_format").arg("json")
        .arg("-show_format")
        .arg("-show_streams")
        .arg(&video_path)
        .output()
        .map_err(|e| format!("FFprobe execution error: {}", e))?;

    if output.status.success() {
        let info = String::from_utf8_lossy(&output.stdout);
        Ok(info.to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFprobe error: {}", error))
    }
}

/// A video clip with its timeline position and duration for export.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVideoClip {
    path: String,
    duration: f64,
}

/// Export the final project by concatenating video clips
/// (trimmed to scene duration, scaled to 1080p) and mixing audio.
/// Supports multiple output formats: h264, h265, vp9, prores.
/// Runs FFmpeg asynchronously with progress events emitted to the frontend.
#[tauri::command]
pub async fn export_project(
    app_handle: tauri::AppHandle,
    video_clips: Vec<ExportVideoClip>,
    audio_path: Option<String>,
    output_path: String,
    quality: String,
    total_duration: f64,
    format: Option<String>,
) -> Result<String, String> {
    let format = format.unwrap_or_else(|| "h264".to_string());
    println!("Export to {} with quality {} format {}", output_path, quality, format);

    if video_clips.is_empty() && audio_path.is_none() {
        return Err("No clips to export".to_string());
    }

    // Create output directory if needed
    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error creating output directory: {}", e))?;
    }

    // Run the blocking FFmpeg process in a separate thread
    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(sidecar_path("ffmpeg"));

        // Add all video inputs
        for clip in &video_clips {
            cmd.arg("-i").arg(&clip.path);
        }

        // Add audio input (last input)
        let audio_input_index = video_clips.len();
        if let Some(ref ap) = audio_path {
            cmd.arg("-i").arg(ap);
        }

        if !video_clips.is_empty() {
            build_export_filter(&mut cmd, &video_clips, &audio_path, audio_input_index, &quality, &format);
        } else if audio_path.is_some() {
            // Audio-only export
            cmd.arg("-map").arg("0:a");
            apply_audio_codec_args(&mut cmd, &format);
        }

        // Enable machine-readable progress output on stdout
        cmd.arg("-progress").arg("pipe:1");
        cmd.arg("-y").arg(&output_path);

        println!("FFmpeg command: {:?}", cmd);

        run_ffmpeg_with_progress(cmd, &app_handle, total_duration, &output_path)
    })
    .await
    .map_err(|e| format!("Export task error: {}", e))?
}

/// Build the FFmpeg complex filter for video export (trim, scale, concat, audio).
fn build_export_filter(
    cmd: &mut Command,
    video_clips: &[ExportVideoClip],
    audio_path: &Option<String>,
    audio_input_index: usize,
    quality: &str,
    format: &str,
) {
    let mut filter = String::new();
    for (i, clip) in video_clips.iter().enumerate() {
        filter.push_str(&format!(
            "[{i}:v]trim=duration={dur},setpts=PTS-STARTPTS,\
             scale=1920:1080:force_original_aspect_ratio=decrease,\
             pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30[v{i}];",
            i = i,
            dur = clip.duration,
        ));
    }

    for i in 0..video_clips.len() {
        filter.push_str(&format!("[v{i}]"));
    }
    filter.push_str(&format!("concat=n={}:v=1:a=0[vout]", video_clips.len()));

    cmd.arg("-filter_complex").arg(&filter);
    cmd.arg("-map").arg("[vout]");

    if audio_path.is_some() {
        cmd.arg("-map").arg(format!("{}:a", audio_input_index));
    }

    apply_video_codec_args(cmd, format, quality);

    if audio_path.is_some() {
        apply_audio_codec_args(cmd, format);
        cmd.arg("-shortest");
    }
}

/// Apply video codec arguments based on the selected export format.
fn apply_video_codec_args(cmd: &mut Command, format: &str, quality: &str) {
    match format {
        "h265" => {
            cmd.arg("-c:v").arg("libx265");
            cmd.arg("-preset").arg(quality);
            cmd.arg("-tag:v").arg("hvc1");
            cmd.arg("-pix_fmt").arg("yuv420p");
        }
        "vp9" => {
            let cpu_used = match quality {
                "ultrafast" => "8",
                "fast" => "4",
                "medium" => "2",
                "slow" => "0",
                _ => "2",
            };
            cmd.arg("-c:v").arg("libvpx-vp9");
            cmd.arg("-cpu-used").arg(cpu_used);
            cmd.arg("-crf").arg("31");
            cmd.arg("-b:v").arg("0");
            cmd.arg("-pix_fmt").arg("yuv420p");
        }
        "prores" => {
            let profile = match quality {
                "ultrafast" => "0",
                "fast" => "1",
                "medium" => "2",
                "slow" => "3",
                _ => "2",
            };
            cmd.arg("-c:v").arg("prores_ks");
            cmd.arg("-profile:v").arg(profile);
            cmd.arg("-pix_fmt").arg("yuv422p10le");
        }
        // Default: H.264
        _ => {
            cmd.arg("-c:v").arg("libx264");
            cmd.arg("-preset").arg(quality);
            cmd.arg("-pix_fmt").arg("yuv420p");
        }
    }
}

/// Apply audio codec arguments based on the selected export format.
fn apply_audio_codec_args(cmd: &mut Command, format: &str) {
    match format {
        "vp9" => {
            cmd.arg("-c:a").arg("libopus");
            cmd.arg("-b:a").arg("128k");
        }
        _ => {
            cmd.arg("-c:a").arg("aac");
            cmd.arg("-b:a").arg("192k");
        }
    }
}

/// Spawn an FFmpeg child process and emit progress events by parsing stdout.
fn run_ffmpeg_with_progress(
    mut cmd: Command,
    app_handle: &tauri::AppHandle,
    total_duration: f64,
    output_path: &str,
) -> Result<String, String> {
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("FFmpeg execution error: {}", e))?;

    let stdout = child.stdout.take()
        .ok_or_else(|| "Failed to capture FFmpeg stdout".to_string())?;
    let stderr_pipe = child.stderr.take()
        .ok_or_else(|| "Failed to capture FFmpeg stderr".to_string())?;

    // Collect stderr in a background thread (for error reporting)
    let stderr_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stderr_pipe);
        let mut output = String::new();
        for line in reader.lines().map_while(Result::ok) {
            output.push_str(&line);
            output.push('\n');
        }
        output
    });

    // Parse FFmpeg progress from stdout and emit events
    let reader = BufReader::new(stdout);
    for line in reader.lines().map_while(Result::ok) {
        if let Some(value) = line.strip_prefix("out_time_us=") {
            if let Ok(us) = value.parse::<f64>() {
                let seconds = us / 1_000_000.0;
                let percent = if total_duration > 0.0 {
                    (seconds / total_duration * 100.0).min(100.0).max(0.0)
                } else {
                    0.0
                };
                let _ = app_handle.emit("export-progress", percent);
            }
        }
    }

    let status = child.wait()
        .map_err(|e| format!("FFmpeg wait error: {}", e))?;

    let stderr_output = stderr_thread.join().unwrap_or_default();

    if status.success() {
        let _ = app_handle.emit("export-progress", 100.0_f64);
        Ok(format!("Project exported: {}", output_path))
    } else {
        Err(format!("FFmpeg error: {}", stderr_output))
    }
}

/// Extract a thumbnail frame from a video file using FFmpeg.
/// Saves the thumbnail as a JPEG at the given path.
#[tauri::command]
pub fn generate_video_thumbnail(video_path: String, thumbnail_path: String) -> Result<String, String> {
    if let Some(parent) = Path::new(&thumbnail_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error creating cache directory: {}", e))?;
    }

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i").arg(&video_path)
        .arg("-ss").arg("1")
        .arg("-vframes").arg("1")
        .arg("-vf").arg("scale=480:-1")
        .arg("-q:v").arg("3")
        .arg("-y").arg(&thumbnail_path)
        .output()
        .map_err(|e| format!("FFmpeg thumbnail error: {}", e))?;

    if output.status.success() {
        println!("Thumbnail generated: {}", thumbnail_path);
        Ok(thumbnail_path)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg thumbnail error: {}", error))
    }
}

/// Generate a low-resolution proxy video for preview playback.
/// Transcodes to 360p H.264 with ultrafast preset for quick loading.
#[tauri::command]
pub fn generate_video_proxy(video_path: String, proxy_path: String) -> Result<String, String> {
    if let Some(parent) = Path::new(&proxy_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error creating proxy directory: {}", e))?;
    }

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i").arg(&video_path)
        .arg("-vf").arg("scale=-2:360")
        .arg("-c:v").arg("libx264")
        .arg("-preset").arg("ultrafast")
        .arg("-crf").arg("30")
        .arg("-an")
        .arg("-movflags").arg("+faststart")
        .arg("-y").arg(&proxy_path)
        .output()
        .map_err(|e| format!("FFmpeg proxy error: {}", e))?;

    if output.status.success() {
        println!("Proxy generated: {}", proxy_path);
        Ok(proxy_path)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg proxy error: {}", error))
    }
}
