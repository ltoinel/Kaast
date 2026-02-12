// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};
use tauri::Emitter;

/// Resolve the path to a sidecar binary (ffmpeg or ffprobe).
/// Looks next to the current executable with the Tauri target-triple suffix,
/// then without suffix, then falls back to system PATH.
fn sidecar_path(name: &str) -> PathBuf {
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

    // Fallback: bare name → system PATH lookup
    PathBuf::from(format!("{name}{ext}"))
}

#[derive(Serialize, Deserialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Serialize, Deserialize, Clone)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize, Clone)]
struct GeminiPart {
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    inline_data: Option<InlineData>,
}

#[derive(Serialize, Deserialize, Clone)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiResponseContent,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    #[serde(default)]
    text: Option<String>,
    #[serde(default, rename = "inline_data")]
    _inline_data: Option<InlineData>,
}

// Structures pour Gemini Audio Generation
#[derive(Serialize)]
struct GeminiAudioRequest {
    contents: Vec<GeminiAudioContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GeminiAudioConfig,
}

#[derive(Serialize)]
struct GeminiAudioContent {
    parts: Vec<GeminiTextPart>,
}

#[derive(Serialize)]
struct GeminiTextPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiAudioConfig {
    #[serde(rename = "responseModalities")]
    response_modalities: Vec<String>,
    #[serde(rename = "speechConfig")]
    speech_config: SpeechConfig,
}

#[derive(Serialize)]
struct SpeechConfig {
    #[serde(rename = "voiceConfig")]
    voice_config: VoiceConfig,
}

#[derive(Serialize)]
struct VoiceConfig {
    #[serde(rename = "prebuiltVoiceConfig")]
    prebuilt_voice_config: PrebuiltVoiceConfig,
}

#[derive(Serialize)]
struct PrebuiltVoiceConfig {
    #[serde(rename = "voiceName")]
    voice_name: String,
}

#[derive(Deserialize, Debug)]
struct GeminiAudioResponse {
    candidates: Option<Vec<GeminiAudioCandidate>>,
    error: Option<GeminiError>,
}

#[derive(Deserialize, Debug)]
struct GeminiError {
    message: String,
}

#[derive(Deserialize, Debug)]
struct GeminiAudioCandidate {
    content: GeminiAudioResponseContent,
}

#[derive(Deserialize, Debug)]
struct GeminiAudioResponseContent {
    parts: Vec<GeminiAudioResponsePart>,
}

#[derive(Deserialize, Debug)]
struct GeminiAudioResponsePart {
    #[serde(rename = "inlineData")]
    inline_data: Option<AudioInlineData>,
}

#[derive(Deserialize, Debug)]
struct AudioInlineData {
    #[serde(rename = "mimeType")]
    mime_type: String,
    data: String,
}

// Générer la synthèse vocale avec Gemini 2.0 Flash
#[tauri::command]
async fn generate_voice(text: String, api_key: String, output_path: String) -> Result<String, String> {
    println!("Génération vocale Gemini Flash pour {} caractères", text.len());
    
    if text.trim().is_empty() {
        return Err("Le texte ne peut pas être vide".to_string());
    }
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Erreur création client: {}", e))?;
    
    // Préparer le prompt pour la génération audio
    let prompt = format!(
        "Lis ce texte à voix haute en français avec une voix naturelle et engageante, comme un présentateur de podcast professionnel:\n\n{}",
        text
    );
    
    let request_body = GeminiAudioRequest {
        contents: vec![GeminiAudioContent {
            parts: vec![GeminiTextPart {
                text: prompt,
            }],
        }],
        generation_config: GeminiAudioConfig {
            response_modalities: vec!["AUDIO".to_string()],
            speech_config: SpeechConfig {
                voice_config: VoiceConfig {
                    prebuilt_voice_config: PrebuiltVoiceConfig {
                        voice_name: "Kore".to_string(),  // Voix naturelle
                    },
                },
            },
        },
    };
    
    // Utiliser le modèle expérimental qui supporte la génération audio
    let api_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={}",
        api_key
    );
    
    println!("Appel API Gemini TTS pour génération audio...");
    
    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erreur appel Gemini API: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        return Err(format!("Erreur Gemini API ({}): {}", status, error_text));
    }
    
    let gemini_response: GeminiAudioResponse = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing réponse Gemini: {}", e))?;
    
    // Vérifier s'il y a une erreur
    if let Some(error) = gemini_response.error {
        return Err(format!("Erreur Gemini: {}", error.message));
    }
    
    // Extraire les données audio
    let candidates = gemini_response.candidates
        .ok_or("Pas de candidats dans la réponse Gemini")?;
    
    if candidates.is_empty() {
        return Err("Réponse Gemini vide".to_string());
    }
    
    let mut all_audio_data: Vec<u8> = Vec::new();
    
    for part in &candidates[0].content.parts {
        if let Some(ref inline_data) = part.inline_data {
            println!("Audio trouvé, mime_type: {}", inline_data.mime_type);
            
            let audio_data = general_purpose::STANDARD
                .decode(&inline_data.data)
                .map_err(|e| format!("Erreur décodage audio base64: {}", e))?;
            
            all_audio_data.extend(audio_data);
        }
    }
    
    if all_audio_data.is_empty() {
        return Err("No audio data in Gemini response".to_string());
    }

    // Create parent directory if needed
    if let Some(parent) = std::path::Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error creating directory: {}", e))?;
    }

    // Parse sample rate from mime_type (e.g. "audio/L16;rate=24000")
    let sample_rate: u32 = candidates[0].content.parts.iter()
        .filter_map(|p| p.inline_data.as_ref())
        .find_map(|d| {
            d.mime_type.split("rate=").nth(1)
                .and_then(|r| r.trim().parse::<u32>().ok())
        })
        .unwrap_or(24000);

    let channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * channels as u32 * bits_per_sample as u32 / 8;
    let block_align = channels * bits_per_sample / 8;
    let data_size = all_audio_data.len() as u32;

    // Build WAV file with proper header
    let mut wav_data: Vec<u8> = Vec::with_capacity(44 + all_audio_data.len());
    // RIFF header
    wav_data.extend_from_slice(b"RIFF");
    wav_data.extend_from_slice(&(36 + data_size).to_le_bytes());
    wav_data.extend_from_slice(b"WAVE");
    // fmt sub-chunk
    wav_data.extend_from_slice(b"fmt ");
    wav_data.extend_from_slice(&16u32.to_le_bytes()); // PCM format chunk size
    wav_data.extend_from_slice(&1u16.to_le_bytes());  // PCM format
    wav_data.extend_from_slice(&channels.to_le_bytes());
    wav_data.extend_from_slice(&sample_rate.to_le_bytes());
    wav_data.extend_from_slice(&byte_rate.to_le_bytes());
    wav_data.extend_from_slice(&block_align.to_le_bytes());
    wav_data.extend_from_slice(&bits_per_sample.to_le_bytes());
    // data sub-chunk
    wav_data.extend_from_slice(b"data");
    wav_data.extend_from_slice(&data_size.to_le_bytes());
    wav_data.extend_from_slice(&all_audio_data);

    // Save as .wav
    let final_output_path = if output_path.ends_with(".mp3") {
        output_path.replace(".mp3", ".wav")
    } else {
        output_path.clone()
    };

    std::fs::write(&final_output_path, &wav_data)
        .map_err(|e| format!("Error writing file: {}", e))?;

    println!("Audio generated: {} ({} bytes, {}Hz)", final_output_path, wav_data.len(), sample_rate);
    Ok(final_output_path)
}

// Générer un script de podcast à partir d'une URL avec Gemini API
#[tauri::command]
async fn generate_podcast_script(url: String, api_key: String, style_prompt: String) -> Result<String, String> {
    println!("Génération de script podcast depuis: {}", url);

    // 1. Fetch le contenu du site web
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Erreur création client: {}", e))?;

    let html = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erreur lors du téléchargement: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Erreur lecture contenu: {}", e))?;

    // 2. Extraire le texte principal avec scraper dans un bloc synchrone
    let content = tokio::task::spawn_blocking(move || {
        let document = scraper::Html::parse_document(&html);
        let selector = scraper::Selector::parse("p, h1, h2, h3, article").unwrap();
        let mut content = String::new();
        for element in document.select(&selector) {
            let text = element.text().collect::<Vec<_>>().join(" ");
            if text.len() > 20 {
                content.push_str(&text);
                content.push_str("\n\n");
            }
        }
        if content.trim().is_empty() {
            return Err("Impossible d'extraire le contenu du site".to_string());
        }
        // Limiter à 5000 caractères pour éviter dépassement token
        let content = if content.len() > 5000 {
            content.chars().take(5000).collect::<String>()
        } else {
            content
        };
        Ok(content)
    })
    .await
    .map_err(|e| format!("Erreur thread extraction: {}", e))??;
    
    // 3. Appeler Gemini API avec le prompt de style fourni par le frontend
    let prompt = format!("{}\n\nContenu source:\n{}\n\nScript de podcast:", style_prompt, content);
    
    let request_body = GeminiRequest {
        contents: vec![GeminiContent {
            parts: vec![GeminiPart {
                text: Some(prompt),
                inline_data: None,
            }],
        }],
    };
    
    let api_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
        api_key
    );
    
    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erreur appel Gemini API: {}", e))?;
    
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        return Err(format!("Erreur API ({}): {}", status, error_text));
    }
    let gemini_response: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing réponse: {}", e))?;
    
    let script = gemini_response
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .and_then(|p| p.text.clone())
        .ok_or_else(|| "Aucun script généré".to_string())?;
    
    Ok(script)
}

// Générer des suggestions de scènes vidéo à partir d'un script podcast
#[tauri::command]
async fn generate_video_scenes(script: String, api_key: String, total_duration: f64, max_scene_duration: u32) -> Result<String, String> {
    println!("Génération de scènes vidéo depuis le script (durée totale: {}s, max par scène: {}s)...", total_duration, max_scene_duration);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Erreur création client: {}", e))?;

    let prompt = format!(
        "Analyse ce script de podcast et identifie des scènes vidéo qui pourraient l'illustrer visuellement.\n\
        La durée TOTALE de l'audio est de {:.0} secondes. La somme des durées de toutes les scènes DOIT être exactement égale à {:.0} secondes.\n\
        Pour chaque scène, donne:\n\
        - description: description visuelle courte de la scène (max 100 caractères)\n\
        - duration: durée en secondes (nombre entier, minimum 4, MAXIMUM {} secondes par scène). La somme de toutes les durées = {:.0}s\n\
        - scriptExcerpt: l'extrait du script que cette scène illustre (max 150 caractères)\n\
        - searchKeywords: 2 à 4 mots-clés EN ANGLAIS pour rechercher une vidéo stock correspondante (ex: \"aerial city skyline\", \"scientist laboratory research\")\n\n\
        Retourne UNIQUEMENT un tableau JSON valide, sans texte avant ou après.\n\n\
        Script:\n{}",
        total_duration, total_duration, max_scene_duration, total_duration, script
    );

    let request_body = GeminiRequest {
        contents: vec![GeminiContent {
            parts: vec![GeminiPart {
                text: Some(prompt),
                inline_data: None,
            }],
        }],
    };

    let api_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
        api_key
    );

    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erreur appel Gemini API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        return Err(format!("Erreur API ({}): {}", status, error_text));
    }

    let gemini_response: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing réponse: {}", e))?;

    let raw_text = gemini_response
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .and_then(|p| p.text.clone())
        .ok_or_else(|| "Aucune scène générée".to_string())?;

    // Extraire le JSON du texte (peut être entouré de ```json ... ```)
    let json_text = if let Some(start) = raw_text.find('[') {
        if let Some(end) = raw_text.rfind(']') {
            &raw_text[start..=end]
        } else {
            &raw_text
        }
    } else {
        &raw_text
    };

    // Valider que c'est du JSON valide
    let _: serde_json::Value = serde_json::from_str(json_text)
        .map_err(|e| format!("Réponse JSON invalide: {}", e))?;

    Ok(json_text.to_string())
}

// Vérifier si FFmpeg est disponible (embarqué ou système)
#[tauri::command]
fn check_ffmpeg() -> Result<String, String> {
    let ffmpeg = sidecar_path("ffmpeg");
    let is_bundled = ffmpeg.is_absolute() && ffmpeg.exists();
    let output = Command::new(&ffmpeg)
        .arg("-version")
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                let version = String::from_utf8_lossy(&result.stdout);
                let first_line = version.lines().next().unwrap_or("FFmpeg installé");
                let source = if is_bundled { " (embarqué)" } else { " (système)" };
                Ok(format!("{}{}", first_line, source))
            } else {
                Err("FFmpeg trouvé mais erreur lors de l'exécution".to_string())
            }
        }
        Err(_) => Err("FFmpeg non disponible. Lancez 'bash scripts/download-ffmpeg.sh' puis relancez l'application.".to_string())
    }
}

// Commande Tauri pour découper une vidéo
#[tauri::command]
fn cut_video(input_path: String, start: f64, end: f64, output_path: String) -> Result<String, String> {
    println!("Découpage vidéo: {} de {} à {} vers {}", input_path, start, end, output_path);
    
    let duration = end - start;
    
    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i")
        .arg(&input_path)
        .arg("-ss")
        .arg(format!("{:.2}", start))
        .arg("-t")
        .arg(format!("{:.2}", duration))
        .arg("-c:v")
        .arg("libx264")
        .arg("-c:a")
        .arg("aac")
        .arg("-y")
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Erreur lors de l'exécution de FFmpeg: {}", e))?;
    
    if output.status.success() {
        Ok(format!("Vidéo découpée avec succès: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Erreur FFmpeg: {}", error))
    }
}

// Commande Tauri pour fusionner des vidéos
#[tauri::command]
fn merge_videos(input_paths: Vec<String>, output_path: String) -> Result<String, String> {
    println!("Fusion de {} vidéos vers {}", input_paths.len(), output_path);
    
    if input_paths.is_empty() {
        return Err("Aucune vidéo à fusionner".to_string());
    }
    
    if input_paths.len() == 1 {
        return Err("Au moins 2 vidéos sont nécessaires pour la fusion".to_string());
    }
    
    let list_path = Path::new(&output_path)
        .parent()
        .unwrap_or(Path::new("."))
        .join("concat_list.txt");
    
    let mut list_content = String::new();
    for path in &input_paths {
        list_content.push_str(&format!("file '{}'\n", path.replace("\\", "/")));
    }
    
    std::fs::write(&list_path, list_content)
        .map_err(|e| format!("Erreur création fichier liste: {}", e))?;
    
    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(&list_path)
        .arg("-c")
        .arg("copy")
        .arg("-y")
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Erreur lors de l'exécution de FFmpeg: {}", e))?;
    
    let _ = std::fs::remove_file(&list_path);
    
    if output.status.success() {
        Ok(format!("Vidéos fusionnées avec succès: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Erreur FFmpeg: {}", error))
    }
}

// Commande Tauri pour ajouter une transition
#[tauri::command]
fn add_transition(video1: String, video2: String, transition_type: String, duration: f64, output_path: String) -> Result<String, String> {
    println!("Ajout transition {} de {}s entre {} et {}", transition_type, duration, video1, video2);
    
    let filter = match transition_type.as_str() {
        "fade" => format!("[0:v][0:a][1:v][1:a]xfade=transition=fade:duration={}:offset=0[v][a]", duration),
        "dissolve" => format!("[0:v][0:a][1:v][1:a]xfade=transition=dissolve:duration={}:offset=0[v][a]", duration),
        "wipeleft" => format!("[0:v][0:a][1:v][1:a]xfade=transition=wipeleft:duration={}:offset=0[v][a]", duration),
        _ => format!("[0:v][0:a][1:v][1:a]xfade=transition=fade:duration={}:offset=0[v][a]", duration)
    };
    
    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i")
        .arg(&video1)
        .arg("-i")
        .arg(&video2)
        .arg("-filter_complex")
        .arg(&filter)
        .arg("-map")
        .arg("[v]")
        .arg("-map")
        .arg("[a]")
        .arg("-c:v")
        .arg("libx264")
        .arg("-c:a")
        .arg("aac")
        .arg("-y")
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Erreur lors de l'exécution de FFmpeg: {}", e))?;
    
    if output.status.success() {
        Ok(format!("Transition ajoutée avec succès: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Erreur FFmpeg: {}", error))
    }
}

// Commande pour obtenir les informations d'une vidéo
#[tauri::command]
fn get_video_info(video_path: String) -> Result<String, String> {
    let output = Command::new(sidecar_path("ffprobe"))
        .arg("-v")
        .arg("quiet")
        .arg("-print_format")
        .arg("json")
        .arg("-show_format")
        .arg("-show_streams")
        .arg(&video_path)
        .output()
        .map_err(|e| format!("Erreur lors de l'exécution de FFprobe: {}", e))?;
    
    if output.status.success() {
        let info = String::from_utf8_lossy(&output.stdout);
        Ok(info.to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Erreur FFprobe: {}", error))
    }
}

/// A video clip with its timeline position and duration for export.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportVideoClip {
    path: String,
    duration: f64,
}

/// Export the final project as MP4 by concatenating video clips
/// (trimmed to scene duration, scaled to 1080p) and mixing audio.
/// Runs FFmpeg asynchronously with progress events emitted to the frontend.
#[tauri::command]
async fn export_project(
    app_handle: tauri::AppHandle,
    video_clips: Vec<ExportVideoClip>,
    audio_path: Option<String>,
    output_path: String,
    quality: String,
    total_duration: f64,
) -> Result<String, String> {
    println!("Export to {} with quality {}", output_path, quality);

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
            // Build complex filter: trim each video, scale to 1080p, concat
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

            // Concat all video streams
            for i in 0..video_clips.len() {
                filter.push_str(&format!("[v{i}]"));
            }
            filter.push_str(&format!("concat=n={}:v=1:a=0[vout]", video_clips.len()));

            cmd.arg("-filter_complex").arg(&filter);
            cmd.arg("-map").arg("[vout]");

            if audio_path.is_some() {
                cmd.arg("-map").arg(format!("{}:a", audio_input_index));
            }

            cmd.arg("-c:v").arg("libx264");
            cmd.arg("-preset").arg(&quality);
            cmd.arg("-pix_fmt").arg("yuv420p");

            if audio_path.is_some() {
                cmd.arg("-c:a").arg("aac");
                cmd.arg("-b:a").arg("192k");
                cmd.arg("-shortest");
            }
        } else if audio_path.is_some() {
            // Audio-only export
            cmd.arg("-map").arg("0:a");
            cmd.arg("-c:a").arg("aac");
            cmd.arg("-b:a").arg("192k");
        }

        // Enable machine-readable progress output on stdout
        cmd.arg("-progress").arg("pipe:1");
        cmd.arg("-y").arg(&output_path);

        println!("FFmpeg command: {:?}", cmd);

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
    })
    .await
    .map_err(|e| format!("Export task error: {}", e))?
}

/// Pexels API response structures for video search
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

/// Search for a stock video on Pexels and download it to the project directory.
/// Returns the local file path if successful.
/// Skips download if the file already exists.
#[tauri::command]
async fn search_and_download_pexels_video(
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

    // Select the best video file: prefer mp4, HD quality, highest resolution
    let best_file = pexels_data
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
        return Err(format!(
            "Video download failed ({})",
            video_response.status()
        ));
    }

    let video_bytes = video_response
        .bytes()
        .await
        .map_err(|e| format!("Error reading video data: {}", e))?;

    std::fs::write(&output_path, &video_bytes)
        .map_err(|e| format!("Error writing video file: {}", e))?;

    println!(
        "Video saved: {} ({} bytes)",
        output_path.display(),
        video_bytes.len()
    );

    Ok(output_path.to_string_lossy().to_string())
}

/// Extract a thumbnail frame from a video file using FFmpeg.
/// Saves the thumbnail as a JPEG in the project's `cache/` directory.
#[tauri::command]
fn generate_video_thumbnail(video_path: String, thumbnail_path: String) -> Result<String, String> {
    // Create parent directory if needed
    if let Some(parent) = Path::new(&thumbnail_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error creating cache directory: {}", e))?;
    }

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i")
        .arg(&video_path)
        .arg("-ss")
        .arg("1")
        .arg("-vframes")
        .arg("1")
        .arg("-vf")
        .arg("scale=480:-1")
        .arg("-q:v")
        .arg("3")
        .arg("-y")
        .arg(&thumbnail_path)
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
/// Transcodes to 360p H.264 with fast preset for quick loading.
#[tauri::command]
fn generate_video_proxy(video_path: String, proxy_path: String) -> Result<String, String> {
    if let Some(parent) = Path::new(&proxy_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error creating proxy directory: {}", e))?;
    }

    let output = Command::new(sidecar_path("ffmpeg"))
        .arg("-i")
        .arg(&video_path)
        .arg("-vf")
        .arg("scale=-2:360")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("ultrafast")
        .arg("-crf")
        .arg("30")
        .arg("-an")
        .arg("-y")
        .arg(&proxy_path)
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

/// Lire un fichier audio et retourner son contenu en base64
/// Contourne les restrictions du plugin FS en utilisant std::fs directement
#[tauri::command]
fn read_audio_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("Fichier introuvable: {}", file_path));
    }

    let bytes = std::fs::read(path)
        .map_err(|e| format!("Erreur lecture fichier {}: {}", file_path, e))?;

    if bytes.is_empty() {
        return Err(format!("Fichier vide: {}", file_path));
    }

    let b64 = general_purpose::STANDARD.encode(&bytes);

    // Déterminer le type MIME
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

    // Retourner en data URI
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            generate_podcast_script,
            generate_video_scenes,
            generate_voice,
            check_ffmpeg,
            cut_video,
            merge_videos,
            add_transition,
            get_video_info,
            export_project,
            read_audio_file,
            search_and_download_pexels_video,
            generate_video_thumbnail,
            generate_video_proxy
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
