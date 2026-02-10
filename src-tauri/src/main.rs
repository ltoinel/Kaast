// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

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
    #[serde(default)]
    inline_data: Option<InlineData>,
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
        return Err("Aucune donnée audio dans la réponse Gemini".to_string());
    }
    
    // Créer le répertoire parent si nécessaire
    if let Some(parent) = std::path::Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Erreur création répertoire: {}", e))?;
    }
    
    // Déterminer l'extension appropriée (Gemini retourne généralement du WAV ou PCM)
    // On sauvegarde en .wav si c'est du PCM
    let final_output_path = if output_path.ends_with(".mp3") {
        output_path.replace(".mp3", ".wav")
    } else {
        output_path.clone()
    };
    
    // Sauvegarder le fichier audio
    std::fs::write(&final_output_path, &all_audio_data)
        .map_err(|e| format!("Erreur écriture fichier: {}", e))?;
    
    println!("Audio généré: {} ({} bytes)", final_output_path, all_audio_data.len());
    Ok(final_output_path)
}

// Générer un script de podcast à partir d'une URL avec Gemini API
#[tauri::command]
async fn generate_podcast_script(url: String, api_key: String) -> Result<String, String> {
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
    
    // 3. Appeler Gemini API
    let prompt = format!(
        "Tu es un scénariste de podcast professionnel. À partir du contenu suivant extrait d'un site web, crée un script de podcast captivant et informatif.\n\n\
        Le script doit:\n\
        - Avoir une introduction accrocheuse\n\
        - Présenter les points clés de manière conversationnelle\n\
        - Inclure des transitions naturelles\n\
        - Se terminer par une conclusion mémorable\n\
        - Durer environ 5-10 minutes à la lecture\n\
        - Être écrit en français\n\n\
        Contenu source:\n{}\n\n\
        Script de podcast:",
        content
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
async fn generate_video_scenes(script: String, api_key: String) -> Result<String, String> {
    println!("Génération de scènes vidéo depuis le script...");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Erreur création client: {}", e))?;

    let prompt = format!(
        "Analyse ce script de podcast et identifie des scènes vidéo qui pourraient l'illustrer visuellement.\n\
        Pour chaque scène, donne:\n\
        - description: description visuelle courte de la scène (max 100 caractères)\n\
        - duration: durée suggérée en secondes (entre 5 et 20)\n\
        - scriptExcerpt: l'extrait du script que cette scène illustre (max 150 caractères)\n\n\
        Retourne UNIQUEMENT un tableau JSON valide, sans texte avant ou après.\n\
        Identifie entre 5 et 15 scènes.\n\n\
        Script:\n{}",
        script
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

// Commande pour exporter le projet final en MP4
#[tauri::command]
fn export_project(clips: Vec<String>, output_path: String, quality: String) -> Result<String, String> {
    println!("Export du projet vers {} avec qualité {}", output_path, quality);
    
    if clips.is_empty() {
        return Err("Aucun clip à exporter".to_string());
    }
    
    if clips.len() == 1 {
        let output = Command::new(sidecar_path("ffmpeg"))
            .arg("-i")
            .arg(&clips[0])
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg(&quality)
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("192k")
            .arg("-y")
            .arg(&output_path)
            .output()
            .map_err(|e| format!("Erreur lors de l'exécution de FFmpeg: {}", e))?;
        
        if output.status.success() {
            return Ok(format!("Projet exporté avec succès: {}", output_path));
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Erreur FFmpeg: {}", error));
        }
    }
    
    let list_path = Path::new(&output_path)
        .parent()
        .unwrap_or(Path::new("."))
        .join("export_list.txt");
    
    let mut list_content = String::new();
    for path in &clips {
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
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg(&quality)
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("192k")
        .arg("-y")
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Erreur lors de l'exécution de FFmpeg: {}", e))?;
    
    let _ = std::fs::remove_file(&list_path);
    
    if output.status.success() {
        Ok(format!("Projet exporté avec succès: {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Erreur FFmpeg: {}", error))
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
            read_audio_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
