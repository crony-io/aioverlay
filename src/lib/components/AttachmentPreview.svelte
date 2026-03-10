<script lang="ts">
  import { X, Image } from 'lucide-svelte';

  let { imageData, onRemove } = $props<{
    imageData: string;
    onRemove: () => void;
  }>();
</script>

<div class="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2 mb-2">
  <div class="relative group shrink-0">
    <img
      src="data:image/png;base64,{imageData}"
      alt="Attached screenshot"
      class="h-16 w-24 rounded-md object-cover border border-white/10"
    />
    <button
      onclick={onRemove}
      class="absolute -top-1.5 -right-1.5 rounded-full bg-red-500/90 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
      aria-label="Remove attachment"
    >
      <X class="h-3 w-3 text-white" />
    </button>
  </div>
  <div class="flex flex-col gap-0.5 min-w-0">
    <div class="flex items-center gap-1 text-[10px] text-white/40">
      <Image class="h-3 w-3" />
      <span>Screenshot attached</span>
    </div>
    <span class="text-[10px] text-white/25">Add a prompt and press Enter to send</span>
  </div>
</div>
