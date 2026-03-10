import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  HfModelResult,
  GgufFileInfo,
  DownloadedModel,
  ModelDownloadProgress
} from '$lib/services/local/types';

const ACTIVE_MODEL_KEY = 'activeModelFilename';

// ---------------------------------------------------------------------------
// HuggingFace API
// ---------------------------------------------------------------------------

/** Search HuggingFace for GGUF models */
export async function searchHfModels(query: string): Promise<HfModelResult[]> {
  return invoke<HfModelResult[]>('search_hf_models', { query });
}

/** List GGUF files available in a HuggingFace model repository */
export async function getModelFiles(repoId: string): Promise<GgufFileInfo[]> {
  return invoke<GgufFileInfo[]>('get_model_files', { repoId });
}

// ---------------------------------------------------------------------------
// Download / Delete
// ---------------------------------------------------------------------------

/** Download a GGUF model file from HuggingFace */
export async function downloadModel(repoId: string, filename: string): Promise<DownloadedModel> {
  return invoke<DownloadedModel>('download_model', { repoId, filename });
}

/** List all downloaded GGUF models (prunes stale entries) */
export async function listDownloadedModels(): Promise<DownloadedModel[]> {
  return invoke<DownloadedModel[]>('list_downloaded_models');
}

/** Delete a downloaded model by filename */
export async function deleteModel(filename: string): Promise<void> {
  await invoke('delete_model', { filename });
}

/** Get the absolute path to the models directory */
export async function getModelsDir(): Promise<string> {
  return invoke<string>('get_models_dir');
}

// ---------------------------------------------------------------------------
// Progress events
// ---------------------------------------------------------------------------

/** Subscribe to model download progress events */
export async function onModelDownloadProgress(
  handler: (progress: ModelDownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<ModelDownloadProgress>('model-download-progress', (event) => {
    handler(event.payload);
  });
}

// ---------------------------------------------------------------------------
// Active model (localStorage)
// ---------------------------------------------------------------------------

/** Get the currently active model filename */
export function getActiveModelFilename(): string {
  return localStorage.getItem(ACTIVE_MODEL_KEY) || '';
}

/** Set the active model filename */
export function setActiveModelFilename(filename: string): void {
  localStorage.setItem(ACTIVE_MODEL_KEY, filename);
}

/** Clear the active model */
export function clearActiveModel(): void {
  localStorage.removeItem(ACTIVE_MODEL_KEY);
}

/** Format bytes to a human-readable string (e.g. "2.3 GB") */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
