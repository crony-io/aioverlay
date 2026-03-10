<script lang="ts">
  import { Keyboard } from 'lucide-svelte';

  let { label, value = $bindable() } = $props<{
    label: string;
    value: string;
  }>();

  let isRecording = $state(false);
  let pressedKeys = $state<Set<string>>(new Set());

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
      ArrowRight: 'Right',
      Escape: 'Escape',
      Enter: 'Enter',
      Backspace: 'Backspace',
      Delete: 'Delete',
      Tab: 'Tab',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown'
    };

    if (map[key]) return map[key];

    if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
      return key.toUpperCase();
    }

    if (/^F([1-9]|1[0-2])$/.test(key)) return key;

    return null;
  }

  /** Check if a key is a modifier */
  function isModifier(key: string): boolean {
    return ['Control', 'Meta', 'Shift', 'Alt'].includes(key);
  }

  /** Build Tauri accelerator string from current pressed keys */
  function buildAccelerator(): string {
    const modifiers: string[] = [];
    let mainKey = '';

    for (const key of pressedKeys) {
      const mapped = toTauriKey(key);
      if (!mapped) continue;

      if (isModifier(key)) {
        if (!modifiers.includes(mapped)) modifiers.push(mapped);
      } else {
        mainKey = mapped;
      }
    }

    if (!mainKey) return '';
    return [...modifiers, mainKey].join('+');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape' && pressedKeys.size === 0) {
      isRecording = false;
      return;
    }

    pressedKeys = new Set([...pressedKeys, e.key]);
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    const hasModifier = [...pressedKeys].some(isModifier);
    const hasMainKey = [...pressedKeys].some((k) => !isModifier(k));

    // Only finalize when we have at least one modifier + one main key
    if (!hasModifier || !hasMainKey) {
      // If all keys released without a valid combo, just reset
      if (!e.repeat && [...pressedKeys].every((k) => k === e.key || isModifier(k))) {
        pressedKeys = new Set();
      }
      return;
    }

    const accelerator = buildAccelerator();
    if (accelerator) {
      value = accelerator;
    }

    pressedKeys = new Set();
    isRecording = false;
  }

  function startRecording() {
    pressedKeys = new Set();
    isRecording = true;
  }

  /** Format the accelerator string for display */
  function formatDisplay(accelerator: string): string {
    if (!accelerator) return 'Not set';
    return accelerator
      .split('+')
      .map((k) => {
        if (k === 'CommandOrControl') return 'Ctrl';
        return k;
      })
      .join(' + ');
  }

  let displayText = $derived(
    isRecording
      ? pressedKeys.size > 0
        ? [...pressedKeys].map((k) => toTauriKey(k) ?? k).join(' + ')
        : 'Press keys...'
      : formatDisplay(value)
  );
</script>

<div class="flex items-center gap-2">
  <span class="w-24 shrink-0 text-sm text-white/80">{label}</span>
  <button
    class="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
      {isRecording
        ? 'border-indigo-500/70 bg-indigo-500/10 text-white ring-1 ring-indigo-500/30'
        : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'}"
    onclick={startRecording}
    onkeydown={handleKeyDown}
    onkeyup={handleKeyUp}
    onblur={() => { isRecording = false; pressedKeys = new Set(); }}
    aria-label="Record shortcut for {label}"
  >
    <Keyboard class="h-3.5 w-3.5 shrink-0 {isRecording ? 'text-indigo-400' : 'text-white/40'}" />
    <span class="truncate {isRecording ? 'text-indigo-300' : ''}">{displayText}</span>
  </button>
</div>
