use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

// ---------------------------------------------------------------------------
// Managed state — lives only in Rust process memory
// ---------------------------------------------------------------------------

/// Secure in-memory store for API keys.
/// Keys are pushed here once from the frontend on startup / save,
/// then read exclusively by Rust when making HTTP requests.
/// They never re-enter the webview.
#[derive(Default)]
pub struct SecureKeyStore {
    keys: Mutex<HashMap<String, String>>,
}

/// Tracks active streaming requests so they can be cancelled.
#[derive(Default)]
pub struct ActiveStreams {
    flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

// ---------------------------------------------------------------------------
// Provider endpoint constants
// ---------------------------------------------------------------------------

const OPENAI_URL: &str = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const GEMINI_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Store (or remove) a provider's API key in the secure in-memory store.
#[tauri::command]
pub fn store_provider_key(
    state: State<'_, SecureKeyStore>,
    provider: String,
    key: String,
) -> Result<(), String> {
    let mut keys = state.keys.lock().map_err(|e| e.to_string())?;
    if key.is_empty() {
        keys.remove(&provider);
    } else {
        keys.insert(provider, key);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Streaming request / response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamRequest {
    /// Unique ID — used as the event channel name
    pub request_id: String,
    /// Provider identifier: openai | anthropic | gemini | local
    pub provider: String,
    /// Model ID (used by Gemini to build the URL)
    pub model: String,
    /// Pre-formatted JSON request body (provider-specific)
    pub body: String,
    /// Base URL for the local llama-server (only used when provider == "local")
    pub local_base_url: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StreamEvent {
    pub request_id: String,
    /// Raw SSE text chunk from the API
    pub data: String,
    /// True when the stream has ended (success, error, or abort)
    pub done: bool,
    /// Error message if the stream failed
    pub error: Option<String>,
    /// HTTP status code (sent only on error responses)
    pub status: Option<u16>,
}

// ---------------------------------------------------------------------------
// Stream AI request — the core proxy
// ---------------------------------------------------------------------------

/// Start a streaming AI request through the Rust HTTP layer.
///
/// 1. Reads the API key from `SecureKeyStore` (never touches the webview).
/// 2. Builds the correct URL & auth headers per provider.
/// 3. Streams the raw SSE response back via Tauri events.
///
/// The frontend listens on `ai-stream-{requestId}` for [`StreamEvent`]s.
#[tauri::command]
pub async fn stream_ai_request(
    app: AppHandle,
    key_store: State<'_, SecureKeyStore>,
    streams: State<'_, ActiveStreams>,
    request: StreamRequest,
) -> Result<(), String> {
    let event_name = format!("ai-stream-{}", request.request_id);
    let request_id = request.request_id.clone();

    // --- Look up API key ---
    let api_key = {
        let keys = key_store.keys.lock().map_err(|e| e.to_string())?;
        keys.get(&request.provider).cloned().unwrap_or_default()
    };

    if request.provider != "local" && api_key.is_empty() {
        let _ = app.emit(
            &event_name,
            StreamEvent {
                request_id,
                data: String::new(),
                done: true,
                error: Some(format!(
                    "No API key configured for {}. Please add one in Settings.",
                    request.provider
                )),
                status: None,
            },
        );
        return Ok(());
    }

    // --- Build URL + headers ---
    let (url, headers) = build_request(
        &request.provider,
        &request.model,
        &api_key,
        request.local_base_url.as_deref(),
    )?;

    // --- Register abort flag ---
    let abort_flag = Arc::new(AtomicBool::new(false));
    {
        let mut flags = streams.flags.lock().map_err(|e| e.to_string())?;
        flags.insert(request_id.clone(), abort_flag.clone());
    }

    // --- Make the HTTP request ---
    let client = Client::new();
    let mut req_builder = client.post(&url);
    for (k, v) in &headers {
        req_builder = req_builder.header(k.as_str(), v.as_str());
    }
    req_builder = req_builder.body(request.body);

    let response = match req_builder.send().await {
        Ok(resp) => resp,
        Err(e) => {
            emit_done(&app, &event_name, &request_id, Some(e.to_string()), None);
            cleanup_stream(&streams, &request_id);
            return Ok(());
        }
    };

    // --- Handle non-2xx status ---
    let status_code = response.status().as_u16();
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        let truncated = &body[..body.len().min(300)];
        emit_done(
            &app,
            &event_name,
            &request_id,
            Some(format!(
                "{} API error ({}): {}",
                request.provider, status_code, truncated
            )),
            Some(status_code),
        );
        cleanup_stream(&streams, &request_id);
        return Ok(());
    }

    // --- Stream the response ---
    let mut byte_stream = response.bytes_stream();

    loop {
        // Check abort
        if abort_flag.load(Ordering::Relaxed) {
            emit_done(
                &app,
                &event_name,
                &request_id,
                Some("Aborted".to_string()),
                None,
            );
            break;
        }

        // Use a short timeout so we can periodically check the abort flag
        match tokio::time::timeout(
            std::time::Duration::from_millis(100),
            byte_stream.next(),
        )
        .await
        {
            Ok(Some(Ok(bytes))) => {
                let text = String::from_utf8_lossy(&bytes).to_string();
                let _ = app.emit(
                    &event_name,
                    StreamEvent {
                        request_id: request_id.clone(),
                        data: text,
                        done: false,
                        error: None,
                        status: None,
                    },
                );
            }
            Ok(Some(Err(e))) => {
                emit_done(
                    &app,
                    &event_name,
                    &request_id,
                    Some(e.to_string()),
                    None,
                );
                break;
            }
            Ok(None) => {
                // Stream ended naturally
                emit_done(&app, &event_name, &request_id, None, None);
                break;
            }
            Err(_) => {
                // Timeout — loop back to check abort flag
                continue;
            }
        }
    }

    cleanup_stream(&streams, &request_id);
    Ok(())
}

/// Cancel an active stream by its request ID.
#[tauri::command]
pub fn cancel_ai_stream(
    streams: State<'_, ActiveStreams>,
    request_id: String,
) -> Result<(), String> {
    let flags = streams.flags.lock().map_err(|e| e.to_string())?;
    if let Some(flag) = flags.get(&request_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build the URL and auth headers for a given provider.
fn build_request(
    provider: &str,
    model: &str,
    api_key: &str,
    local_base_url: Option<&str>,
) -> Result<(String, Vec<(String, String)>), String> {
    let mut headers = vec![("Content-Type".to_string(), "application/json".to_string())];

    let url = match provider {
        "openai" => {
            headers.push((
                "Authorization".to_string(),
                format!("Bearer {}", api_key),
            ));
            OPENAI_URL.to_string()
        }
        "anthropic" => {
            headers.push(("x-api-key".to_string(), api_key.to_string()));
            headers.push(("anthropic-version".to_string(), "2023-06-01".to_string()));
            // NOTE: 'anthropic-dangerous-direct-browser-access' is no longer needed
            // because the request originates from Rust, not the browser.
            ANTHROPIC_URL.to_string()
        }
        "gemini" => {
            // Gemini authenticates via URL query parameter
            format!(
                "{}/{}:streamGenerateContent?alt=sse&key={}",
                GEMINI_BASE, model, api_key
            )
        }
        "local" => {
            let base = local_base_url.unwrap_or("http://127.0.0.1:8080");
            format!("{}/v1/chat/completions", base)
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    Ok((url, headers))
}

/// Emit a terminal (done=true) stream event.
fn emit_done(
    app: &AppHandle,
    event_name: &str,
    request_id: &str,
    error: Option<String>,
    status: Option<u16>,
) {
    let _ = app.emit(
        event_name,
        StreamEvent {
            request_id: request_id.to_string(),
            data: String::new(),
            done: true,
            error,
            status,
        },
    );
}

/// Remove a stream's abort flag from the active map.
fn cleanup_stream(streams: &State<'_, ActiveStreams>, request_id: &str) {
    if let Ok(mut flags) = streams.flags.lock() {
        flags.remove(request_id);
    }
}
