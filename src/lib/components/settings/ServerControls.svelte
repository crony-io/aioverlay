<script lang="ts">
  import {
    getInstallStatus,
    getSavedModelPath,
    getSavedPort,
    savePort
  } from '$lib/services/local/llamaManager';
  import {
    ensureServerRunning,
    shutdownServer,
    switchLocalModelByPath
  } from '$lib/services/local/serverOrchestrator';
  import { invoke } from '@tauri-apps/api/core';
  import type { DownloadedModel } from '$lib/services/local/types';
  import { showError } from '$lib/stores/errorStore.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { Play, Square, RefreshCw, BadgeCheck, BadgeAlert, Loader } from 'lucide-svelte';

  /** When the active model or refreshKey changes externally, we re-fetch model list */
  let { activeModel = '', refreshKey = 0 } = $props<{
    activeModel?: string;
    refreshKey?: number;
  }>();

  let installed = $state(false);
  let modelPath = $state(getSavedModelPath());
  let port = $state(getSavedPort());
  let downloadedModels = $state<DownloadedModel[]>([]);

  /** Derived server state from the single source of truth */
  let isRunning = $derived(settingsStore.serverStatus === 'ready');
  let isStarting = $derived(settingsStore.serverStatus === 'starting');

  /** Load model list and install status */
  async function loadState() {
    try {
      const status = await getInstallStatus();
      installed = status.installed;
      const models: DownloadedModel[] = await invoke('list_downloaded_models');
      downloadedModels = models;

      // Auto-select first model if current path no longer exists
      const pathExists = models.some((m) => m.filePath === modelPath);
      if (!pathExists && models.length > 0) {
        modelPath = models[0].filePath;
      } else if (models.length === 0) {
        modelPath = '';
      }
    } catch (e) {
      showError(e);
    }
  }

  /** Re-load whenever the component mounts, activeModel changes, or models are added/removed */
  $effect(() => {
    void activeModel;
    void refreshKey;
    loadState();
  });

  async function handleStart() {
    if (!modelPath) return;
    savePort(port);
    await switchLocalModelByPath(modelPath);
  }

  async function handleStop() {
    await shutdownServer();
  }

  async function handleRefresh() {
    await ensureServerRunning();
  }
</script>

{#if installed}
  <div class="flex flex-col gap-3 border-t border-white/10 pt-4">
    <div class="flex items-center justify-between">
      <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Local Server</div>
      <div class="flex items-center gap-1.5">
        {#if isStarting}
          <span class="flex items-center gap-1 text-[10px] text-amber-400/70">
            <Loader class="h-3 w-3 animate-spin" />
            Starting
          </span>
        {:else if isRunning}
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
          disabled={isRunning || isStarting}
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
        disabled={isRunning || isStarting}
        class="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-2">
      {#if isRunning}
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
          disabled={isStarting || !modelPath}
          class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isStarting}
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
    {#if settingsStore.serverStatusMessage}
      <div
        class="text-[11px] {settingsStore.serverStatus === 'ready'
          ? 'text-emerald-400/70'
          : settingsStore.serverStatus === 'error'
            ? 'text-red-400/70'
            : 'text-white/40'}"
      >
        {settingsStore.serverStatusMessage}
      </div>
    {/if}
  </div>
{/if}
