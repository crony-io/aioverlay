<script lang="ts">
  import type {
    HfModelResult,
    GgufFileInfo,
    DownloadedModel,
    ModelDownloadProgress
  } from '$lib/services/local/types';
  import {
    searchHfModels,
    getModelFiles,
    downloadModel,
    listDownloadedModels,
    deleteModel,
    onModelDownloadProgress,
    getActiveModelFilename,
    clearActiveModel,
    formatFileSize
  } from '$lib/services/local/modelManager';
  import { switchLocalModel } from '$lib/services/local/serverOrchestrator';
  import { computePercent, formatStatus } from '$lib/utils/downloadProgress';
  import { showError } from '$lib/stores/errorStore.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import DownloadProgressBar from '$lib/components/settings/DownloadProgressBar.svelte';
  import {
    Search,
    Download,
    Trash2,
    BadgeCheck,
    ChevronDown,
    ChevronUp,
    Loader,
    HardDrive,
    Heart,
    ArrowDownToLine,
    Eye
  } from 'lucide-svelte';

  /** Check if a HF model supports vision based on pipeline_tag or tags */
  function isVisionModel(result: { pipeline_tag?: string | null; tags?: string[] }): boolean {
    if (result.pipeline_tag === 'image-text-to-text') return true;
    if (result.tags?.some((t) => t === 'vision' || t === 'image-text-to-text')) return true;
    return false;
  }

  /** Callback fired when models are downloaded or deleted */
  let { onModelsChanged = () => {} } = $props<{ onModelsChanged?: () => void }>();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let downloadedModels = $state<DownloadedModel[]>([]);
  let activeFilename = $state(getActiveModelFilename());

  let searchQuery = $state('');
  let searchResults = $state<HfModelResult[]>([]);
  let isSearching = $state(false);
  let searchError = $state('');

  let expandedRepoId = $state<string | null>(null);
  let repoFiles = $state<GgufFileInfo[]>([]);
  let isLoadingFiles = $state(false);

  let downloadingFile = $state<string | null>(null);
  let progress = $state<ModelDownloadProgress | null>(null);
  let downloadError = $state('');

  let isDeleting = $state<string | null>(null);
  let pendingDeleteFilename = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  let downloadPercent = $derived(computePercent(progress));
  let downloadStatus = $derived(formatStatus(progress));

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  $effect(() => {
    loadDownloadedModels();
  });

  /** Debounced search */
  $effect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      searchResults = [];
      searchError = '';
      return;
    }
    const timeout = setTimeout(() => performSearch(query), 500);
    return () => clearTimeout(timeout);
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function loadDownloadedModels() {
    try {
      downloadedModels = await listDownloadedModels();
      // Validate active model still exists
      if (activeFilename && !downloadedModels.some((m) => m.filename === activeFilename)) {
        clearActiveModel();
        activeFilename = '';
      }
    } catch (e) {
      showError(e);
    }
  }

  async function performSearch(query: string) {
    isSearching = true;
    searchError = '';
    try {
      searchResults = await searchHfModels(query);
    } catch (e) {
      searchError = e instanceof Error ? e.message : String(e);
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  async function toggleRepoFiles(repoId: string) {
    if (expandedRepoId === repoId) {
      expandedRepoId = null;
      repoFiles = [];
      return;
    }
    expandedRepoId = repoId;
    repoFiles = [];
    isLoadingFiles = true;
    try {
      repoFiles = await getModelFiles(repoId);
    } catch (e) {
      showError(e);
    } finally {
      isLoadingFiles = false;
    }
  }

  async function handleDownload(repoId: string, filename: string) {
    downloadingFile = filename;
    downloadError = '';
    progress = null;

    const unlisten = await onModelDownloadProgress((p) => {
      progress = p;
      if (p.phase === 'error') {
        downloadError = p.error ?? 'Unknown error';
        downloadingFile = null;
      }
      if (p.phase === 'complete') {
        downloadingFile = null;
        loadDownloadedModels().then(async () => {
          // Auto-activate the newly downloaded model
          const downloaded = downloadedModels.find((m) => m.filename === filename);
          if (downloaded) {
            activeFilename = downloaded.filename;
            await switchLocalModel(downloaded);
          }
          onModelsChanged();
        });
      }
    });

    try {
      await downloadModel(repoId, filename);
    } catch (e) {
      downloadError = e instanceof Error ? e.message : String(e);
      downloadingFile = null;
    } finally {
      unlisten();
    }
  }

  async function handleActivate(filename: string) {
    const model = downloadedModels.find((m) => m.filename === filename);
    if (!model) return;
    activeFilename = filename;
    await switchLocalModel(model);
    onModelsChanged();
  }

  function requestDeleteModel(filename: string) {
    pendingDeleteFilename = filename;
  }

  async function confirmDeleteModel() {
    if (!pendingDeleteFilename) return;
    const filename = pendingDeleteFilename;
    pendingDeleteFilename = null;
    isDeleting = filename;
    try {
      await deleteModel(filename);
      if (activeFilename === filename) {
        clearActiveModel();
        activeFilename = '';
      }
      await loadDownloadedModels();
      onModelsChanged();
    } catch (e) {
      showError(e);
    } finally {
      isDeleting = null;
    }
  }

  function formatDownloads(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }
</script>

{#if pendingDeleteFilename}
  <ConfirmDialog
    title="Delete Model"
    message="The model file '{pendingDeleteFilename}' will be permanently deleted from disk."
    confirmLabel="Delete"
    onConfirm={confirmDeleteModel}
    onCancel={() => (pendingDeleteFilename = null)}
  />
{/if}

<div class="flex flex-col gap-3 border-t border-white/10 pt-4">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Model Library</div>

  <!-- Downloaded models -->
  {#if downloadedModels.length > 0}
    <div class="flex flex-col gap-1.5">
      {#each downloadedModels as model (model.filename)}
        {@const isActive = model.filename === activeFilename}
        <div
          class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors {isActive
            ? 'border-indigo-500/30 bg-indigo-500/5'
            : 'border-white/5 bg-white/2 hover:bg-white/4'}"
        >
          <button
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            onclick={() => handleActivate(model.filename)}
            title={isActive ? 'Active model' : 'Click to activate'}
          >
            {#if isActive}
              <BadgeCheck class="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            {:else}
              <HardDrive class="h-3.5 w-3.5 shrink-0 text-white/20" />
            {/if}
            <div class="flex flex-col min-w-0">
              <span class="text-xs text-white/80 truncate">{model.filename}</span>
              <span class="text-[10px] text-white/30 truncate">
                {model.repoId} · {formatFileSize(model.size)}
                {#if model.pipelineTag === 'image-text-to-text' || model.tags?.includes('vision')}
                  · <span class="text-indigo-400/70">Vision</span>
                {/if}
              </span>
            </div>
          </button>
          <button
            class="shrink-0 rounded-md p-1 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
            onclick={() => requestDeleteModel(model.filename)}
            disabled={isDeleting === model.filename}
            title="Delete model"
          >
            {#if isDeleting === model.filename}
              <Loader class="h-3 w-3 animate-spin" />
            {:else}
              <Trash2 class="h-3 w-3" />
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Search bar -->
  <div class="relative">
    <Search
      class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
    />
    <input
      type="text"
      placeholder="Search Hugging Face for GGUF models…"
      bind:value={searchQuery}
      class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
    />
    {#if isSearching}
      <Loader
        class="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-white/30"
      />
    {/if}
  </div>

  {#if searchError}
    <span class="text-[10px] text-red-300">{searchError}</span>
  {/if}

  <!-- Search results -->
  {#if searchResults.length > 0}
    <div class="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar">
      {#each searchResults as result (result.id)}
        {@const isExpanded = expandedRepoId === result.id}
        <div class="rounded-lg border border-white/5 bg-white/2">
          <!-- Result header -->
          <button
            class="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-white/4"
            onclick={() => toggleRepoFiles(result.id)}
          >
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-xs font-medium text-white/80 truncate">{result.id}</span>
              <div class="flex items-center gap-3 text-[10px] text-white/30">
                <span class="flex items-center gap-0.5">
                  <ArrowDownToLine class="h-2.5 w-2.5" />
                  {formatDownloads(result.downloads)}
                </span>
                <span class="flex items-center gap-0.5">
                  <Heart class="h-2.5 w-2.5" />
                  {result.likes}
                </span>
                {#if isVisionModel(result)}
                  <span class="flex items-center gap-0.5 text-indigo-400/70">
                    <Eye class="h-2.5 w-2.5" />
                    Vision
                  </span>
                {/if}
              </div>
            </div>
            {#if isExpanded}
              <ChevronUp class="h-3.5 w-3.5 shrink-0 text-white/30" />
            {:else}
              <ChevronDown class="h-3.5 w-3.5 shrink-0 text-white/30" />
            {/if}
          </button>

          <!-- Expanded file list -->
          {#if isExpanded}
            <div class="border-t border-white/5 px-2.5 py-1.5">
              {#if isLoadingFiles}
                <div class="flex items-center gap-2 py-1 text-[10px] text-white/30">
                  <Loader class="h-3 w-3 animate-spin" /> Loading files…
                </div>
              {:else if repoFiles.length === 0}
                <span class="text-[10px] text-white/30">No GGUF files found</span>
              {:else}
                <div class="flex flex-col gap-1">
                  {#each repoFiles as file (file.filename)}
                    {@const isAlreadyDownloaded = downloadedModels.some(
                      (m) => m.filename === file.filename
                    )}
                    {@const isThisDownloading = downloadingFile === file.filename}
                    <div class="flex items-center gap-2 py-0.5">
                      <span class="min-w-0 flex-1 truncate text-[11px] text-white/60">
                        {file.filename}
                      </span>
                      <span class="shrink-0 text-[10px] text-white/25">
                        {formatFileSize(file.size)}
                      </span>
                      {#if isAlreadyDownloaded}
                        <BadgeCheck class="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {:else if isThisDownloading}
                        <Loader class="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-400" />
                      {:else}
                        <button
                          class="shrink-0 rounded-md p-0.5 text-white/30 transition-colors hover:bg-indigo-500/10 hover:text-indigo-400"
                          onclick={() => handleDownload(result.id, file.filename)}
                          disabled={downloadingFile !== null}
                          title="Download"
                        >
                          <Download class="h-3.5 w-3.5" />
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Download progress -->
  {#if downloadingFile && progress}
    <DownloadProgressBar
      percent={downloadPercent}
      status={downloadStatus}
      label={downloadingFile}
    />
  {/if}

  <!-- Download error -->
  {#if downloadError}
    <div class="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">
      <span class="text-[10px] text-red-300">{downloadError}</span>
    </div>
  {/if}
</div>
