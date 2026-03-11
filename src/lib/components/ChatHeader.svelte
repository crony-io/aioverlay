<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { Pin, Minus, X, Settings, Clock, EyeOff } from 'lucide-svelte';
  import ModelSelector from '$lib/components/ModelSelector.svelte';
  import { shutdownServer } from '$lib/services/local/serverOrchestrator';

  let {
    onToggleSettings,
    onToggleHistory,
    onToggleEphemeral,
    showHistory = false,
    isEphemeral = false,
    isSettingsOpen = false
  } = $props<{
    onToggleSettings: () => void;
    onToggleHistory: () => void;
    onToggleEphemeral: () => void;
    showHistory?: boolean;
    isEphemeral?: boolean;
    isSettingsOpen?: boolean;
  }>();

  let isPinned = $state(false);

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
    await shutdownServer();
    await getCurrentWindow().close();
  }
</script>

<div
  class="flex items-center gap-2 pb-2"
  role="toolbar"
  aria-label="Window controls"
  tabindex="-1"
  data-tauri-drag-region
>
  <!-- Left: Model selector (stop propagation to prevent drag) -->
  <div class="pointer-events-auto" role="presentation">
    <ModelSelector />
  </div>

  <!-- Spacer (draggable) -->
  <div class="flex-1" data-tauri-drag-region></div>

  <!-- Right: Action buttons (stop propagation to prevent drag) -->
  <div
    class="flex items-center gap-0.5 pointer-events-auto"
    role="toolbar"
    aria-label="Window actions"
    tabindex="-1"
  >
    <button
      onclick={onToggleEphemeral}
      class="rounded-md p-1.5 transition-colors {isEphemeral
        ? 'bg-amber-500/20 text-amber-300'
        : 'text-white/30 hover:text-white/60 hover:bg-white/5'}"
      aria-label="Toggle Ephemeral Mode"
      title={isEphemeral ? 'Ephemeral (not saved)' : 'Normal (saved)'}
    >
      <EyeOff class="h-3.5 w-3.5" />
    </button>

    <button
      onclick={onToggleHistory}
      class="rounded-md p-1.5 transition-colors {showHistory
        ? 'bg-white/10 text-white'
        : 'text-white/30 hover:text-white/60 hover:bg-white/5'}"
      aria-label="Toggle History"
      title="Chat History"
    >
      <Clock class="h-3.5 w-3.5" />
    </button>

    <button
      onclick={onToggleSettings}
      class="rounded-md p-1.5 transition-colors {isSettingsOpen
        ? 'bg-white/10 text-white'
        : 'text-white/30 hover:text-white/60 hover:bg-white/5'}"
      aria-label="Settings"
      title="Settings"
    >
      <Settings class="h-3.5 w-3.5" />
    </button>

    <div class="mx-0.5 h-4 w-px bg-white/10"></div>

    <button
      class="rounded-md p-1.5 transition-colors {isPinned
        ? 'bg-white/15 text-white'
        : 'text-white/30 hover:text-white/60 hover:bg-white/5'}"
      aria-label="Pin Window"
      title={isPinned ? 'Unpin (Always on Top)' : 'Pin (Always on Top)'}
      onclick={togglePin}
    >
      <Pin class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded-md p-1.5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
      aria-label="Minimize"
      title="Minimize window"
      onclick={minimizeApp}
    >
      <Minus class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded-md p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      aria-label="Close"
      title="Close App"
      onclick={closeApp}
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</div>
