mod ai_proxy;
mod capture;
mod input;
mod llama;
mod shortcuts;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|pass| {
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(pass.as_bytes());
                hasher.update(b"aioverlay_salt");
                hasher.finalize().to_vec()
            })
            .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                shortcuts::init_plugin(app)?;
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                tray::create_tray(app)?;
            }
            Ok(())
        })
        .manage(ai_proxy::SecureKeyStore::default())
        .manage(ai_proxy::ActiveStreams::default())
        .invoke_handler(tauri::generate_handler![
            input::simulate_copy,
            capture::start_screenshot_mode,
            capture::capture_region,
            capture::cancel_screenshot_mode,
            shortcuts::update_global_shortcuts,
            ai_proxy::store_provider_key,
            ai_proxy::stream_ai_request,
            ai_proxy::cancel_ai_stream,
            llama::platform::detect_gpu,
            llama::platform::get_available_variants,
            llama::platform::get_install_status,
            llama::download::download_llama_server,
            llama::download::delete_llama_installation,
            llama::process::start_llama_server,
            llama::process::stop_llama_server,
            llama::process::is_llama_server_running,
            llama::models::search_hf_models,
            llama::models::get_model_files,
            llama::models::download_model,
            llama::models::list_downloaded_models,
            llama::models::delete_model,
            llama::models::get_models_dir,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Only kill llama-server when the main window is destroyed (app exit),
                // not when overlay windows (screenshot capture) are closed.
                if window.label() == "main" {
                    llama::process::kill_llama_process();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
