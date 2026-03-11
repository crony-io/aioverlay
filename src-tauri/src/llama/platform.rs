use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

/// Pinned llama.cpp release tag
pub const LLAMA_RELEASE_TAG: &str = "b8261";

/// GitHub release download base URL
pub const GITHUB_RELEASE_BASE: &str = "https://github.com/ggml-org/llama.cpp/releases/download";

/// Subdirectory within AppData for llama-server installation
pub const LLAMA_INSTALL_DIR: &str = "llama-server";

/// Metadata file tracking the current installation
pub const INSTALL_META_FILE: &str = "install.json";

/// GPU information detected on the current system
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub has_nvidia: bool,
    pub nvidia_name: Option<String>,
    pub has_metal: bool,
    pub os: String,
    pub arch: String,
}

/// A downloadable llama.cpp variant for the current platform
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlamaVariant {
    pub id: String,
    pub label: String,
    pub gpu_type: String,
    pub asset_names: Vec<String>,
    pub recommended: bool,
    pub size_mb: u32,
}

/// Persisted metadata about the current llama-server installation
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallMeta {
    pub variant_id: String,
    pub version: String,
    pub binary_path: String,
}

/// Status returned to the frontend about the current installation
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallStatus {
    pub installed: bool,
    pub variant_id: Option<String>,
    pub version: Option<String>,
    pub binary_path: Option<String>,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Detect GPU capabilities without requiring admin permissions.
fn detect_gpu_internal() -> GpuInfo {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let mut info = GpuInfo {
        has_nvidia: false,
        nvidia_name: None,
        has_metal: cfg!(target_os = "macos"),
        os,
        arch,
    };

    // Try nvidia-smi (available on all platforms when NVIDIA drivers are installed)
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name", "--format=csv,noheader,nounits"])
        .output()
    {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() {
                info.has_nvidia = true;
                info.nvidia_name = Some(name);
            }
        }
    }

    info
}

/// Build the full download URL for a release asset.
pub fn asset_download_url(tag: &str, asset_name: &str) -> String {
    format!("{GITHUB_RELEASE_BASE}/{tag}/{asset_name}")
}

/// Return the installation root directory: `{app_data}/llama-server/`
pub fn install_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve AppData directory: {e}"))?;
    Ok(base.join(LLAMA_INSTALL_DIR))
}

/// Return the path to the install metadata JSON file.
pub fn install_meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(install_dir(app)?.join(INSTALL_META_FILE))
}

/// Expected binary name for the current platform.
pub fn server_binary_name() -> &'static str {
    if cfg!(target_os = "windows") { "llama-server.exe" } else { "llama-server" }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Detect GPU hardware on the current machine.
#[tauri::command]
pub fn detect_gpu() -> GpuInfo {
    detect_gpu_internal()
}

/// Return the list of downloadable llama.cpp variants compatible with the
/// current platform. Variants are ordered with the recommended one first.
#[tauri::command]
pub fn get_available_variants() -> Vec<LlamaVariant> {
    let gpu = detect_gpu_internal();
    let tag = LLAMA_RELEASE_TAG;

    let mut variants: Vec<LlamaVariant> = Vec::new();

    match std::env::consts::OS {
        "windows" => match std::env::consts::ARCH {
            "x86_64" => {
                // CUDA 12.4 (recommended when NVIDIA detected)
                if gpu.has_nvidia {
                    variants.push(LlamaVariant {
                        id: "win-cuda-12.4-x64".into(),
                        label: format!(
                            "NVIDIA CUDA 12.4{}",
                            gpu.nvidia_name
                                .as_deref()
                                .map(|n| format!(" — {n}"))
                                .unwrap_or_default()
                        ),
                        gpu_type: "cuda".into(),
                        asset_names: vec![
                            format!("llama-{tag}-bin-win-cuda-12.4-x64.zip"),
                            format!("cudart-llama-bin-win-cuda-12.4-x64.zip"),
                        ],
                        recommended: true,
                        size_mb: 615,
                    });
                }

                // Vulkan (universal GPU acceleration)
                variants.push(LlamaVariant {
                    id: "win-vulkan-x64".into(),
                    label: "Vulkan (universal GPU)".into(),
                    gpu_type: "vulkan".into(),
                    asset_names: vec![format!("llama-{tag}-bin-win-vulkan-x64.zip")],
                    recommended: !gpu.has_nvidia,
                    size_mb: 52,
                });

                // CUDA 13.1 (alternative for latest drivers)
                if gpu.has_nvidia {
                    variants.push(LlamaVariant {
                        id: "win-cuda-13.1-x64".into(),
                        label: "NVIDIA CUDA 13.1 (latest)".into(),
                        gpu_type: "cuda".into(),
                        asset_names: vec![
                            format!("llama-{tag}-bin-win-cuda-13.1-x64.zip"),
                            format!("cudart-llama-bin-win-cuda-13.1-x64.zip"),
                        ],
                        recommended: false,
                        size_mb: 555,
                    });
                }

                // AMD HIP — only show when no NVIDIA GPU detected
                if !gpu.has_nvidia {
                    variants.push(LlamaVariant {
                        id: "win-hip-radeon-x64".into(),
                        label: "AMD Radeon (HIP/ROCm)".into(),
                        gpu_type: "hip".into(),
                        asset_names: vec![format!("llama-{tag}-bin-win-hip-radeon-x64.zip")],
                        recommended: false,
                        size_mb: 349,
                    });
                }

                // CPU fallback
                variants.push(LlamaVariant {
                    id: "win-cpu-x64".into(),
                    label: "CPU only (no GPU)".into(),
                    gpu_type: "cpu".into(),
                    asset_names: vec![format!("llama-{tag}-bin-win-cpu-x64.zip")],
                    recommended: false,
                    size_mb: 35,
                });
            }
            "aarch64" => {
                variants.push(LlamaVariant {
                    id: "win-cpu-arm64".into(),
                    label: "Windows ARM64 (CPU)".into(),
                    gpu_type: "cpu".into(),
                    asset_names: vec![format!("llama-{tag}-bin-win-cpu-arm64.zip")],
                    recommended: true,
                    size_mb: 28,
                });
            }
            _ => {}
        },

        "macos" => match std::env::consts::ARCH {
            "aarch64" => {
                variants.push(LlamaVariant {
                    id: "macos-arm64".into(),
                    label: "Apple Silicon (Metal GPU)".into(),
                    gpu_type: "metal".into(),
                    asset_names: vec![format!("llama-{tag}-bin-macos-arm64.tar.gz")],
                    recommended: true,
                    size_mb: 36,
                });
            }
            "x86_64" => {
                variants.push(LlamaVariant {
                    id: "macos-x64".into(),
                    label: "Intel Mac".into(),
                    gpu_type: "cpu".into(),
                    asset_names: vec![format!("llama-{tag}-bin-macos-x64.tar.gz")],
                    recommended: true,
                    size_mb: 93,
                });
            }
            _ => {}
        },

        "linux" => {
            // Vulkan (best GPU option for Linux – works with NVIDIA & AMD)
            variants.push(LlamaVariant {
                id: "ubuntu-vulkan-x64".into(),
                label: "Vulkan (universal GPU)".into(),
                gpu_type: "vulkan".into(),
                asset_names: vec![format!("llama-{tag}-bin-ubuntu-vulkan-x64.tar.gz")],
                recommended: gpu.has_nvidia,
                size_mb: 46,
            });

            // AMD ROCm
            variants.push(LlamaVariant {
                id: "ubuntu-rocm-7.2-x64".into(),
                label: "AMD ROCm 7.2".into(),
                gpu_type: "rocm".into(),
                asset_names: vec![format!("llama-{tag}-bin-ubuntu-rocm-7.2-x64.tar.gz")],
                recommended: false,
                size_mb: 149,
            });

            // CPU fallback
            variants.push(LlamaVariant {
                id: "ubuntu-x64".into(),
                label: "CPU only (no GPU)".into(),
                gpu_type: "cpu".into(),
                asset_names: vec![format!("llama-{tag}-bin-ubuntu-x64.tar.gz")],
                recommended: !gpu.has_nvidia,
                size_mb: 29,
            });
        }

        _ => {}
    }

    variants
}

/// Check whether llama-server is already installed and return its status.
#[tauri::command]
pub fn get_install_status(app: tauri::AppHandle) -> InstallStatus {
    let meta_path = match install_meta_path(&app) {
        Ok(p) => p,
        Err(_) => {
            return InstallStatus {
                installed: false,
                variant_id: None,
                version: None,
                binary_path: None,
            };
        }
    };

    if !meta_path.exists() {
        return InstallStatus {
            installed: false,
            variant_id: None,
            version: None,
            binary_path: None,
        };
    }

    let data = match std::fs::read_to_string(&meta_path) {
        Ok(d) => d,
        Err(_) => {
            return InstallStatus {
                installed: false,
                variant_id: None,
                version: None,
                binary_path: None,
            };
        }
    };

    match serde_json::from_str::<InstallMeta>(&data) {
        Ok(meta) => {
            let binary_exists = std::path::Path::new(&meta.binary_path).exists();
            InstallStatus {
                installed: binary_exists,
                variant_id: Some(meta.variant_id),
                version: Some(meta.version),
                binary_path: if binary_exists { Some(meta.binary_path) } else { None },
            }
        }
        Err(_) => {
            InstallStatus { installed: false, variant_id: None, version: None, binary_path: None }
        }
    }
}
