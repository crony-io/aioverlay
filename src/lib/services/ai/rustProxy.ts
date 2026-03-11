import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ---------------------------------------------------------------------------
// Types matching the Rust StreamEvent / StreamRequest structs
// ---------------------------------------------------------------------------

interface StreamRequest {
  requestId: string;
  provider: string;
  model: string;
  body: string;
  localBaseUrl?: string;
}

interface StreamEvent {
  requestId: string;
  data: string;
  done: boolean;
  error?: string;
  status?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stream an AI request through the Rust HTTP proxy.
 *
 * - The API key is **never** sent from the frontend.
 *   Rust reads it from its in-memory `SecureKeyStore`.
 * - The HTTP request is made by the Rust process, not the webview,
 *   so keys never appear in browser networking or dev tools.
 *
 * @param request  Provider, model, and pre-formatted JSON body.
 * @param onData   Called with each raw SSE text chunk from the API.
 * @returns        A promise that resolves when streaming completes,
 *                 and an abort handle.
 */
export function streamViaRust(
  request: Omit<StreamRequest, 'requestId'>,
  onData: (rawChunk: string) => void
): { result: Promise<void>; handle: { abort: () => void } } {
  const requestId = crypto.randomUUID();
  let unlisten: UnlistenFn | null = null;

  const result = new Promise<void>((resolve, reject) => {
    // Listen for stream events BEFORE starting the request
    listen<StreamEvent>(`ai-stream-${requestId}`, (event) => {
      const { data, done, error } = event.payload;

      if (data) {
        onData(data);
      }

      if (done) {
        unlisten?.();
        if (error) {
          if (error === 'Aborted') {
            reject(new DOMException('Aborted', 'AbortError'));
          } else {
            reject(new Error(error));
          }
        } else {
          resolve();
        }
      }
    }).then((fn) => {
      unlisten = fn;
      // Now start the Rust-side stream
      invoke('stream_ai_request', {
        request: { requestId, ...request }
      }).catch((e: unknown) => {
        reject(new Error(String(e)));
        unlisten?.();
      });
    });
  });

  return {
    result,
    handle: {
      abort: () => {
        invoke('cancel_ai_stream', { requestId }).catch(() => {});
        unlisten?.();
      }
    }
  };
}

/**
 * Push a provider's API key into Rust's secure in-memory store.
 * Called once on app init (for existing keys) and on every save/remove.
 */
export async function storeProviderKey(provider: string, key: string): Promise<void> {
  await invoke('store_provider_key', { provider, key });
}
