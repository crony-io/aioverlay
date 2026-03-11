<script lang="ts">
  import type { AIProviderID, AIModelOption } from '$lib/services/ai/types';
  import type { DownloadedModel } from '$lib/services/local/types';
  import { getModelsForProvider } from '$lib/services/ai/registry';
  import { listDownloadedModels } from '$lib/services/local/modelManager';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { Globe, Info } from 'lucide-svelte';

  /** Determine if a downloaded model supports vision from HF metadata */
  function modelHasVision(m: DownloadedModel): boolean {
    if (m.pipelineTag === 'image-text-to-text') return true;
    if (m.pipelineTag === 'image-to-text') return true;
    if (m.tags?.some((t) => t === 'vision' || t === 'image-text-to-text')) return true;
    return false;
  }

  let {
    activeProvider = $bindable(),
    activeModel = $bindable(),
    webSearchEnabled = $bindable(),
    refreshKey = 0
  } = $props<{
    activeProvider: AIProviderID;
    activeModel: string;
    webSearchEnabled: boolean;
    refreshKey?: number;
  }>();

  /** Downloaded local models fetched from the Rust backend */
  let localModels = $state<AIModelOption[]>([]);

  /** Fetch downloaded models when local provider is selected or models change */
  $effect(() => {
    void refreshKey;
    if (activeProvider === 'local') {
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

  let availableModels = $derived<AIModelOption[]>(
    activeProvider === 'local' && localModels.length > 0
      ? localModels
      : getModelsForProvider(activeProvider)
  );
  let selectedModel = $derived(availableModels.find((m) => m.id === activeModel));
  let modelSupportsSearch = $derived(selectedModel?.supportsWebSearch ?? false);
  let showSearchInfo = $state(false);

  /** When provider changes, auto-select the first model if current model is invalid */
  $effect(() => {
    const modelIds = availableModels.map((m) => m.id);
    if (!modelIds.includes(activeModel)) {
      activeModel = modelIds[0] ?? '';
    }
  });

  /** Auto-disable web search when switching to an unsupported model */
  $effect(() => {
    if (!modelSupportsSearch && webSearchEnabled) {
      webSearchEnabled = false;
    }
  });

  /** Sync vision support to the global store so other components can check it */
  $effect(() => {
    settingsStore.activeModelSupportsVision = selectedModel?.supportsVision ?? false;
  });
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-2">
    <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">AI Provider</div>
    <select
      bind:value={activeProvider}
      aria-label="Select AI Provider"
      class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
    >
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
      <option value="gemini">Google Gemini</option>
      <option value="local">Local (llama.cpp)</option>
    </select>
  </div>

  <div class="flex flex-col gap-2">
    <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Model</div>
    <select
      bind:value={activeModel}
      aria-label="Select Model"
      class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
    >
      {#each availableModels as model (model.id)}
        <option value={model.id}>
          {model.label}{model.supportsWebSearch ? ' 🌐' : ''}
        </option>
      {/each}
    </select>
    {#if selectedModel && activeProvider !== 'local'}
      <div class="flex items-center gap-2 text-[10px] text-white/30">
        <span>Context: {(selectedModel.contextWindow / 1000).toFixed(0)}k</span>
        <span class="text-white/15">·</span>
        <span>Vision: {selectedModel.supportsVision ? 'Yes' : 'No'}</span>
        <span class="text-white/15">·</span>
        <span class={selectedModel.supportsWebSearch ? 'text-emerald-400/60' : 'text-white/20'}>
          Search: {selectedModel.supportsWebSearch ? 'Yes' : 'No'}
        </span>
      </div>
    {:else if selectedModel && activeProvider === 'local'}
      <div class="flex items-center gap-2 text-[10px] text-white/30">
        <span>Vision: {selectedModel.supportsVision ? 'Yes' : 'No'}</span>
      </div>
    {/if}
  </div>

  <!-- Web Search Toggle -->
  <div
    class="flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors {modelSupportsSearch
      ? 'border-white/10 bg-black/20'
      : 'border-white/5 bg-black/10 opacity-50'}"
  >
    <div class="flex items-center gap-2.5 min-w-0">
      <Globe class="h-4 w-4 shrink-0 {webSearchEnabled ? 'text-emerald-400' : 'text-white/30'}" />
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-sm text-white/80 font-medium">Web Search</span>
          <button
            onclick={() => (showSearchInfo = !showSearchInfo)}
            class="text-white/30 hover:text-white/60 transition-colors"
            aria-label="Web search info"
          >
            <Info class="h-3 w-3" />
          </button>
        </div>
        {#if !modelSupportsSearch}
          <span class="text-[10px] text-amber-400/70">Not available for this model</span>
        {:else if webSearchEnabled}
          <span class="text-[10px] text-emerald-400/70">AI will search the web when needed</span>
        {/if}
      </div>
    </div>
    <label class="relative inline-flex cursor-pointer items-center shrink-0">
      <input
        type="checkbox"
        bind:checked={webSearchEnabled}
        disabled={!modelSupportsSearch}
        class="peer sr-only"
      />
      <div
        class="h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-focus:outline-none peer-disabled:cursor-not-allowed peer-disabled:opacity-40"
      ></div>
    </label>
  </div>

  <!-- Expandable info panel -->
  {#if showSearchInfo}
    <div
      class="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5 text-[11px] text-white/50 leading-relaxed"
    >
      <p class="mb-1.5 font-medium text-white/60">How web search works</p>
      <p>
        When enabled, your AI provider's native search tool is used. The model decides when to
        search based on your prompt and returns answers with cited sources.
      </p>
      <p class="mt-1.5">
        <strong class="text-white/60">OpenAI:</strong> Uses search-optimized model variants<br />
        <strong class="text-white/60">Anthropic:</strong> Uses the web_search tool<br />
        <strong class="text-white/60">Gemini:</strong> Uses Google Search grounding<br />
        <strong class="text-white/60">Local:</strong> Not supported
      </p>
    </div>
  {/if}
</div>
