import {
  isServerRunning,
  startServer,
  stopServer,
  waitForServerReady,
  getInstallStatus,
  getSavedModelPath,
  getSavedPort,
  saveModelPath
} from '$lib/services/local/llamaManager';
import { setActiveModelFilename, listDownloadedModels } from '$lib/services/local/modelManager';
import { settingsStore } from '$lib/stores/settingsStore.svelte';
import type { DownloadedModel } from '$lib/services/local/types';

/** Interval handle for health polling */
let healthPollInterval: ReturnType<typeof setInterval> | null = null;

/** Tracks whether an auto-start is already in progress to avoid duplicates */
let autoStartInProgress = false;

const HEALTH_POLL_MS = 5000;

/**
 * Check if the local provider needs a running server and whether
 * it can be auto-started (llama-server installed + model selected).
 */
async function canAutoStart(): Promise<boolean> {
  if (settingsStore.activeProvider !== 'local') return false;

  const status = await getInstallStatus();
  if (!status.installed) return false;

  const modelPath = getSavedModelPath();
  if (!modelPath) return false;

  return true;
}

/**
 * Attempt to auto-start the local llama-server.
 * Updates settingsStore.serverStatus reactively so the UI reflects progress.
 */
export async function ensureServerRunning(): Promise<void> {
  if (settingsStore.activeProvider !== 'local') return;
  if (autoStartInProgress) return;

  // Already running — just mark ready
  const running = await isServerRunning();
  if (running) {
    settingsStore.serverStatus = 'ready';
    settingsStore.serverStatusMessage = 'Server running';
    startHealthPolling();
    return;
  }

  if (!(await canAutoStart())) {
    settingsStore.serverStatus = 'idle';
    settingsStore.serverStatusMessage = 'No local model configured';
    return;
  }

  autoStartInProgress = true;
  settingsStore.serverStatus = 'starting';
  settingsStore.serverStatusMessage = 'Starting local server…';

  try {
    const modelPath = getSavedModelPath();
    const port = getSavedPort();

    const models = await listDownloadedModels();
    const activeModelConf = models.find((m) => m.filePath === modelPath);
    const mmprojPath = activeModelConf?.mmprojPath;

    const resultPort = await startServer(modelPath, port, mmprojPath);

    settingsStore.serverStatusMessage = 'Waiting for server to be ready…';
    const ready = await waitForServerReady(resultPort, 30000);

    if (ready) {
      settingsStore.serverStatus = 'ready';
      settingsStore.serverStatusMessage = `Server running on port ${resultPort}`;
      startHealthPolling();
    } else {
      settingsStore.serverStatus = 'error';
      settingsStore.serverStatusMessage = 'Server started but health check timed out';
    }
  } catch (e) {
    settingsStore.serverStatus = 'error';
    settingsStore.serverStatusMessage = e instanceof Error ? e.message : String(e);
  } finally {
    autoStartInProgress = false;
  }
}

/**
 * Stop the local server and reset status.
 */
export async function shutdownServer(): Promise<void> {
  stopHealthPolling();
  try {
    await stopServer();
  } catch {
    /* best-effort */
  }
  settingsStore.serverStatus = 'idle';
  settingsStore.serverStatusMessage = 'Server stopped';
}

/**
 * Periodically poll the server health endpoint.
 * If the server goes down unexpectedly, update status to 'error'.
 */
function startHealthPolling(): void {
  stopHealthPolling();

  healthPollInterval = setInterval(async () => {
    if (settingsStore.activeProvider !== 'local') {
      stopHealthPolling();
      return;
    }

    try {
      const running = await isServerRunning();
      if (!running && settingsStore.serverStatus === 'ready') {
        settingsStore.serverStatus = 'error';
        settingsStore.serverStatusMessage = 'Server stopped unexpectedly';
      }
    } catch {
      /* ignore transient errors */
    }
  }, HEALTH_POLL_MS);
}

/** Stop the health polling interval */
function stopHealthPolling(): void {
  if (healthPollInterval) {
    clearInterval(healthPollInterval);
    healthPollInterval = null;
  }
}

/**
 * Called when the active provider changes.
 * If switching TO local — auto-start; if switching AWAY — stop polling.
 */
export async function onProviderChanged(): Promise<void> {
  if (settingsStore.activeProvider === 'local') {
    await ensureServerRunning();
  } else {
    stopHealthPolling();
    settingsStore.serverStatus = 'idle';
    settingsStore.serverStatusMessage = '';
  }
}

/**
 * Determine if a downloaded model supports vision from HF metadata.
 */
function modelHasVision(m: DownloadedModel): boolean {
  if (m.pipelineTag === 'image-text-to-text') return true;
  if (m.pipelineTag === 'image-to-text') return true;
  if (m.tags?.some((t) => t === 'vision' || t === 'image-text-to-text')) return true;
  return false;
}

/**
 * Central function to switch the active local model.
 * Unifies all three tracking systems:
 *   1. modelManager activeModelFilename (localStorage)
 *   2. llamaManager savedModelPath (localStorage)
 *   3. settingsStore.activeModel (reactive)
 * Then syncs vision support and auto-restarts the server.
 */
export async function switchLocalModel(model: DownloadedModel): Promise<void> {
  // 1. Sync all three sources of truth
  setActiveModelFilename(model.filename);
  saveModelPath(model.filePath);
  settingsStore.activeProvider = 'local';
  settingsStore.activeModel = model.filePath;

  // 2. Sync vision support
  settingsStore.activeModelSupportsVision = modelHasVision(model);

  // 3. Auto-restart server with the new model
  stopHealthPolling();
  autoStartInProgress = false; // reset so ensureServerRunning can proceed

  const running = await isServerRunning();
  if (running) {
    settingsStore.serverStatus = 'starting';
    settingsStore.serverStatusMessage = 'Restarting server with new model…';
    try {
      await stopServer();
    } catch {
      /* best-effort stop */
    }
  }

  await ensureServerRunning();
}

/**
 * Convenience: switch local model by filename lookup.
 * Used when only the filename is known (e.g. from ModelSelector dropdown).
 */
export async function switchLocalModelByPath(filePath: string): Promise<void> {
  const models = await listDownloadedModels();
  const model = models.find((m) => m.filePath === filePath);
  if (model) {
    await switchLocalModel(model);
  }
}

/**
 * Clean up all orchestrator resources (call on app unmount).
 */
export function destroyOrchestrator(): void {
  stopHealthPolling();
  autoStartInProgress = false;
}
