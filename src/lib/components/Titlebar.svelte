<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';

  let isPinned = $state(false);

  async function togglePin() {
    isPinned = !isPinned;
    await getCurrentWindow().setAlwaysOnTop(isPinned);
  }

  async function closeApp() {
    await getCurrentWindow().close();
  }

  // Programmatic drag is often more reliable than data-tauri-drag-region when layered elements are involved
  async function startDrag(e: MouseEvent) {
    // Only drag on left click
    if (e.button !== 0) return;
    await getCurrentWindow().startDragging();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="mb-4 flex items-center justify-between cursor-move" onmousedown={startDrag}>
  <div class="flex items-center gap-3 pointer-events-none">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-inner">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <div>
      <h1 class="text-xl font-bold tracking-tight text-white/90">Ai Overlay</h1>
      <p class="text-xs text-white/50">v0.1.0</p>
    </div>
  </div>
  
  <!-- Stop propagation to prevent drag when clicking buttons -->
  <div class="flex items-center gap-2" onmousedown={(e) => e.stopPropagation()}>
    <button 
      class="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors {isPinned ? 'bg-white/20 text-white' : ''} z-10 relative" 
      aria-label="Pin Window"
      title="Pin Window"
      onclick={togglePin}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
      </svg>
    </button>
    <button 
      class="rounded-lg p-2 text-white/60 hover:bg-red-500/80 hover:text-white transition-colors z-10 relative" 
      aria-label="Close"
      title="Close App"
      onclick={closeApp}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
</div>
