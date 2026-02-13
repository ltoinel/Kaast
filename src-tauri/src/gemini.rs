/// Gemini API integration for podcast script generation, video scene analysis,
/// and text-to-speech voice synthesis.

use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Gemini text generation structures
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct GeminiRequest {
    pub contents: Vec<GeminiContent>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GeminiContent {
    pub parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GeminiPart {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline_data: Option<InlineData>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct InlineData {
    pub mime_type: String,
    pub data: String,
}

#[derive(Deserialize)]
pub struct GeminiResponse {
    pub candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
pub struct GeminiCandidate {
    pub content: GeminiResponseContent,
}

#[derive(Deserialize)]
pub struct GeminiResponseContent {
    pub parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
pub struct GeminiResponsePart {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default, rename = "inline_data")]
    pub _inline_data: Option<InlineData>,
}

// ---------------------------------------------------------------------------
// Gemini audio generation structures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Generate text-to-speech audio using Gemini 2.0 Flash TTS.
/// Returns the path to the generated WAV file.
#[tauri::command]
pub async fn generate_voice(text: String, api_key: String, output_path: String, language: String, voice_style_prompt: String) -> Result<String, String> {
    println!("Gemini Flash voice generation for {} characters", text.len());

    if text.trim().is_empty() {
        return Err("Text cannot be empty".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Client creation error: {}", e))?;

    let prompt = format!(
        "{}\n\nText to read in {}:\n\n{}",
        voice_style_prompt, language, text
    );

    let request_body = GeminiAudioRequest {
        contents: vec![GeminiAudioContent {
            parts: vec![GeminiTextPart { text: prompt }],
        }],
        generation_config: GeminiAudioConfig {
            response_modalities: vec!["AUDIO".to_string()],
            speech_config: SpeechConfig {
                voice_config: VoiceConfig {
                    prebuilt_voice_config: PrebuiltVoiceConfig {
                        voice_name: "Kore".to_string(),
                    },
                },
            },
        },
    };

    let api_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={}",
        api_key
    );

    println!("Calling Gemini TTS API for audio generation...");

    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Gemini API call error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Gemini API error ({}): {}", status, error_text));
    }

    let gemini_response: GeminiAudioResponse = response
        .json()
        .await
        .map_err(|e| format!("Gemini response parsing error: {}", e))?;

    if let Some(error) = gemini_response.error {
        return Err(format!("Gemini error: {}", error.message));
    }

    let candidates = gemini_response.candidates
        .ok_or("No candidates in Gemini response")?;

    if candidates.is_empty() {
        return Err("Empty Gemini response".to_string());
    }

    let mut all_audio_data: Vec<u8> = Vec::new();

    for part in &candidates[0].content.parts {
        if let Some(ref inline_data) = part.inline_data {
            println!("Audio found, mime_type: {}", inline_data.mime_type);
            let audio_data = general_purpose::STANDARD
                .decode(&inline_data.data)
                .map_err(|e| format!("Base64 audio decoding error: {}", e))?;
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

    let wav_data = build_wav_data(&all_audio_data, sample_rate);

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

/// Build a WAV file (PCM 16-bit mono) from raw audio samples.
fn build_wav_data(audio_data: &[u8], sample_rate: u32) -> Vec<u8> {
    let channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * channels as u32 * bits_per_sample as u32 / 8;
    let block_align = channels * bits_per_sample / 8;
    let data_size = audio_data.len() as u32;

    let mut wav = Vec::with_capacity(44 + audio_data.len());
    // RIFF header
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_size).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    // fmt sub-chunk
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bits_per_sample.to_le_bytes());
    // data sub-chunk
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    wav.extend_from_slice(audio_data);

    wav
}

/// Generate a podcast script from a web URL using Gemini API.
/// Fetches the page content, extracts text, and sends it to Gemini
/// with the provided style prompt.
#[tauri::command]
pub async fn generate_podcast_script(url: String, api_key: String, style_prompt: String, language: String) -> Result<String, String> {
    println!("Generating podcast script from: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client creation error: {}", e))?;

    let html = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download error: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Content reading error: {}", e))?;

    // Extract main text with scraper in a blocking thread
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
            return Err("Unable to extract site content".to_string());
        }
        // Limit to 5000 characters to avoid token overflow
        let content = if content.len() > 5000 {
            content.chars().take(5000).collect::<String>()
        } else {
            content
        };
        Ok(content)
    })
    .await
    .map_err(|e| format!("Extraction thread error: {}", e))??;

    let prompt = format!("{}\n\nWrite the podcast script in {}.\n\nSource content:\n{}\n\nPodcast script:", style_prompt, language, content);

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
        .map_err(|e| format!("Gemini API call error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status, error_text));
    }

    let gemini_response: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Response parsing error: {}", e))?;

    let script = gemini_response
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .and_then(|p| p.text.clone())
        .ok_or_else(|| "No script generated".to_string())?;

    Ok(script)
}

/// Generate video scene suggestions from a podcast script using Gemini API.
/// Returns a JSON array of scenes with descriptions, durations, and search keywords.
#[tauri::command]
pub async fn generate_video_scenes(script: String, api_key: String, total_duration: f64, max_scene_duration: u32, language: String, scene_style_prompt: String) -> Result<String, String> {
    println!("Generating video scenes from script (total duration: {}s, max per scene: {}s)...", total_duration, max_scene_duration);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Client creation error: {}", e))?;

    let prompt = format!(
        "{scene_style}\n\n\
        Analyze this podcast script and identify video scenes that could visually illustrate it.\n\
        The TOTAL audio duration is {:.0} seconds. The sum of all scene durations MUST equal exactly {:.0} seconds.\n\
        For each scene, provide:\n\
        - description: short visual description of the scene in {lang} (max 100 characters)\n\
        - duration: duration in seconds (integer, minimum 4, MAXIMUM {max_scene} seconds per scene). Sum of all durations = {total:.0}s\n\
        - scriptExcerpt: the script excerpt this scene illustrates in {lang} (max 150 characters)\n\
        - searchKeywords: 2 to 4 keywords ALWAYS in English to search for matching stock video (e.g. \"aerial city skyline\", \"scientist laboratory research\")\n\n\
        IMPORTANT: The JSON keys must always be in English. The searchKeywords value must always be in English. \
        The description and scriptExcerpt values must be written in {lang}.\n\n\
        Return ONLY a valid JSON array, with no text before or after.\n\n\
        Script:\n{script}",
        total_duration, total_duration,
        scene_style = scene_style_prompt,
        lang = language,
        max_scene = max_scene_duration,
        total = total_duration,
        script = script
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
        .map_err(|e| format!("Gemini API call error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status, error_text));
    }

    let gemini_response: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Response parsing error: {}", e))?;

    let raw_text = gemini_response
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .and_then(|p| p.text.clone())
        .ok_or_else(|| "No scenes generated".to_string())?;

    // Extract JSON from text (may be wrapped in ```json ... ```)
    let json_text = if let Some(start) = raw_text.find('[') {
        if let Some(end) = raw_text.rfind(']') {
            &raw_text[start..=end]
        } else {
            &raw_text
        }
    } else {
        &raw_text
    };

    // Validate JSON
    let _: serde_json::Value = serde_json::from_str(json_text)
        .map_err(|e| format!("Invalid JSON response: {}", e))?;

    Ok(json_text.to_string())
}
