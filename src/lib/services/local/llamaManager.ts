import { invoke } from '@tauri-apps/api/core';
import type { GpuInfo, LlamaVariant, InstallStatus } from '$lib/services/local/types';

const STORAGE_KEYS = {
  MODEL_PATH: 'localModelPath',
  PORT: 'localServerPort'
} as const;

const DEFAULT_PORT = 8080;

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

/** Get saved model path from localStorage */
export function getSavedModelPath(): string {
  return localStorage.getItem(STORAGE_KEYS.MODEL_PATH) || '';
}

/** Get saved port from localStorage with NaN/range validation */
export function getSavedPort(): number {
  const stored = localStorage.getItem(STORAGE_KEYS.PORT);
  if (!stored) return DEFAULT_PORT;

  const parsed = parseInt(stored, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) return DEFAULT_PORT;

  return parsed;
}

/** Save model path to localStorage */
export function saveModelPath(path: string): void {
  localStorage.setItem(STORAGE_KEYS.MODEL_PATH, path);
}

/** Save port to localStorage */
export function savePort(port: number): void {
  localStorage.setItem(STORAGE_KEYS.PORT, port.toString());
}

// ---------------------------------------------------------------------------
// Platform / GPU detection
// ---------------------------------------------------------------------------

/** Detect GPU hardware on the current machine */
export async function detectGpu(): Promise<GpuInfo> {
  return invoke<GpuInfo>('detect_gpu');
}

/** Get available llama.cpp variants for the current platform */
export async function getAvailableVariants(): Promise<LlamaVariant[]> {
  return invoke<LlamaVariant[]>('get_available_variants');
}

/** Check whether llama-server is installed and return its status */
export async function getInstallStatus(): Promise<InstallStatus> {
  return invoke<InstallStatus>('get_install_status');
}

// ---------------------------------------------------------------------------
// Download / Install
// ---------------------------------------------------------------------------

/** Download and install a specific llama.cpp variant */
export async function downloadLlamaServer(
  variantId: string,
  version: string,
  assetNames: string[]
): Promise<void> {
  await invoke('download_llama_server', { variantId, version, assetNames });
}

/** Delete the current llama-server installation */
export async function deleteLlamaInstallation(): Promise<void> {
  await invoke('delete_llama_installation');
}

// ---------------------------------------------------------------------------
// Process lifecycle
// ---------------------------------------------------------------------------

/** Start the llama-server process */
export async function startServer(
  modelPath: string,
  port?: number,
  mmprojPath?: string
): Promise<number> {
  const actualPort = port ?? getSavedPort();
  const resultPort = await invoke<number>('start_llama_server', {
    modelPath,
    mmprojPath,
    port: actualPort
  });

  saveModelPath(modelPath);
  savePort(resultPort);

  return resultPort;
}

/** Stop the running llama-server process */
export async function stopServer(): Promise<void> {
  await invoke('stop_llama_server');
}

/** Check if llama-server is currently running */
export async function isServerRunning(): Promise<boolean> {
  return invoke<boolean>('is_llama_server_running');
}

/**
 * Wait for the server to become healthy (accepting requests).
 * Polls the /health endpoint until it responds or timeout.
 */
export async function waitForServerReady(port: number, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  const url = `http://127.0.0.1:${port}/health`;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}
