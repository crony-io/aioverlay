<script lang="ts">
  let { openAiKey = $bindable(), anthropicKey = $bindable(), geminiKey = $bindable() } = $props();
</script>

<div class="flex flex-col gap-3 border-t border-white/10 pt-4">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">
    API Keys (Stronghold)
  </div>
  <input
    type="password"
    bind:value={openAiKey}
    aria-label="OpenAI Key"
    placeholder="OpenAI Key (sk-...)"
    class="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
  />
  <input
    type="password"
    bind:value={anthropicKey}
    aria-label="Anthropic Key"
    placeholder="Anthropic Key (sk-ant-...)"
    class="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
  />
  <input
    type="password"
    bind:value={geminiKey}
    aria-label="Gemini Key"
    placeholder="Gemini Key"
    class="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
  />
</div>
