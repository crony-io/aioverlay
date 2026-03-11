use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Initialize the global-shortcut plugin.
/// Does NOT register any shortcuts — the frontend calls `update_global_shortcuts`
/// with the user's configured bindings after reading localStorage.
pub fn init_plugin(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|_app, _shortcut, _event| {})
            .build(),
    )?;
    Ok(())
}

/// Normalize an accelerator string to canonical PascalCase form.
/// e.g. "alt+c" → "Alt+C", "commandorcontrol+n" → "CommandOrControl+N"
fn normalize_accelerator(s: &str) -> String {
    s.split('+')
        .map(|part| {
            let lower = part.trim().to_lowercase();
            match lower.as_str() {
                "alt" | "option" => "Alt".to_string(),
                "shift" => "Shift".to_string(),
                "control" | "ctrl" => "Control".to_string(),
                "commandorcontrol" => "CommandOrControl".to_string(),
                "super" | "meta" | "command" | "cmd" => "Super".to_string(),
                other => other.to_uppercase(),
            }
        })
        .collect::<Vec<_>>()
        .join("+")
}

/// Register a single global shortcut that emits a Tauri event when pressed.
fn register_one(handle: &AppHandle, accelerator: &str) -> Result<String, String> {
    let canonical = normalize_accelerator(accelerator);

    let shortcut: Shortcut =
        canonical.parse().map_err(|_| format!("Invalid shortcut format: {}", accelerator))?;

    let name = canonical.clone();
    let h = handle.clone();

    handle
        .global_shortcut()
        .on_shortcut(shortcut, move |_app, _scut, event| {
            if let ShortcutState::Pressed = event.state() {
                let _ = h.emit("global-shortcut-event", name.as_str());
            }
        })
        .map_err(|e| format!("{}", e))?;

    Ok(canonical)
}

/// Tauri command: re-register global shortcuts when the user changes bindings.
/// Accepts a list of accelerator strings (e.g. ["Alt+C", "Alt+S", "Alt+A"]).
/// Returns the list of successfully registered shortcuts.
#[tauri::command]
pub fn update_global_shortcuts(
    app: AppHandle,
    shortcuts: Vec<String>,
) -> Result<Vec<String>, String> {
    app.global_shortcut().unregister_all().map_err(|e| format!("Failed to unregister: {}", e))?;

    let mut registered = Vec::new();
    let mut errors = Vec::new();

    for s in &shortcuts {
        match register_one(&app, s) {
            Ok(canonical) => registered.push(canonical),
            Err(e) => errors.push(format!("{}: {}", s, e)),
        }
    }

    if !errors.is_empty() {
        return Err(format!("Some shortcuts failed: {}", errors.join("; ")));
    }

    Ok(registered)
}
