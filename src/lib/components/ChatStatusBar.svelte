<script lang="ts">
  import { getActiveProvider, getActiveModel, isWebSearchEnabled } from '$lib/stores/chatStore';
  import { getProvider } from '$lib/services/ai/registry';
  import { Globe, Cpu } from 'lucide-svelte';

  let providerLabel = $derived.by(() => {
    try {
      return getProvider(getActiveProvider()).label;
    } catch {
      return 'Unknown';
    }
  });

  let modelLabel = $derived.by(() => {
    try {
      const provider = getProvider(getActiveProvider());
      const modelId = getActiveModel();
      const model = provider.models.find((m) => m.id === modelId);
      if (model) return model.label;
      if (modelId) return modelId;
      const first = provider.models[0];
      return first ? first.label : 'Default';
    } catch {
      return 'Unknown';
    }
  });

  let currentModelSupportsSearch = $derived.by(() => {
    try {
      const provider = getProvider(getActiveProvider());
      const modelId = getActiveModel();
      const model = provider.models.find((m) => m.id === modelId);
      return model?.supportsWebSearch ?? false;
    } catch {
      return false;
    }
  });

  let searchActive = $derived(isWebSearchEnabled() && currentModelSupportsSearch);
</script>

<div class="flex items-center gap-2 px-1 py-1 text-[10px]" style="color: var(--text-muted);">
  <Cpu class="h-3 w-3 text-indigo-400/50" />
  <span class="font-medium text-white/40">{providerLabel}</span>
  <span class="text-white/15">·</span>
  <span class="text-white/30">{modelLabel}</span>

  {#if searchActive}
    <span class="text-white/15">·</span>
    <span class="flex items-center gap-0.5 text-emerald-400/60">
      <Globe class="h-2.5 w-2.5" />
      Search
    </span>
  {/if}
</div>
