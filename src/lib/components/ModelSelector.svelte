<script lang="ts">
  import type { AIProviderID, AIModelOption } from '$lib/services/ai/types';
  import type { DownloadedModel } from '$lib/services/local/types';
  import { getProvider, getModelsForProvider } from '$lib/services/ai/registry';
  import { listDownloadedModels } from '$lib/services/local/modelManager';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { switchLocalModelByPath } from '$lib/services/local/serverOrchestrator';
  import { ChevronDown, Globe, Cpu, Server, Cloud, Loader } from 'lucide-svelte';

  let isOpen = $state(false);

  /** Determine if a downloaded model supports vision from HF metadata */
  function modelHasVision(m: DownloadedModel): boolean {
    if (m.pipelineTag === 'image-text-to-text') return true;
    if (m.pipelineTag === 'image-to-text') return true;
    if (m.tags?.some((t) => t === 'vision' || t === 'image-text-to-text')) return true;
    return false;
  }

  let localModels = $state<AIModelOption[]>([]);

  /** Fetch local models when needed — also re-fetch when activeModel changes
   *  (e.g. after download/activate via orchestrator) */
  $effect(() => {
    void settingsStore.activeModel;
    if (settingsStore.activeProvider === 'local') {
      listDownloadedModels().then((models) => {
        localModels = models.map((m) => ({
          id: m.filePath,
          label: m.filename,
          contextWindow: 0,
          supportsVision: modelHasVision(m)
        }));
      });
    }
  });

  let providerLabel = $derived.by(() => {
    try {
      return getProvider(settingsStore.activeProvider).label;
    } catch {
      return 'Unknown';
    }
  });

  let currentModelLabel = $derived.by(() => {
    try {
      const provider = getProvider(settingsStore.activeProvider);
      const modelId = settingsStore.activeModel;
      const models =
        settingsStore.activeProvider === 'local' && localModels.length > 0
          ? localModels
          : provider.models;
      const model = models.find((m) => m.id === modelId);
      if (model) return model.label;
      if (modelId) {
        const parts = modelId.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || modelId;
      }
      return models[0]?.label ?? 'No model';
    } catch {
      return 'Unknown';
    }
  });

  let availableModels = $derived.by(() => {
    if (settingsStore.activeProvider === 'local' && localModels.length > 0) {
      return localModels;
    }
    return getModelsForProvider(settingsStore.activeProvider);
  });

  /** Sync vision support on mount and whenever provider/model/localModels change.
   *  This ensures vision is always correct — even on app startup before user interaction. */
  $effect(() => {
    const provider = settingsStore.activeProvider;
    const modelId = settingsStore.activeModel;

    if (provider === 'local') {
      if (localModels.length > 0) {
        const model = localModels.find((m) => m.id === modelId);
        settingsStore.activeModelSupportsVision = model?.supportsVision ?? false;
      }
    } else {
      const models = getModelsForProvider(provider);
      const model = models.find((m) => m.id === modelId);
      settingsStore.activeModelSupportsVision = model?.supportsVision ?? false;
    }
  });

  let searchActive = $derived.by(() => {
    try {
      const provider = getProvider(settingsStore.activeProvider);
      const model = provider.models.find((m) => m.id === settingsStore.activeModel);
      return settingsStore.webSearchEnabled && (model?.supportsWebSearch ?? false);
    } catch {
      return false;
    }
  });

  const providers: { id: AIProviderID; label: string; icon: typeof Cloud }[] = [
    { id: 'openai', label: 'OpenAI', icon: Cloud },
    { id: 'anthropic', label: 'Anthropic', icon: Cloud },
    { id: 'gemini', label: 'Gemini', icon: Cloud },
    { id: 'local', label: 'Local', icon: Server }
  ];

  function selectModel(providerId: AIProviderID, modelId: string) {
    isOpen = false;

    if (providerId === 'local') {
      // Use orchestrator for local models — handles all 3 tracking systems + server restart
      switchLocalModelByPath(modelId);
      return;
    }

    settingsStore.activeProvider = providerId;
    settingsStore.activeModel = modelId;

    /** Sync vision support for cloud models */
    const models = getModelsForProvider(providerId);
    const model = models.find((m) => m.id === modelId);
    settingsStore.activeModelSupportsVision = model?.supportsVision ?? false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.model-selector')) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  });
</script>

<div class="model-selector relative">
  <!-- Compact pill trigger -->
  <button
    onclick={() => (isOpen = !isOpen)}
    class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors hover:bg-white/5"
    style="border-color: var(--border-subtle); color: var(--text-secondary);"
    aria-label="Select model"
    title="{providerLabel} · {currentModelLabel}"
  >
    {#if settingsStore.activeProvider === 'local'}
      {#if settingsStore.serverStatus === 'starting'}
        <Loader class="h-3 w-3 animate-spin text-amber-400" />
      {:else}
        <Cpu class="h-3 w-3 text-indigo-400/70" />
      {/if}
    {:else}
      <Cloud class="h-3 w-3 text-indigo-400/70" />
    {/if}
    <span class="max-w-[120px] truncate font-medium text-white/70">{currentModelLabel}</span>
    {#if searchActive}
      <Globe class="h-2.5 w-2.5 text-emerald-400/70" />
    {/if}
    <ChevronDown class="h-3 w-3 text-white/30" />
  </button>

  <!-- Dropdown panel -->
  {#if isOpen}
    <div
      class="absolute left-0 top-full z-50 mt-1 flex w-72 flex-col overflow-hidden rounded-xl border shadow-2xl"
      style="background: var(--surface-base); border-color: var(--border-default);"
    >
      <!-- Provider tabs -->
      <div class="flex border-b" style="border-color: var(--border-subtle);">
        {#each providers as p (p.id)}
          {@const Icon = p.icon}
          <button
            onclick={() => {
              settingsStore.activeProvider = p.id;
            }}
            class="flex flex-1 items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors
              {settingsStore.activeProvider === p.id
              ? 'border-b-2 border-indigo-500 text-white/90'
              : 'text-white/40 hover:text-white/60'}"
          >
            <Icon class="h-3 w-3" />
            {p.label}
          </button>
        {/each}
      </div>

      <!-- Model list -->
      <div class="max-h-48 overflow-y-auto custom-scrollbar p-1.5">
        {#each availableModels as model (model.id)}
          <button
            onclick={() => selectModel(settingsStore.activeProvider, model.id)}
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors
              {settingsStore.activeModel === model.id
              ? 'bg-indigo-500/15 text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white/80'}"
          >
            <div class="flex flex-1 flex-col gap-0.5 min-w-0">
              <span class="truncate font-medium">{model.label}</span>
              {#if model.contextWindow > 0}
                <span class="text-[10px] text-white/30">
                  {(model.contextWindow / 1000).toFixed(0)}k context
                  {#if model.supportsVision}
                    · Vision{/if}
                  {#if model.supportsWebSearch}
                    · Search{/if}
                </span>
              {/if}
            </div>
            {#if settingsStore.activeModel === model.id}
              <div class="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0"></div>
            {/if}
          </button>
        {:else}
          <div class="px-3 py-4 text-center text-[11px] text-white/30">
            {#if settingsStore.activeProvider === 'local'}
              No models downloaded yet.
              <br />Use Settings → Local Inference to download models.
            {:else}
              No models available.
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
