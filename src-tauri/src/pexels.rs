/// Pexels API integration for searching and downloading stock videos.

use std::path::Path;

use serde::Deserialize;

// ---------------------------------------------------------------------------
// Pexels API response structures
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct PexelsSearchResponse {
    videos: Vec<PexelsVideo>,
}

#[derive(Deserialize)]
struct PexelsVideo {
    video_files: Vec<PexelsVideoFile>,
}

#[derive(Deserialize)]
struct PexelsVideoFile {
    #[serde(default)]
    file_type: Option<String>,
    #[serde(default)]
    quality: Option<String>,
    #[serde(default)]
    width: Option<u32>,
    link: String,
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

/// Search for a stock video on Pexels and download it to the project directory.
/// Returns the local file path if successful.
/// Skips download if the file already exists.
#[tauri::command]
pub async fn search_and_download_pexels_video(
    api_key: String,
    query: String,
    _min_duration: u32,
    project_path: String,
    scene_index: u32,
) -> Result<String, String> {
    let file_name = format!("scene_{:03}.mp4", scene_index);
    let videos_dir = Path::new(&project_path).join("videos");
    let output_path = videos_dir.join(&file_name);

    // Skip download if file already exists
    if output_path.exists() {
        return Ok(output_path.to_string_lossy().to_string());
    }

    // Create videos directory if absent
    std::fs::create_dir_all(&videos_dir)
        .map_err(|e| format!("Error creating videos directory: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Error creating HTTP client: {}", e))?;

    // Search Pexels API
    let search_response = client
        .get("https://api.pexels.com/videos/search")
        .header("Authorization", &api_key)
        .query(&[
            ("query", query.as_str()),
            ("per_page", "5"),
            ("orientation", "landscape"),
        ])
        .send()
        .await
        .map_err(|e| format!("Pexels API request error: {}", e))?;

    if !search_response.status().is_success() {
        let status = search_response.status();
        let error_text = search_response.text().await.unwrap_or_default();
        return Err(format!("Pexels API error ({}): {}", status, error_text));
    }

    let pexels_data: PexelsSearchResponse = search_response
        .json()
        .await
        .map_err(|e| format!("Error parsing Pexels response: {}", e))?;

    if pexels_data.videos.is_empty() {
        return Err(format!("No video found on Pexels for: {}", query));
    }

    let best_file = select_best_video_file(&pexels_data)
        .ok_or_else(|| "No suitable video file found".to_string())?;

    println!(
        "Downloading Pexels video: {} (quality: {:?}, width: {:?})",
        best_file.link, best_file.quality, best_file.width
    );

    // Download the video file
    let video_response = client
        .get(&best_file.link)
        .send()
        .await
        .map_err(|e| format!("Video download error: {}", e))?;

    if !video_response.status().is_success() {
        return Err(format!("Video download failed ({})", video_response.status()));
    }

    let video_bytes = video_response
        .bytes()
        .await
        .map_err(|e| format!("Error reading video data: {}", e))?;

    std::fs::write(&output_path, &video_bytes)
        .map_err(|e| format!("Error writing video file: {}", e))?;

    println!("Video saved: {} ({} bytes)", output_path.display(), video_bytes.len());

    Ok(output_path.to_string_lossy().to_string())
}

/// Select the best video file from Pexels results: prefer mp4, HD quality, highest resolution.
fn select_best_video_file(pexels_data: &PexelsSearchResponse) -> Option<&PexelsVideoFile> {
    pexels_data
        .videos
        .iter()
        .flat_map(|v| v.video_files.iter())
        .filter(|f| {
            f.file_type
                .as_deref()
                .map(|t| t.contains("mp4"))
                .unwrap_or(false)
        })
        .max_by_key(|f| {
            let quality_score = match f.quality.as_deref() {
                Some("hd") => 2,
                Some("sd") => 1,
                _ => 0,
            };
            let width = f.width.unwrap_or(0);
            (quality_score, width)
        })
        .or_else(|| {
            // Fallback: take any file with highest resolution
            pexels_data
                .videos
                .iter()
                .flat_map(|v| v.video_files.iter())
                .max_by_key(|f| f.width.unwrap_or(0))
        })
}
