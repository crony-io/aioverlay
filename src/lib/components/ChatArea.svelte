<script lang="ts">
  import type { ChatMessage } from '$lib/types';
  import Markdown from '$lib/components/Markdown.svelte';
  import TypingIndicator from '$lib/components/TypingIndicator.svelte';

  let { messages = [], isLoading = false } = $props<{
    messages: ChatMessage[];
    isLoading?: boolean;
  }>();

  let scrollContainer: HTMLDivElement | undefined = $state();

  /** Scroll to the bottom of the chat whenever messages change or loading state changes */
  $effect(() => {
    // Track dependencies
    void messages.length;
    void isLoading;

    if (scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
      });
    }
  });

  /** Format a timestamp into a relative time string */
  function formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return new Date(timestamp).toLocaleDateString();
  }
</script>

<div
  bind:this={scrollContainer}
  class="flex flex-1 flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar"
>
  {#if messages.length === 0 && !isLoading}
    <div class="flex h-full flex-col items-center justify-center text-center" style="color: var(--text-muted);">
      <div class="mb-3 rounded-full p-4" style="background: var(--surface-overlay);">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <p class="text-sm font-medium">How can I help you today?</p>
      <p class="mt-1 text-xs">Press Ctrl+Shift+S to capture screen context</p>
    </div>
  {:else}
    {#each messages as msg (msg.id)}
      <div class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'}">
        <div
          class="max-w-[85%] rounded-2xl px-4 py-3 {msg.role === 'user'
            ? 'bg-indigo-500/80 text-white shadow-md'
            : 'border text-white/90 shadow-sm'}"
          style={msg.role === 'assistant' ? 'background: var(--surface-raised); border-color: var(--border-subtle);' : ''}
        >
          {#if msg.role === 'assistant'}
            <Markdown content={msg.content} />
          {:else}
            <p class="whitespace-pre-wrap text-sm">{msg.content}</p>
          {/if}
        </div>
        <span class="mt-1 px-2 text-[10px]" style="color: var(--text-muted);">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    {/each}

    {#if isLoading}
      <div class="flex flex-col items-start">
        <div class="rounded-2xl border shadow-sm" style="background: var(--surface-raised); border-color: var(--border-subtle);">
          <TypingIndicator />
        </div>
      </div>
    {/if}
  {/if}
</div>
