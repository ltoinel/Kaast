// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ffmpeg;
mod files;
mod gemini;
mod pexels;
mod sidecar;
mod streaming;

fn main() {
    let port = streaming::start_streaming_server();

    tauri::Builder::default()
        .manage(streaming::StreamingServerState { port })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            gemini::generate_podcast_script,
            gemini::generate_video_scenes,
            gemini::generate_voice,
            ffmpeg::check_ffmpeg,
            ffmpeg::cut_video,
            ffmpeg::merge_videos,
            ffmpeg::add_transition,
            ffmpeg::get_video_info,
            ffmpeg::export_project,
            ffmpeg::generate_video_thumbnail,
            ffmpeg::generate_video_proxy,
            files::read_audio_file,
            pexels::search_and_download_pexels_video,
            streaming::get_streaming_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
