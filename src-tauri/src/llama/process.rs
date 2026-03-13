use crate::llama::platform::{install_meta_path, InstallMeta};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows: CREATE_NO_WINDOW prevents a visible console window.
/// DETACHED_PROCESS detaches from the parent's console entirely.
#[cfg(target_os = "windows")]
const DETACHED_NO_WINDOW: u32 = 0x08000000 | 0x00000008;

/// Holds the running llama-server child process so we can stop it on demand.
static LLAMA_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Resolve the binary path from the persisted install metadata.
fn resolve_binary_path(app: &tauri::AppHandle) -> Result<String, String> {
    let meta_path = install_meta_path(app)?;

    if !meta_path.exists() {
        return Err("llama-server is not installed. Please download it first.".into());
    }

    let data = std::fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read install metadata: {e}"))?;

    let meta: InstallMeta =
        serde_json::from_str(&data).map_err(|e| format!("Corrupt install metadata: {e}"))?;

    let binary = std::path::Path::new(&meta.binary_path);
    if !binary.exists() {
        return Err(format!(
            "llama-server binary not found at {}. Please re-download.",
            meta.binary_path
        ));
    }

    Ok(meta.binary_path)
}

/// Start the llama-server process with the given model path and optional port.
/// Returns the port number on success.
#[tauri::command]
pub fn start_llama_server(
    app: tauri::AppHandle,
    model_path: String,
    port: Option<u16>,
    mmproj_path: Option<String>,
) -> Result<u16, String> {
    let mut guard = LLAMA_PROCESS.lock().map_err(|e| e.to_string())?;

    if guard.is_some() {
        return Err("llama-server is already running".into());
    }

    let binary_path = resolve_binary_path(&app)?;
    let actual_port = port.unwrap_or(8080);

    // Use the binary's parent directory as CWD so it can find sibling DLLs
    let binary = std::path::Path::new(&binary_path);
    let working_dir =
        binary.parent().ok_or_else(|| "Cannot determine binary directory".to_string())?;

    let mut cmd = Command::new(&binary_path);
    cmd.current_dir(working_dir).args([
        "--model",
        &model_path,
        "--host",
        "127.0.0.1",
        "--port",
        &actual_port.to_string(),
        "--ctx-size",
        "8192",
        "--n-gpu-layers",
        "999",
    ]);

    if let Some(mp) = mmproj_path {
        cmd.arg("--mmproj").arg(mp);
    }

    // Ensure the process runs silently in the background on all platforms.
    // - Windows: CREATE_NO_WINDOW prevents a visible console window.
    // - All OSes: Redirect stdio to null so there's no terminal attachment.
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(DETACHED_NO_WINDOW);

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn llama-server: {e}"))?;

    *guard = Some(child);

    Ok(actual_port)
}

/// Stop the running llama-server process.
#[tauri::command]
pub fn stop_llama_server() -> Result<(), String> {
    kill_llama_process();
    Ok(())
}

/// Internal helper: kill the llama-server child process if running.
/// Called from both the Tauri command and the app-exit cleanup hook.
pub fn kill_llama_process() {
    let mut guard = match LLAMA_PROCESS.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };

    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        // Reap the process to avoid zombies
        let _ = child.wait();
    }
}

/// Check if the llama-server process is currently running.
#[tauri::command]
pub fn is_llama_server_running() -> bool {
    let mut guard = match LLAMA_PROCESS.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };

    if let Some(child) = guard.as_mut() {
        // try_wait returns Ok(Some(_)) if exited, Ok(None) if still running
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited — clean up the handle
                guard.take();
                false
            }
            Ok(None) => true,
            Err(_) => {
                guard.take();
                false
            }
        }
    } else {
        false
    }
}
