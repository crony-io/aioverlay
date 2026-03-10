<script lang="ts">
  import ShortcutRecorder from '$lib/components/settings/ShortcutRecorder.svelte';
  import { getRegistrationStatus } from '$lib/services/shortcuts/shortcutManager';
  import { BadgeCheck, BadgeAlert } from 'lucide-svelte';

  let { copyKey = $bindable(), screenshotKey = $bindable() } = $props();

  let status = $derived.by(() => {
    void copyKey;
    void screenshotKey;
    return getRegistrationStatus();
  });
</script>

<div class="flex flex-col gap-3 border-t border-white/10 pt-4">
  <div class="flex items-center justify-between">
    <div class="text-xs font-semibold text-white/50 uppercase tracking-wider">Global Shortcuts</div>
    {#if status.registered}
      <span class="flex items-center gap-1 text-[10px] text-emerald-400/70">
        <BadgeCheck class="h-3 w-3" />
        Active
      </span>
    {:else if status.error}
      <span class="flex items-center gap-1 text-[10px] text-red-400/70" title={status.error}>
        <BadgeAlert class="h-3 w-3" />
        Failed
      </span>
    {/if}
  </div>
  <ShortcutRecorder label="Copy Text" bind:value={copyKey} />
  <ShortcutRecorder label="Screenshot" bind:value={screenshotKey} />
  <span class="text-xs text-white/40"
    >Click a shortcut, then press your desired key combination</span
  >
</div>
