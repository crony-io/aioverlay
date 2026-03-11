<script lang="ts">
  import { Loader } from 'lucide-svelte';

  interface Props {
    /** Current download percentage (0–100) */
    percent: number;
    /** Human-readable status text */
    status: string;
    /** Optional label shown above the progress bar (e.g. filename) */
    label?: string;
  }

  let { percent, status, label }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
  {#if label}
    <div class="flex items-center gap-2 text-[10px] text-white/40">
      <Loader class="h-3 w-3 animate-spin" />
      <span class="truncate">{label}</span>
    </div>
  {/if}
  <div class="h-2 w-full overflow-hidden rounded-full bg-white/10">
    <div
      class="h-full rounded-full transition-all duration-200"
      style="width: {percent}%; background: var(--accent-primary);"
    ></div>
  </div>
  <span class="text-[10px] text-white/40">{status}</span>
</div>
