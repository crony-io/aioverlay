<script lang="ts">
  import { Send, Square } from 'lucide-svelte';

  let { onSubmit, disabled = false, isStreaming = false, onStop } = $props<{
    onSubmit: (text: string) => void;
    disabled?: boolean;
    isStreaming?: boolean;
    onStop?: () => void;
  }>();

  let inputText = $state('');
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  function handleSubmit() {
    if (!inputText.trim() || disabled) return;
    onSubmit(inputText);
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

<div class="flex gap-3 relative">
  <textarea
    bind:this={textareaEl}
    bind:value={inputText}
    onkeydown={handleKeydown}
    oninput={handleInput}
    {disabled}
    placeholder={disabled ? 'Waiting for response...' : 'Ask Ai Overlay... (Enter to send)'}
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
      disabled={!inputText.trim() || disabled}
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
