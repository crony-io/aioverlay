use base64::{Engine as _, engine::general_purpose};
use std::io::Cursor;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use xcap::Monitor;

#[tauri::command]
pub async fn start_screenshot_mode(app: AppHandle) -> Result<(), String> {
    // Close any leftover overlay windows from a previous session
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if label.starts_with("screenshot-overlay-") {
            let _ = window.close();
        }
    }

    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    for (i, monitor) in monitors.iter().enumerate() {
        let label = format!("screenshot-overlay-{}", i);
        let x = monitor.x().unwrap_or(0);
        let y = monitor.y().unwrap_or(0);
        let width = monitor.width().unwrap_or(0);
        let height = monitor.height().unwrap_or(0);

        let url = format!("/overlay?monitor={}&x={}&y={}&w={}&h={}", i, x, y, width, height);

        let _ = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .position(x as f64, y as f64)
            .inner_size(width as f64, height as f64)
            .build();
    }

    Ok(())
}

/// Capture a region of the screen.
///
/// Returns `Ok(())` immediately so the overlay window receives the IPC
/// response *before* it is destroyed (avoids PostMessage / invalid-handle
/// errors on Windows).  The heavy work (close overlays → wait → capture →
/// emit → show main window) runs in a spawned async task.
#[tauri::command]
pub fn capture_region(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        // Close all overlay windows
        let windows = app.webview_windows();
        for (label, window) in windows.iter() {
            if label.starts_with("screenshot-overlay-") {
                let _ = window.close();
            }
        }

        // Give OS time to close the windows (avoid capturing the overlay itself)
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;

        let monitors = match Monitor::all() {
            Ok(m) => m,
            Err(_) => {
                show_main_window(&app);
                return;
            }
        };

        for monitor in monitors {
            let mx = monitor.x().unwrap_or(0) as f64;
            let my = monitor.y().unwrap_or(0) as f64;
            let mw = monitor.width().unwrap_or(0) as f64;
            let mh = monitor.height().unwrap_or(0) as f64;

            if x >= mx && x < mx + mw && y >= my && y < my + mh {
                let image = match monitor.capture_image() {
                    Ok(img) => img,
                    Err(_) => {
                        show_main_window(&app);
                        return;
                    }
                };

                let rel_x = (x - mx) as u32;
                let rel_y = (y - my) as u32;
                let mut w = width as u32;
                let mut h = height as u32;

                if rel_x + w > image.width() {
                    w = image.width() - rel_x;
                }
                if rel_y + h > image.height() {
                    h = image.height() - rel_y;
                }

                if w == 0 || h == 0 {
                    show_main_window(&app);
                    return;
                }

                let cropped =
                    image::imageops::crop_imm(&image, rel_x, rel_y, w, h).to_image();
                let mut buffer = Cursor::new(Vec::new());
                if cropped
                    .write_to(&mut buffer, image::ImageFormat::Png)
                    .is_err()
                {
                    show_main_window(&app);
                    return;
                }

                let b64 = general_purpose::STANDARD.encode(buffer.into_inner());
                let _ = app.emit("screenshot-captured", &b64);
                show_main_window(&app);
                return;
            }
        }

        // No matching monitor — still show the main window
        show_main_window(&app);
    });

    Ok(())
}

/// Helper: show and focus the main window (best-effort).
fn show_main_window(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[tauri::command]
pub async fn cancel_screenshot_mode(app: AppHandle) -> Result<(), String> {
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if label.starts_with("screenshot-overlay-") {
            let _ = window.close();
        }
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
    }
    Ok(())
}
