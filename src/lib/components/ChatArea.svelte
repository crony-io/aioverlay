<script lang="ts">
  import type { ChatMessage } from '$lib/types';
  import Markdown from '$lib/components/Markdown.svelte';
  import TypingIndicator from '$lib/components/TypingIndicator.svelte';
  import { formatRelativeTime } from '$lib/utils/formatTime';
  import { MessageSquare } from 'lucide-svelte';

  let {
    messages = [],
    isLoading = false,
    streamingContent = '',
    errorMessage = ''
  } = $props<{
    messages: ChatMessage[];
    isLoading?: boolean;
    streamingContent?: string;
    errorMessage?: string;
  }>();

  let scrollContainer: HTMLDivElement | undefined = $state();

  /** Scroll to the bottom of the chat whenever messages change or loading state changes */
  $effect(() => {
    // Track dependencies
    void messages.length;
    void isLoading;
    void streamingContent;

    if (scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
      });
    }
  });
</script>

<div
  bind:this={scrollContainer}
  class="flex flex-1 flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar"
>
  {#if messages.length === 0 && !isLoading}
    <div
      class="flex h-full flex-col items-center justify-center text-center"
      style="color: var(--text-muted);"
    >
      <div class="mb-3 rounded-full p-4" style="background: var(--surface-overlay);">
        <MessageSquare class="h-8 w-8 text-indigo-400/50" />
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
          style={msg.role === 'assistant'
            ? 'background: var(--surface-raised); border-color: var(--border-subtle);'
            : ''}
        >
          {#if msg.role === 'assistant'}
            <Markdown content={msg.content} />
          {:else}
            <p class="whitespace-pre-wrap text-sm">{msg.content}</p>
          {/if}
        </div>
        <span class="mt-1 px-2 text-[10px]" style="color: var(--text-muted);">
          {formatRelativeTime(msg.timestamp)}
        </span>
      </div>
    {/each}

    {#if streamingContent}
      <div class="flex flex-col items-start">
        <div
          class="max-w-[85%] rounded-2xl border px-4 py-3 text-white/90 shadow-sm"
          style="background: var(--surface-raised); border-color: var(--border-subtle);"
        >
          <Markdown content={streamingContent} />
        </div>
      </div>
    {:else if isLoading}
      <div class="flex flex-col items-start">
        <div
          class="rounded-2xl border shadow-sm"
          style="background: var(--surface-raised); border-color: var(--border-subtle);"
        >
          <TypingIndicator />
        </div>
      </div>
    {/if}

    {#if errorMessage}
      <div class="flex justify-center">
        <div
          class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300"
        >
          {errorMessage}
        </div>
      </div>
    {/if}
  {/if}
</div>
