<script lang="ts">
  import ShortcutRecorder from '$lib/components/settings/ShortcutRecorder.svelte';

  let { copyKey = $bindable(), screenshotKey = $bindable() } = $props();
</script>

<div class="flex flex-col gap-3 border-t border-white/10 pt-4">
  <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Global Shortcuts</div>
  <ShortcutRecorder label="Copy Text" bind:value={copyKey} />
  <ShortcutRecorder label="Screenshot" bind:value={screenshotKey} />
  <span class="text-xs text-white/40"
    >Click a shortcut, then press your desired key combination</span
  >
</div>
