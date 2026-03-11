<script lang="ts">
  import { Keyboard, Check, X } from 'lucide-svelte';
  import { formatAccelerator } from '$lib/services/shortcuts/shortcutManager';

  let { label, value, onChange } = $props<{
    label: string;
    value: string;
    onChange: (accelerator: string) => void;
  }>();

  let isRecording = $state(false);
  /** The last valid accelerator captured during this recording session */
  let capturedAccelerator = $state('');
  /** Ref for the key capture button — auto-focused when recording starts */
  let captureRef = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (isRecording && captureRef) {
      captureRef.focus();
    }
  });

  /** Map browser key names to Tauri accelerator format */
  function toTauriKey(key: string): string | null {
    const map: Record<string, string> = {
      Control: 'CommandOrControl',
      Meta: 'CommandOrControl',
      Shift: 'Shift',
      Alt: 'Alt',
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right'
    };

    if (map[key]) return map[key];

    if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
      return key.toUpperCase();
    }

    // F1-F24
    if (/^F([1-9]|1\d|2[0-4])$/.test(key)) return key;

    return null;
  }

  /** Check if a key is a modifier */
  function isModifier(key: string): boolean {
    return ['Control', 'Meta', 'Shift', 'Alt'].includes(key);
  }

  /** Build Tauri accelerator string from a KeyboardEvent */
  function buildFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    const mapped = toTauriKey(e.key);
    if (!mapped || isModifier(e.key)) return '';

    parts.push(mapped);
    return parts.join('+');
  }

  /** Validate: needs modifier+key OR standalone F-key */
  function isValidAccelerator(accel: string): boolean {
    if (!accel) return false;
    const parts = accel.split('+');
    if (parts.length === 1) {
      return /^F([1-9]|1\d|2[0-4])$/.test(parts[0]);
    }
    return parts.length >= 2;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      cancelRecording();
      return;
    }

    const accel = buildFromEvent(e);
    if (accel && isValidAccelerator(accel)) {
      capturedAccelerator = accel;
    }
  }

  function startRecording() {
    capturedAccelerator = '';
    isRecording = true;
  }

  function confirmRecording() {
    if (capturedAccelerator) {
      onChange(capturedAccelerator);
    }
    isRecording = false;
    capturedAccelerator = '';
  }

  function cancelRecording() {
    isRecording = false;
    capturedAccelerator = '';
  }

  let displayText = $derived(
    isRecording
      ? capturedAccelerator
        ? formatAccelerator(capturedAccelerator)
        : 'Press a key combo...'
      : formatAccelerator(value)
  );

  let hasValidCapture = $derived(isRecording && !!capturedAccelerator);
</script>

<div class="flex items-center gap-2">
  <span class="w-24 shrink-0 text-sm text-white/80">{label}</span>

  {#if isRecording}
    <!-- Recording mode: show captured combo + Set/Cancel buttons -->
    <div
      class="flex flex-1 items-center gap-1.5 rounded-lg border border-indigo-500/70 bg-indigo-500/10 px-3 py-1.5 text-sm ring-1 ring-indigo-500/30"
      role="group"
    >
      <Keyboard class="h-3.5 w-3.5 shrink-0 text-indigo-400" />
      <button
        bind:this={captureRef}
        class="flex-1 text-left truncate text-indigo-300 bg-transparent border-none p-0 outline-none"
        onkeydown={handleKeyDown}
        aria-label="Press your desired shortcut"
      >
        {displayText}
      </button>
      <button
        class="rounded px-2 py-0.5 text-xs font-medium transition-colors
          {hasValidCapture
          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
          : 'bg-white/5 text-white/20 cursor-not-allowed'}"
        disabled={!hasValidCapture}
        onmousedown={(e) => {
          e.preventDefault();
          confirmRecording();
        }}
        aria-label="Confirm shortcut"
      >
        <Check class="h-3.5 w-3.5" />
      </button>
      <button
        class="rounded px-2 py-0.5 text-xs font-medium bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-300 transition-colors"
        onmousedown={(e) => {
          e.preventDefault();
          cancelRecording();
        }}
        aria-label="Cancel recording"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
  {:else}
    <!-- Display mode: click to start recording -->
    <button
      class="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white transition-colors"
      onclick={startRecording}
      aria-label="Record shortcut for {label}"
    >
      <Keyboard class="h-3.5 w-3.5 shrink-0 text-white/40" />
      <span class="truncate">{displayText}</span>
    </button>
  {/if}
</div>
