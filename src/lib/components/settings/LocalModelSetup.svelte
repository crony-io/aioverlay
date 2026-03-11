<script lang="ts">
  import type { LlamaVariant, InstallStatus, DownloadProgress } from '$lib/services/local/types';
  import {
    getAvailableVariants,
    getInstallStatus,
    downloadLlamaServer,
    deleteLlamaInstallation
  } from '$lib/services/local/llamaManager';
  import { onDownloadProgress } from '$lib/services/local/llamaDownloader';
  import { computePercent, formatStatus } from '$lib/utils/downloadProgress';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import DownloadProgressBar from '$lib/components/settings/DownloadProgressBar.svelte';
  import { Download, Trash2, BadgeCheck, BadgeAlert, Cpu, Loader } from 'lucide-svelte';

  let variants = $state<LlamaVariant[]>([]);
  let installStatus = $state<InstallStatus>({
    installed: false,
    variantId: null,
    version: null,
    binaryPath: null
  });

  let selectedVariantId = $state<string>('');
  let isDownloading = $state(false);
  let isDeleting = $state(false);
  let showDeleteConfirm = $state(false);
  let downloadError = $state('');

  let progress = $state<DownloadProgress | null>(null);
  let downloadPercent = $derived(computePercent(progress));
  let downloadStatus = $derived(formatStatus(progress));

  /** Load variants and install status on mount */
  $effect(() => {
    loadData();
  });

  async function loadData() {
    try {
      const [v, status] = await Promise.all([getAvailableVariants(), getInstallStatus()]);
      variants = v;
      installStatus = status;

      // Auto-select: installed variant, or first recommended, or first available
      if (status.variantId) {
        selectedVariantId = status.variantId;
      } else {
        const recommended = v.find((variant) => variant.recommended);
        selectedVariantId = recommended?.id ?? v[0]?.id ?? '';
      }
    } catch (e) {
      console.error('Failed to load local model setup data:', e);
    }
  }

  async function handleDownload() {
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    isDownloading = true;
    downloadError = '';
    progress = null;

    const unlisten = await onDownloadProgress((p) => {
      progress = p;
      if (p.phase === 'error') {
        downloadError = p.error ?? 'Unknown error';
        isDownloading = false;
      }
      if (p.phase === 'complete') {
        isDownloading = false;
        loadData();
      }
    });

    try {
      await downloadLlamaServer(variant.id, variant.assetNames);
    } catch (e) {
      downloadError = e instanceof Error ? e.message : String(e);
      isDownloading = false;
    } finally {
      unlisten();
    }
  }

  async function confirmDelete() {
    showDeleteConfirm = false;
    isDeleting = true;
    try {
      await deleteLlamaInstallation();
      await loadData();
      progress = null;
    } catch (e) {
      console.error('Failed to delete installation:', e);
    } finally {
      isDeleting = false;
    }
  }
</script>

{#if showDeleteConfirm}
  <ConfirmDialog
    title="Uninstall llama-server"
    message="This will delete the llama-server binary and all related files. Downloaded models will not be affected."
    confirmLabel="Uninstall"
    onConfirm={confirmDelete}
    onCancel={() => (showDeleteConfirm = false)}
  />
{/if}

<div class="flex flex-col gap-3 border-t border-white/10 pt-4">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">
    Local Inference Engine
  </div>

  {#if installStatus.installed}
    <!-- Installed state -->
    <div
      class="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
    >
      <BadgeCheck class="h-4 w-4 shrink-0 text-emerald-400" />
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-xs text-emerald-300 font-medium">llama-server installed</span>
        <span class="text-[10px] text-white/40 truncate">
          {variants.find((v) => v.id === installStatus.variantId)?.label ?? installStatus.variantId}
          · {installStatus.version}
        </span>
      </div>
      <button
        class="ml-auto shrink-0 rounded-md p-1.5 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
        onclick={() => (showDeleteConfirm = true)}
        disabled={isDeleting}
        title="Uninstall llama-server"
      >
        {#if isDeleting}
          <Loader class="h-3.5 w-3.5 animate-spin" />
        {:else}
          <Trash2 class="h-3.5 w-3.5" />
        {/if}
      </button>
    </div>
  {:else}
    <!-- Not installed state -->
    <div
      class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
    >
      <BadgeAlert class="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
      <span class="text-xs text-amber-300/80">
        llama-server is required for local inference. Select a variant below and download it.
      </span>
    </div>
  {/if}

  <!-- Variant selector -->
  {#if !isDownloading}
    <div class="flex flex-col gap-1.5">
      <label class="text-[10px] text-white/40" for="variant-select">GPU Variant</label>
      <select
        id="variant-select"
        bind:value={selectedVariantId}
        class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
      >
        {#each variants as variant (variant.id)}
          <option value={variant.id}>
            {variant.label}
            ({variant.sizeMb} MB){variant.recommended ? ' ★' : ''}
          </option>
        {/each}
      </select>
    </div>

    {#if variants.length > 0}
      {@const selected = variants.find((v) => v.id === selectedVariantId)}
      {#if selected}
        <div class="flex items-center gap-2 text-[10px] text-white/30">
          <Cpu class="h-3 w-3" />
          <span>
            {selected.gpuType.toUpperCase()} · ~{selected.sizeMb} MB download
            {#if selected.assetNames.length > 1}
              · {selected.assetNames.length} files
            {/if}
          </span>
        </div>
      {/if}
    {/if}

    <!-- Download / reinstall button -->
    <button
      class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
      style="background: var(--accent-primary); hover:background: var(--accent-primary-hover);"
      class:opacity-50={!selectedVariantId}
      disabled={!selectedVariantId}
      onclick={handleDownload}
    >
      <Download class="h-4 w-4" />
      {installStatus.installed ? 'Reinstall' : 'Download'} llama-server
    </button>
  {/if}

  <!-- Download progress -->
  {#if isDownloading && progress}
    <DownloadProgressBar percent={downloadPercent} status={downloadStatus} />
  {/if}

  <!-- Error message -->
  {#if downloadError}
    <div class="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
      <span class="text-xs text-red-300">{downloadError}</span>
    </div>
  {/if}
</div>
