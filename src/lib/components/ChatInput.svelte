<script lang="ts">
  import { Send, Square, Timer } from 'lucide-svelte';
  import AttachmentPreview from '$lib/components/AttachmentPreview.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { ensureServerRunning } from '$lib/services/local/serverOrchestrator';

  let {
    onSubmit,
    isStreaming = false,
    onStop,
    pendingMessages = 0,
    prefillText = $bindable(''),
    attachedImage = $bindable('')
  } = $props<{
    onSubmit: (text: string) => void;
    isStreaming?: boolean;
    onStop?: () => void;
    /** Number of messages waiting in the debounce buffer */
    pendingMessages?: number;
    prefillText?: string;
    /** Base64 image data (without data URI prefix) attached via screenshot */
    attachedImage?: string;
  }>();

  let inputText = $state('');

  /** Apply prefilled text from parent (e.g. captured text via shortcut) */
  $effect(() => {
    if (prefillText) {
      inputText = prefillText;
      prefillText = '';
      requestAnimationFrame(() => handleInput());
      textareaEl?.focus();
    }
  });

  /** Auto-focus when an image is attached so Enter sends immediately */
  $effect(() => {
    if (attachedImage) {
      textareaEl?.focus();
    }
  });
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  /** When user focuses the input and local provider needs a server, auto-start it */
  function handleFocus() {
    if (settingsStore.activeProvider === 'local' && settingsStore.serverStatus !== 'ready') {
      ensureServerRunning();
    }
  }

  let canSubmit = $derived(
    settingsStore.isReadyToSend && (inputText.trim().length > 0 || attachedImage.length > 0)
  );

  function handleSubmit() {
    const hasText = inputText.trim().length > 0;
    const hasImage = attachedImage.length > 0;
    if (!hasText && !hasImage) return;
    if (!settingsStore.isReadyToSend) {
      ensureServerRunning();
      return;
    }

    let finalText = inputText.trim();
    if (hasImage) {
      const imageMarkdown = `![Screenshot](data:image/png;base64,${attachedImage})`;
      finalText = finalText
        ? `${finalText}\n\n${imageMarkdown}`
        : `Analyze this screenshot:\n\n${imageMarkdown}`;
      attachedImage = '';
    }

    onSubmit(finalText);
    inputText = '';
    resetHeight();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  /** Auto-grow textarea up to 4 lines */
  function handleInput() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    const maxHeight = 4 * 24; // ~4 rows
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, maxHeight)}px`;
  }

  function resetHeight() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
  }
</script>

<div class="flex flex-col gap-0">
  {#if attachedImage}
    <AttachmentPreview imageData={attachedImage} onRemove={() => (attachedImage = '')} />
  {/if}

  {#if pendingMessages > 0}
    <div class="flex items-center gap-1.5 px-2 py-1 text-[10px] text-amber-300/70 animate-pulse">
      <Timer class="h-3 w-3" />
      <span
        >Batching {pendingMessages} message{pendingMessages > 1 ? 's' : ''}… sending shortly</span
      >
    </div>
  {/if}

  <div class="flex gap-3 relative">
    <textarea
      bind:this={textareaEl}
      bind:value={inputText}
      onkeydown={handleKeydown}
      oninput={handleInput}
      onfocus={handleFocus}
      placeholder={settingsStore.activeProvider === 'local' &&
      settingsStore.serverStatus === 'starting'
        ? 'Starting local server…'
        : settingsStore.activeProvider === 'local' && settingsStore.serverStatus === 'error'
          ? 'Server error — click to retry'
          : isStreaming
            ? 'Type to queue next message...'
            : pendingMessages > 0
              ? `Batching ${pendingMessages} message${pendingMessages > 1 ? 's' : ''}...`
              : 'Ask Ai Overlay... (Enter to send)'}
      rows="1"
      class="w-full resize-none rounded-xl border py-3 pl-4 pr-12 text-sm text-white shadow-inner focus:outline-none focus:ring-1 custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed"
      style="
      background: var(--surface-input);
      border-color: var(--border-default);
      --tw-ring-color: var(--border-focus);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    "
      style:color="var(--text-primary)"
    ></textarea>
    {#if isStreaming}
      <button
        onclick={() => onStop?.()}
        class="absolute right-2 top-2 bottom-2 rounded-lg px-3 py-1 font-semibold text-white shadow-lg focus:outline-none"
        style="
        background: var(--accent-danger);
        transition: background var(--transition-fast);
      "
        aria-label="Stop Generation"
        title="Stop Generation"
      >
        <Square class="size-4" />
      </button>
    {:else}
      <button
        onclick={handleSubmit}
        disabled={!canSubmit}
        class="absolute right-2 top-2 bottom-2 rounded-lg px-3 py-1 font-semibold text-white shadow-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        style="
        background: var(--accent-primary);
        transition: background var(--transition-fast);
      "
        aria-label="Send Message"
        title="Send Message"
      >
        <Send class="size-5" />
      </button>
    {/if}
  </div>
</div>
