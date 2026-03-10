<script lang="ts">
  let { copyKey = $bindable(), screenshotKey = $bindable(), webSearchEnabled = $bindable() } = $props();
</script>

<div class="flex flex-col gap-3 border-t border-white/10 pt-4">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Global Shortcuts</div>
  <div class="flex items-center gap-2">
    <span class="w-24 text-sm text-white/80">Copy Text:</span>
    <input type="text" bind:value={copyKey} aria-label="Copy Key Shortcut" class="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
  </div>
  <div class="flex items-center gap-2">
    <span class="w-24 text-sm text-white/80">Screenshot:</span>
    <input type="text" bind:value={screenshotKey} aria-label="Screenshot Key Shortcut" class="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
  </div>
  <span class="text-xs text-white/40">Modifiers: CommandOrControl, Shift, Alt</span>
</div>

<!-- Web Search Toggle -->
<div class="flex items-center justify-between border-t border-white/10 pt-4 pb-2">
  <div>
    <div class="text-sm text-white/80 font-medium">Web Search Integration</div>
    <div class="text-xs text-white/40">Allow AI to search the web for real-time context</div>
  </div>
  <label class="relative inline-flex cursor-pointer items-center">
    <input type="checkbox" bind:checked={webSearchEnabled} class="peer sr-only" />
    <div class="h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-500 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
  </label>
</div>
