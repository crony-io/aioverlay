<script lang="ts">
  import {
    startServer,
    stopServer,
    isServerRunning,
    waitForServerReady,
    getInstallStatus,
    getSavedModelPath,
    getSavedPort,
    saveModelPath,
    savePort
  } from '$lib/services/local/llamaManager';
  import { invoke } from '@tauri-apps/api/core';
  import type { DownloadedModel } from '$lib/services/local/types';
  import { Play, Square, RefreshCw, BadgeCheck, BadgeAlert, Loader } from 'lucide-svelte';

  let running = $state(false);
  let starting = $state(false);
  let statusMessage = $state('');
  let statusType = $state<'info' | 'success' | 'error'>('info');
  let installed = $state(false);

  let modelPath = $state(getSavedModelPath());
  let port = $state(getSavedPort());
  let downloadedModels = $state<DownloadedModel[]>([]);

  /** Load initial state */
  async function loadState() {
    try {
      running = await isServerRunning();
      const status = await getInstallStatus();
      installed = status.installed;
      const models: DownloadedModel[] = await invoke('list_downloaded_models');
      downloadedModels = models;

      if (!modelPath && models.length > 0) {
        modelPath = models[0].filePath;
      }
    } catch (e) {
      console.error('Failed to load server state:', e);
    }
  }

  $effect(() => {
    loadState();
  });

  async function handleStart() {
    if (!modelPath) {
      statusMessage = 'Select a model first';
      statusType = 'error';
      return;
    }

    starting = true;
    statusMessage = 'Starting server…';
    statusType = 'info';

    try {
      saveModelPath(modelPath);
      savePort(port);
      const resultPort = await startServer(modelPath, port);
      statusMessage = 'Waiting for server to be ready…';

      const ready = await waitForServerReady(resultPort, 30000);
      if (ready) {
        running = true;
        statusMessage = `Server running on port ${resultPort}`;
        statusType = 'success';
      } else {
        statusMessage = 'Server started but health check timed out';
        statusType = 'error';
        running = true;
      }
    } catch (e) {
      statusMessage = e instanceof Error ? e.message : String(e);
      statusType = 'error';
    } finally {
      starting = false;
    }
  }

  async function handleStop() {
    try {
      await stopServer();
      running = false;
      statusMessage = 'Server stopped';
      statusType = 'info';
    } catch (e) {
      statusMessage = e instanceof Error ? e.message : String(e);
      statusType = 'error';
    }
  }

  async function handleRefresh() {
    running = await isServerRunning();
    statusMessage = running ? 'Server is running' : 'Server is not running';
    statusType = running ? 'success' : 'info';
  }
</script>

{#if installed}
  <div class="flex flex-col gap-3 border-t border-white/10 pt-4">
    <div class="flex items-center justify-between">
      <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Local Server</div>
      <div class="flex items-center gap-1.5">
        {#if running}
          <span class="flex items-center gap-1 text-[10px] text-emerald-400/70">
            <BadgeCheck class="h-3 w-3" />
            Running
          </span>
        {:else}
          <span class="flex items-center gap-1 text-[10px] text-white/30">
            <BadgeAlert class="h-3 w-3" />
            Stopped
          </span>
        {/if}
      </div>
    </div>

    <!-- Model selection (from downloaded models) -->
    {#if downloadedModels.length > 0}
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] text-white/40" for="server-model">Model</label>
        <select
          id="server-model"
          bind:value={modelPath}
          disabled={running || starting}
          class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#each downloadedModels as model (model.filePath)}
            <option value={model.filePath}>
              {model.filename} ({(model.size / 1024 / 1024 / 1024).toFixed(1)} GB)
            </option>
          {/each}
        </select>
      </div>
    {:else}
      <p class="text-[11px] text-white/30">No models downloaded. Use the Model Downloader above.</p>
    {/if}

    <!-- Port -->
    <div class="flex items-center gap-2">
      <label class="text-[11px] text-white/40 shrink-0" for="server-port">Port</label>
      <input
        id="server-port"
        type="number"
        bind:value={port}
        min="1"
        max="65535"
        disabled={running || starting}
        class="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-2">
      {#if running}
        <button
          onclick={handleStop}
          class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/20"
        >
          <Square class="h-3 w-3" />
          Stop
        </button>
      {:else}
        <button
          onclick={handleStart}
          disabled={starting || !modelPath}
          class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if starting}
            <Loader class="h-3 w-3 animate-spin" />
            Starting…
          {:else}
            <Play class="h-3 w-3" />
            Start
          {/if}
        </button>
      {/if}

      <button
        onclick={handleRefresh}
        class="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
        title="Refresh status"
      >
        <RefreshCw class="h-3 w-3" />
      </button>
    </div>

    <!-- Status message -->
    {#if statusMessage}
      <div
        class="text-[11px] {statusType === 'success'
          ? 'text-emerald-400/70'
          : statusType === 'error'
            ? 'text-red-400/70'
            : 'text-white/40'}"
      >
        {statusMessage}
      </div>
    {/if}
  </div>
{/if}
