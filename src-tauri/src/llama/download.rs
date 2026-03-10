use crate::llama::platform::{
    asset_download_url, install_dir, install_meta_path, server_binary_name, InstallMeta,
    LLAMA_RELEASE_TAG,
};
use futures_util::StreamExt;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Emitter;

/// Event name emitted to the frontend during download/extraction.
const PROGRESS_EVENT: &str = "llama-download-progress";

/// Payload sent with each progress event.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub asset_index: usize,
    pub total_assets: usize,
    pub asset_name: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    /// One of: "downloading", "extracting", "complete", "error"
    pub phase: String,
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Archive extraction helpers
// ---------------------------------------------------------------------------

/// Extract a `.zip` archive into `dest`, returning the list of extracted paths.
fn extract_zip(archive_path: &Path, dest: &Path) -> Result<Vec<PathBuf>, String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {e}"))?;

    let mut extracted = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry {i}: {e}"))?;

        let out_path = dest.join(
            entry
                .enclosed_name()
                .ok_or_else(|| format!("Invalid zip entry name at index {i}"))?,
        );

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create directory: {e}"))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {e}"))?;
            }
            let mut out_file = std::fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file {}: {e}", out_path.display()))?;
            std::io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("Failed to extract file: {e}"))?;

            // Preserve executable permission on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry.unix_mode() {
                    std::fs::set_permissions(&out_path, std::fs::Permissions::from_mode(mode))
                        .ok();
                }
            }

            extracted.push(out_path);
        }
    }

    Ok(extracted)
}

/// Extract a `.tar.gz` archive into `dest`, returning the list of extracted paths.
fn extract_tar_gz(archive_path: &Path, dest: &Path) -> Result<Vec<PathBuf>, String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open tar.gz: {e}"))?;
    let decompressed = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(decompressed);

    let mut extracted = Vec::new();

    for entry_result in archive
        .entries()
        .map_err(|e| format!("Failed to read tar entries: {e}"))?
    {
        let mut entry = entry_result.map_err(|e| format!("Failed to read tar entry: {e}"))?;
        let out_path = dest.join(
            entry
                .path()
                .map_err(|e| format!("Invalid tar entry path: {e}"))?,
        );

        entry
            .unpack(&out_path)
            .map_err(|e| format!("Failed to unpack tar entry: {e}"))?;

        if out_path.is_file() {
            extracted.push(out_path);
        }
    }

    Ok(extracted)
}

/// Extract an archive (auto-detects zip vs tar.gz by file name).
fn extract_archive(archive_path: &Path, dest: &Path) -> Result<Vec<PathBuf>, String> {
    let name = archive_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();

    if name.ends_with(".zip") {
        extract_zip(archive_path, dest)
    } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        extract_tar_gz(archive_path, dest)
    } else {
        Err(format!("Unsupported archive format: {name}"))
    }
}

/// Recursively search for the llama-server binary in the given directory.
fn find_binary(dir: &Path, binary_name: &str) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.file_name().map(|n| n == binary_name).unwrap_or(false) {
                return Some(path);
            }
            if path.is_dir() {
                if let Some(found) = find_binary(&path, binary_name) {
                    return Some(found);
                }
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Download and install a specific llama.cpp variant.
///
/// Emits `llama-download-progress` events throughout the process so the
/// frontend can render a progress bar.
#[tauri::command]
pub async fn download_llama_server(
    app: tauri::AppHandle,
    variant_id: String,
    asset_names: Vec<String>,
) -> Result<(), String> {
    let dest = install_dir(&app)?;
    let bin_dir = dest.join("bin");

    // Clean previous installation
    if dest.exists() {
        std::fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to clean previous installation: {e}"))?;
    }
    std::fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("Failed to create install directory: {e}"))?;

    let tag = LLAMA_RELEASE_TAG;
    let total_assets = asset_names.len();
    let client = reqwest::Client::new();

    for (idx, asset_name) in asset_names.iter().enumerate() {
        let url = asset_download_url(tag, asset_name);

        // --- Download phase ---
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to start download for {asset_name}: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_msg = format!("Download failed for {asset_name}: HTTP {status}");
            app.emit(
                PROGRESS_EVENT,
                DownloadProgress {
                    asset_index: idx,
                    total_assets,
                    asset_name: asset_name.clone(),
                    bytes_downloaded: 0,
                    total_bytes: 0,
                    phase: "error".into(),
                    error: Some(err_msg.clone()),
                },
            )
            .ok();
            return Err(err_msg);
        }

        let total_bytes = response.content_length().unwrap_or(0);
        let mut bytes_downloaded: u64 = 0;

        let tmp_path = dest.join(asset_name);
        let mut file = tokio::fs::File::create(&tmp_path)
            .await
            .map_err(|e| format!("Failed to create temp file: {e}"))?;

        let mut stream = response.bytes_stream();

        // Throttle events: emit at most every 100ms
        let mut last_emit = std::time::Instant::now();

        while let Some(chunk_result) = stream.next().await {
            let chunk =
                chunk_result.map_err(|e| format!("Download stream error for {asset_name}: {e}"))?;

            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                .await
                .map_err(|e| format!("Failed to write chunk: {e}"))?;

            bytes_downloaded += chunk.len() as u64;

            if last_emit.elapsed().as_millis() >= 100 || bytes_downloaded == total_bytes {
                app.emit(
                    PROGRESS_EVENT,
                    DownloadProgress {
                        asset_index: idx,
                        total_assets,
                        asset_name: asset_name.clone(),
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

        // Flush file
        tokio::io::AsyncWriteExt::flush(&mut file)
            .await
            .map_err(|e| format!("Failed to flush file: {e}"))?;
        drop(file);

        // --- Extract phase ---
        app.emit(
            PROGRESS_EVENT,
            DownloadProgress {
                asset_index: idx,
                total_assets,
                asset_name: asset_name.clone(),
                bytes_downloaded: total_bytes,
                total_bytes,
                phase: "extracting".into(),
                error: None,
            },
        )
        .ok();

        // Extract synchronously (CPU-bound work)
        let bin_dir_clone = bin_dir.clone();
        let tmp_path_clone = tmp_path.clone();
        tokio::task::spawn_blocking(move || extract_archive(&tmp_path_clone, &bin_dir_clone))
            .await
            .map_err(|e| format!("Extraction task panicked: {e}"))?
            .map_err(|e| format!("Extraction failed for {asset_name}: {e}"))?;

        // Remove the downloaded archive to save space
        tokio::fs::remove_file(&tmp_path).await.ok();
    }

    // --- Locate the binary ---
    let binary_name = server_binary_name();
    let binary_path = find_binary(&bin_dir, binary_name).ok_or_else(|| {
        format!("Could not find {binary_name} in extracted files. Installation may be corrupt.")
    })?;

    // On Unix, ensure the binary is executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&binary_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set executable permission: {e}"))?;
    }

    // --- Save install metadata ---
    let meta = InstallMeta {
        variant_id: variant_id.clone(),
        version: tag.to_string(),
        binary_path: binary_path.to_string_lossy().to_string(),
    };

    let meta_json =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("Failed to serialize meta: {e}"))?;
    let meta_path = install_meta_path(&app)?;
    std::fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write install metadata: {e}"))?;

    // --- Complete ---
    app.emit(
        PROGRESS_EVENT,
        DownloadProgress {
            asset_index: total_assets.saturating_sub(1),
            total_assets,
            asset_name: "complete".into(),
            bytes_downloaded: 0,
            total_bytes: 0,
            phase: "complete".into(),
            error: None,
        },
    )
    .ok();

    Ok(())
}

/// Delete the current llama-server installation.
#[tauri::command]
pub async fn delete_llama_installation(app: tauri::AppHandle) -> Result<(), String> {
    let dest = install_dir(&app)?;
    if dest.exists() {
        std::fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to delete installation: {e}"))?;
    }
    Ok(())
}
