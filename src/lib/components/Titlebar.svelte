<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { Zap, Pin, Minus, X } from 'lucide-svelte';

  let isPinned = $state(false);

  /** Restore persisted states on mount */
  $effect(() => {
    const savedPin = localStorage.getItem('alwaysOnTop') === 'true';
    if (savedPin) {
      isPinned = true;
      getCurrentWindow().setAlwaysOnTop(true);
    }
  });

  async function togglePin() {
    isPinned = !isPinned;
    localStorage.setItem('alwaysOnTop', isPinned.toString());
    await getCurrentWindow().setAlwaysOnTop(isPinned);
  }

  async function minimizeApp() {
    await getCurrentWindow().minimize();
  }

  async function closeApp() {
    await getCurrentWindow().close();
  }

  async function startDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    await getCurrentWindow().startDragging();
  }
</script>

<div
  class="mb-4 flex items-center justify-between cursor-move"
  role="toolbar"
  aria-label="Window controls"
  tabindex="-1"
  onmousedown={startDrag}
>
  <div class="flex items-center gap-3 pointer-events-none">
    <div
      class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-inner"
    >
      <Zap class="h-6 w-6 text-white" />
    </div>
    <div>
      <h1 class="text-xl font-bold tracking-tight text-white/90">Ai Overlay</h1>
      <p class="text-xs text-white/50">v0.1.0</p>
    </div>
  </div>

  <!-- Stop propagation to prevent drag when clicking buttons -->
  <div
    class="flex items-center gap-2"
    role="toolbar"
    aria-label="Window actions"
    tabindex="-1"
    onmousedown={(e) => e.stopPropagation()}
  >
    <button
      class="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors {isPinned
        ? 'bg-white/20 text-white'
        : ''} z-10 relative"
      aria-label="Pin Window"
      title={isPinned ? 'Unpin (Always on Top)' : 'Pin (Always on Top)'}
      onclick={togglePin}
    >
      <Pin class="h-5 w-5" />
    </button>
    <button
      class="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors z-10 relative"
      aria-label="Minimize"
      title="Minimize window"
      onclick={minimizeApp}
    >
      <Minus class="h-5 w-5" />
    </button>
    <button
      class="rounded-lg p-2 text-white/60 hover:bg-red-500/80 hover:text-white transition-colors z-10 relative"
      aria-label="Close"
      title="Close App"
      onclick={closeApp}
    >
      <X class="h-5 w-5" />
    </button>
  </div>
</div>
