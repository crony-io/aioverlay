use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{Emitter, Manager};

const MODELS_DIR: &str = "models";
const MODELS_META_FILE: &str = "models_meta.json";
const MODEL_PROGRESS_EVENT: &str = "model-download-progress";
const HF_API_BASE: &str = "https://huggingface.co/api/models";

// ---------------------------------------------------------------------------
// HuggingFace API types (deserialization from HF responses)
// ---------------------------------------------------------------------------

/// Model returned by the HF search API. Field names are lowercase single
/// words, so they work for both HF JSON (lowercase) and our TS frontend.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HfModelResult {
    pub id: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub downloads: u64,
    #[serde(default)]
    pub likes: i64,
    /// HuggingFace pipeline tag (e.g. "text-generation", "image-text-to-text")
    #[serde(default, rename = "pipeline_tag")]
    pub pipeline_tag: Option<String>,
    /// HuggingFace tags (e.g. ["gguf", "vision", "text-generation"])
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Single entry from the HF tree API.
#[derive(Deserialize, Debug)]
struct HfTreeEntry {
    #[serde(rename = "type")]
    entry_type: String,
    path: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    lfs: Option<HfLfsInfo>,
}

#[derive(Deserialize, Debug)]
struct HfLfsInfo {
    size: u64,
}

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

/// Info about a GGUF file in a HuggingFace repo, sent to the frontend.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GgufFileInfo {
    pub filename: String,
    pub size: u64,
}

/// Metadata for a single downloaded model, persisted in models_meta.json.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedModel {
    pub repo_id: String,
    pub filename: String,
    pub file_path: String,
    pub size: u64,
    pub downloaded_at: String,
    /// HuggingFace pipeline tag — used to determine capabilities (e.g. vision)
    #[serde(default)]
    pub pipeline_tag: Option<String>,
    /// HuggingFace tags — stored for capability detection
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Root of the metadata file.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct ModelsMetadata {
    models: Vec<DownloadedModel>,
}

/// Progress event payload for model downloads.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgress {
    pub filename: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    /// "downloading" | "complete" | "error"
    pub phase: String,
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn models_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| format!("Failed to resolve AppData: {e}"))?;
    Ok(base.join(MODELS_DIR))
}

fn meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(models_dir(app)?.join(MODELS_META_FILE))
}

fn read_meta(app: &tauri::AppHandle) -> ModelsMetadata {
    let path = match meta_path(app) {
        Ok(p) => p,
        Err(_) => return ModelsMetadata::default(),
    };
    if !path.exists() {
        return ModelsMetadata::default();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_meta(app: &tauri::AppHandle, meta: &ModelsMetadata) -> Result<(), String> {
    let dir = models_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create models dir: {e}"))?;
    let path = dir.join(MODELS_META_FILE);
    let json =
        serde_json::to_string_pretty(meta).map_err(|e| format!("Failed to serialize meta: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write meta: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Search HuggingFace for GGUF models.
#[tauri::command]
pub async fn search_hf_models(query: String) -> Result<Vec<HfModelResult>, String> {
    let url =
        format!("{HF_API_BASE}?search={query}&filter=gguf&sort=downloads&direction=-1&limit=20");

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "aioverlay/0.1")
        .send()
        .await
        .map_err(|e| format!("HF API request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HF API returned status {}", response.status()));
    }

    let models: Vec<HfModelResult> =
        response.json().await.map_err(|e| format!("Failed to parse HF response: {e}"))?;

    Ok(models)
}

/// List GGUF files available in a HuggingFace model repository.
#[tauri::command]
pub async fn get_model_files(repo_id: String) -> Result<Vec<GgufFileInfo>, String> {
    let url = format!("{HF_API_BASE}/{repo_id}/tree/main");

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "aioverlay/0.1")
        .send()
        .await
        .map_err(|e| format!("HF tree request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HF tree API returned status {}", response.status()));
    }

    let entries: Vec<HfTreeEntry> =
        response.json().await.map_err(|e| format!("Failed to parse tree response: {e}"))?;

    let gguf_files: Vec<GgufFileInfo> = entries
        .into_iter()
        .filter(|e| e.entry_type == "file" && e.path.ends_with(".gguf"))
        .map(|e| {
            let real_size = e.lfs.as_ref().map(|l| l.size).unwrap_or(e.size);
            GgufFileInfo { filename: e.path, size: real_size }
        })
        .collect();

    Ok(gguf_files)
}

/// Download a GGUF model file from HuggingFace.
///
/// Emits `model-download-progress` events for the frontend progress bar.
#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    repo_id: String,
    filename: String,
) -> Result<DownloadedModel, String> {
    let dir = models_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create models dir: {e}"))?;

    let client = reqwest::Client::new();

    // Fetch model metadata from HF API to capture capabilities (pipeline_tag, tags)
    let (pipeline_tag, tags) = {
        let info_url = format!("{HF_API_BASE}/{repo_id}");
        match client.get(&info_url).header("User-Agent", "aioverlay/0.1").send().await {
            Ok(resp) if resp.status().is_success() => match resp.json::<HfModelResult>().await {
                Ok(info) => (info.pipeline_tag, info.tags),
                Err(_) => (None, Vec::new()),
            },
            _ => (None, Vec::new()),
        }
    };

    let download_url = format!("https://huggingface.co/{repo_id}/resolve/main/{filename}");
    let response = client
        .get(&download_url)
        .header("User-Agent", "aioverlay/0.1")
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let err = format!("Download failed: HTTP {status}");
        app.emit(
            MODEL_PROGRESS_EVENT,
            ModelDownloadProgress {
                filename: filename.clone(),
                bytes_downloaded: 0,
                total_bytes: 0,
                phase: "error".into(),
                error: Some(err.clone()),
            },
        )
        .ok();
        return Err(err);
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let tmp_path = dir.join(format!("{filename}.tmp"));
    let final_path = dir.join(&filename);

    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {e}"))?;

    let mut stream = response.bytes_stream();
    let mut bytes_downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| {
            let err = format!("Download stream error: {e}");
            app.emit(
                MODEL_PROGRESS_EVENT,
                ModelDownloadProgress {
                    filename: filename.clone(),
                    bytes_downloaded,
                    total_bytes,
                    phase: "error".into(),
                    error: Some(err.clone()),
                },
            )
            .ok();
            err
        })?;

        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {e}"))?;

        bytes_downloaded += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 150 || bytes_downloaded == total_bytes {
            app.emit(
                MODEL_PROGRESS_EVENT,
                ModelDownloadProgress {
                    filename: filename.clone(),
                    bytes_downloaded,
                    total_bytes,
                    phase: "downloading".into(),
                    error: None,
                },
            )
            .ok();
            last_emit = std::time::Instant::now();
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(|e| format!("Failed to flush file: {e}"))?;
    drop(file);

    // Rename tmp → final
    tokio::fs::rename(&tmp_path, &final_path)
        .await
        .map_err(|e| format!("Failed to finalize model file: {e}"))?;

    // Build metadata entry
    let now = chrono_now();
    let model = DownloadedModel {
        repo_id: repo_id.clone(),
        filename: filename.clone(),
        file_path: final_path.to_string_lossy().to_string(),
        size: bytes_downloaded,
        downloaded_at: now,
        pipeline_tag,
        tags,
    };

    // Update metadata file
    let mut meta = read_meta(&app);
    meta.models.retain(|m| m.filename != filename);
    meta.models.push(model.clone());
    write_meta(&app, &meta)?;

    // Emit completion
    app.emit(
        MODEL_PROGRESS_EVENT,
        ModelDownloadProgress {
            filename,
            bytes_downloaded,
            total_bytes,
            phase: "complete".into(),
            error: None,
        },
    )
    .ok();

    Ok(model)
}

/// List all downloaded GGUF models.
#[tauri::command]
pub fn list_downloaded_models(app: tauri::AppHandle) -> Vec<DownloadedModel> {
    let mut meta = read_meta(&app);
    // Prune entries whose files no longer exist on disk
    meta.models.retain(|m| std::path::Path::new(&m.file_path).exists());
    // Persist the pruned list (ignore write errors)
    let _ = write_meta(&app, &meta);
    meta.models
}

/// Delete a downloaded model by filename.
#[tauri::command]
pub fn delete_model(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let dir = models_dir(&app)?;
    let path = dir.join(&filename);

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete model: {e}"))?;
    }

    let mut meta = read_meta(&app);
    meta.models.retain(|m| m.filename != filename);
    write_meta(&app, &meta)?;

    Ok(())
}

/// Return the absolute path to the models directory.
#[tauri::command]
pub fn get_models_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = models_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create models dir: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/// Simple ISO-8601 timestamp without pulling in the `chrono` crate.
fn chrono_now() -> String {
    let dur =
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    // Return Unix timestamp as a string (good enough for sorting)
    format!("{secs}")
}
