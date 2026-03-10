<script lang="ts">
  let { activeProvider = $bindable() } = $props();
</script>

<div class="flex flex-col gap-2">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Active Provider</div>
  <select bind:value={activeProvider} aria-label="Select AI Provider" class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
    <option value="openai">OpenAI (GPT-4o)</option>
    <option value="anthropic">Anthropic (Claude 3.5)</option>
    <option value="gemini">Google Gemini (1.5 Pro)</option>
    <option value="local">Local (llama.cpp - Qwen-VL)</option>
  </select>
</div>
