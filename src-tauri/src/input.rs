use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

/// Simulate Ctrl+C (or Cmd+C on macOS) to copy the current selection to clipboard.
/// Includes a small delay to let the OS process the keystrokes.
#[tauri::command]
pub fn simulate_copy() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    // Small delay to ensure the overlay window isn't interfering
    thread::sleep(Duration::from_millis(50));

    enigo.key(modifier, Direction::Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Unicode('c'), Direction::Click).map_err(|e| e.to_string())?;
    enigo.key(modifier, Direction::Release).map_err(|e| e.to_string())?;

    // Wait for clipboard to be populated
    thread::sleep(Duration::from_millis(100));

    Ok(())
}
