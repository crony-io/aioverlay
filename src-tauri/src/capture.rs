use base64::{Engine, engine::general_purpose::STANDARD};
use image::ImageFormat;
use serde::Serialize;
use std::io::Cursor;
use xcap::Monitor;

#[derive(Serialize)]
pub struct ScreenshotResult {
    /// Base64-encoded PNG image data
    pub data: String,
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
}

/// Capture the primary monitor's screen and return it as a base64-encoded PNG.
#[tauri::command]
pub fn take_screenshot() -> Result<ScreenshotResult, String> {
    let monitors = Monitor::all().map_err(|e| format!("Failed to enumerate monitors: {e}"))?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or_else(|| "No monitor found".to_string())?;

    let image =
        monitor.capture_image().map_err(|e| format!("Failed to capture screenshot: {e}"))?;

    let width = image.width();
    let height = image.height();

    let mut buffer = Cursor::new(Vec::new());
    image
        .write_to(&mut buffer, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {e}"))?;

    let base64_data = STANDARD.encode(buffer.into_inner());

    Ok(ScreenshotResult { data: base64_data, width, height })
}
