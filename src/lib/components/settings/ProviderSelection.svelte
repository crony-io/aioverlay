<script lang="ts">
  import type { AIProviderID, AIModelOption } from '$lib/services/ai/types';
  import { getModelsForProvider } from '$lib/services/ai/registry';

  let { activeProvider = $bindable(), activeModel = $bindable() } = $props<{
    activeProvider: AIProviderID;
    activeModel: string;
  }>();

  let availableModels = $derived<AIModelOption[]>(getModelsForProvider(activeProvider));

  /** When provider changes, auto-select the first model if current model is invalid */
  $effect(() => {
    const modelIds = availableModels.map((m) => m.id);
    if (!modelIds.includes(activeModel)) {
      activeModel = modelIds[0] ?? '';
    }
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
        <option value={model.id}>{model.label}</option>
      {/each}
    </select>
    {#if availableModels.length > 0}
      {@const selected = availableModels.find((m) => m.id === activeModel)}
      {#if selected}
        <div class="flex gap-3 text-[10px] text-white/30">
          <span>Context: {(selected.contextWindow / 1000).toFixed(0)}k</span>
          <span>Vision: {selected.supportsVision ? 'Yes' : 'No'}</span>
        </div>
      {/if}
    {/if}
  </div>
</div>
