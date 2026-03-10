import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { DownloadProgress } from '$lib/services/local/types';

/** Callback invoked on each download progress event */
export type DownloadProgressHandler = (progress: DownloadProgress) => void;

/**
 * Subscribe to llama-server download progress events from the Rust backend.
 * Returns an unlisten function to stop listening.
 */
export async function onDownloadProgress(handler: DownloadProgressHandler): Promise<UnlistenFn> {
  return listen<DownloadProgress>('llama-download-progress', (event) => {
    handler(event.payload);
  });
}
