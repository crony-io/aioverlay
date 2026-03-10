<script lang="ts">
  let { onSubmit, disabled = false } = $props<{
    onSubmit: (text: string) => void;
    disabled?: boolean;
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  </button>
</div>
