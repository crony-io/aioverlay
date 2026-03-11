<script lang="ts">
  import type { Update } from '@tauri-apps/plugin-updater';
  import {
    checkForUpdate,
    downloadAndInstallUpdate,
    type UpdateInfo,
    type UpdateProgress
  } from '$lib/services/updater/updaterManager';
  import { Download, RefreshCw, X, ArrowUp } from 'lucide-svelte';

  type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error';

  let updateState: UpdateState = $state('idle');
  let updateInfo: UpdateInfo | null = $state(null);
  let pendingUpdate: Update | null = $state(null);
  let progress: UpdateProgress = $state({ contentLength: 0, downloaded: 0 });
  let errorMsg = $state('');
  let dismissed = $state(false);

  let progressPercent = $derived(
    progress.contentLength > 0
      ? Math.round((progress.downloaded / progress.contentLength) * 100)
      : 0
  );

  /** Auto-check on mount with a small delay to not block startup */
  $effect(() => {
    const timer = setTimeout(() => doCheck(), 5000);
    return () => clearTimeout(timer);
  });

  async function doCheck() {
    updateState = 'checking';
    dismissed = false;
    errorMsg = '';

    const result = await checkForUpdate();
    if (result) {
      updateInfo = result.info;
      pendingUpdate = result.update;
      updateState = 'available';
    } else {
      updateState = 'idle';
    }
  }

  async function doUpdate() {
    if (!pendingUpdate) return;

    updateState = 'downloading';
    progress = { contentLength: 0, downloaded: 0 };

    try {
      await downloadAndInstallUpdate(pendingUpdate, (p) => {
        progress = p;
        if (p.contentLength > 0 && p.downloaded >= p.contentLength) {
          updateState = 'installing';
        }
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      updateState = 'error';
    }
  }

  function dismiss() {
    dismissed = true;
  }
</script>

{#if !dismissed && updateState !== 'idle' && updateState !== 'checking'}
  <div
    class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all"
    style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.25);"
  >
    {#if updateState === 'available'}
      <ArrowUp class="h-3.5 w-3.5 text-indigo-400 shrink-0" />
      <span class="text-white/80 truncate">
        <strong class="text-indigo-300">v{updateInfo?.version}</strong> available
      </span>
      <button
        onclick={doUpdate}
        class="ml-auto flex items-center gap-1 rounded-md bg-indigo-500/30 px-2 py-0.5 text-indigo-200 hover:bg-indigo-500/50 transition-colors shrink-0"
      >
        <Download class="h-3 w-3" />
        Update
      </button>
      <button
        onclick={dismiss}
        class="text-white/30 hover:text-white/60 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X class="h-3 w-3" />
      </button>
    {:else if updateState === 'downloading'}
      <RefreshCw class="h-3.5 w-3.5 text-indigo-400 animate-spin shrink-0" />
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <span class="text-white/70 shrink-0">Downloading...</span>
        <div
          class="flex-1 h-1.5 rounded-full overflow-hidden"
          style="background: rgba(255,255,255,0.1);"
        >
          <div
            class="h-full rounded-full transition-all duration-300"
            style="width: {progressPercent}%; background: var(--accent-primary);"
          ></div>
        </div>
        <span class="text-white/50 shrink-0">{progressPercent}%</span>
      </div>
    {:else if updateState === 'installing'}
      <RefreshCw class="h-3.5 w-3.5 text-emerald-400 animate-spin shrink-0" />
      <span class="text-emerald-300">Installing update&hellip; App will restart.</span>
    {:else if updateState === 'error'}
      <span class="text-red-300 truncate">Update failed: {errorMsg}</span>
      <button
        onclick={doCheck}
        class="ml-auto rounded-md bg-white/10 px-2 py-0.5 text-white/60 hover:text-white/90 transition-colors shrink-0"
      >
        Retry
      </button>
      <button
        onclick={dismiss}
        class="text-white/30 hover:text-white/60 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X class="h-3 w-3" />
      </button>
    {/if}
  </div>
{/if}
