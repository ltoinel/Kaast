/// Pexels API integration for searching and downloading stock videos.

use std::path::Path;

use serde::Deserialize;

// ---------------------------------------------------------------------------
// Pexels API response structures
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub(crate) struct PexelsSearchResponse {
    pub(crate) videos: Vec<PexelsVideo>,
}

#[derive(Deserialize)]
pub(crate) struct PexelsVideo {
    #[serde(default)]
    pub(crate) duration: u32,
    pub(crate) video_files: Vec<PexelsVideoFile>,
}

#[derive(Deserialize)]
pub(crate) struct PexelsVideoFile {
    #[serde(default)]
    pub(crate) file_type: Option<String>,
    #[serde(default)]
    pub(crate) quality: Option<String>,
    #[serde(default)]
    pub(crate) width: Option<u32>,
    pub(crate) link: String,
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
    min_duration: u32,
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

    // Search Pexels API — require videos at least as long as the scene
    let min_dur_str = min_duration.to_string();
    let search_response = client
        .get("https://api.pexels.com/videos/search")
        .header("Authorization", &api_key)
        .query(&[
            ("query", query.as_str()),
            ("per_page", "15"),
            ("orientation", "landscape"),
            ("min_duration", min_dur_str.as_str()),
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

    let best_file = select_best_video_file(&pexels_data, min_duration)
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
/// Videos shorter than `min_duration` are excluded when possible.
pub(crate) fn select_best_video_file(pexels_data: &PexelsSearchResponse, min_duration: u32) -> Option<&PexelsVideoFile> {
    // Prefer videos that are at least as long as the scene
    let long_enough: Vec<&PexelsVideo> = pexels_data
        .videos
        .iter()
        .filter(|v| v.duration >= min_duration)
        .collect();

    // Fall back to all videos if none meet the duration requirement
    let candidates: &[&PexelsVideo] = if long_enough.is_empty() {
        &pexels_data.videos.iter().collect::<Vec<_>>()
    } else {
        &long_enough
    };

    candidates
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
            candidates
                .iter()
                .flat_map(|v| v.video_files.iter())
                .max_by_key(|f| f.width.unwrap_or(0))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to build a PexelsVideoFile for tests.
    fn make_file(file_type: Option<&str>, quality: Option<&str>, width: Option<u32>, link: &str) -> PexelsVideoFile {
        PexelsVideoFile {
            file_type: file_type.map(String::from),
            quality: quality.map(String::from),
            width,
            link: link.to_string(),
        }
    }

    /// Helper to build a PexelsSearchResponse for tests.
    fn make_response(videos: Vec<PexelsVideo>) -> PexelsSearchResponse {
        PexelsSearchResponse { videos }
    }

    #[test]
    fn no_videos_returns_none() {
        let data = make_response(vec![]);
        assert!(select_best_video_file(&data, 5).is_none());
    }

    #[test]
    fn prefers_mp4_hd() {
        let data = make_response(vec![PexelsVideo {
            duration: 10,
            video_files: vec![
                make_file(Some("video/webm"), Some("hd"), Some(1920), "webm_hd"),
                make_file(Some("video/mp4"), Some("hd"), Some(1920), "mp4_hd"),
                make_file(Some("video/mp4"), Some("sd"), Some(640), "mp4_sd"),
            ],
        }]);
        let best = select_best_video_file(&data, 5).unwrap();
        assert_eq!(best.link, "mp4_hd");
    }

    #[test]
    fn prefers_higher_resolution_mp4() {
        let data = make_response(vec![PexelsVideo {
            duration: 10,
            video_files: vec![
                make_file(Some("video/mp4"), Some("hd"), Some(1280), "mp4_1280"),
                make_file(Some("video/mp4"), Some("hd"), Some(1920), "mp4_1920"),
            ],
        }]);
        let best = select_best_video_file(&data, 5).unwrap();
        assert_eq!(best.link, "mp4_1920");
    }

    #[test]
    fn fallback_to_non_mp4_when_no_mp4() {
        let data = make_response(vec![PexelsVideo {
            duration: 10,
            video_files: vec![
                make_file(Some("video/webm"), Some("hd"), Some(1920), "webm_hd"),
                make_file(Some("video/webm"), Some("sd"), Some(640), "webm_sd"),
            ],
        }]);
        let best = select_best_video_file(&data, 5).unwrap();
        assert_eq!(best.link, "webm_hd");
    }

    #[test]
    fn filters_by_duration() {
        let data = make_response(vec![
            PexelsVideo {
                duration: 3,
                video_files: vec![make_file(Some("video/mp4"), Some("hd"), Some(1920), "short")],
            },
            PexelsVideo {
                duration: 10,
                video_files: vec![make_file(Some("video/mp4"), Some("hd"), Some(1920), "long")],
            },
        ]);
        let best = select_best_video_file(&data, 5).unwrap();
        assert_eq!(best.link, "long");
    }

    #[test]
    fn falls_back_when_none_meet_duration() {
        let data = make_response(vec![PexelsVideo {
            duration: 3,
            video_files: vec![make_file(Some("video/mp4"), Some("hd"), Some(1920), "short_only")],
        }]);
        let best = select_best_video_file(&data, 10).unwrap();
        assert_eq!(best.link, "short_only");
    }

    #[test]
    fn video_with_no_files_returns_none() {
        let data = make_response(vec![PexelsVideo {
            duration: 10,
            video_files: vec![],
        }]);
        assert!(select_best_video_file(&data, 5).is_none());
    }
}
