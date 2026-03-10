<script lang="ts">
  let { value = $bindable() } = $props<{
    value: string;
  }>();
</script>

<div class="flex flex-col gap-2 border-t border-white/10 pt-4">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">System Prompt</div>
  <textarea
    bind:value
    rows="3"
    placeholder="You are a helpful AI assistant..."
    aria-label="System Prompt"
    class="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 custom-scrollbar"
  ></textarea>
  <span class="text-xs text-white/40"
    >Instructions sent with every message to shape AI behavior</span
  >
</div>
