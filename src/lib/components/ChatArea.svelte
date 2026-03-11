<script lang="ts">
  import type { ChatMessage } from '$lib/types';
  import Markdown from '$lib/components/Markdown.svelte';
  import TypingIndicator from '$lib/components/TypingIndicator.svelte';
  import { formatRelativeTime } from '$lib/utils/formatTime';
  import {
    MessageSquare,
    Command,
    Camera,
    X,
    TriangleAlert,
    Sparkles,
    EyeOff
  } from 'lucide-svelte';

  let {
    messages = [],
    isLoading = false,
    streamingContent = '',
    errorMessage = '',
    ephemeral = false,
    onDismissError,
    onQuickPrompt
  } = $props<{
    messages: ChatMessage[];
    isLoading?: boolean;
    streamingContent?: string;
    errorMessage?: string;
    ephemeral?: boolean;
    onDismissError?: () => void;
    onQuickPrompt?: (text: string) => void;
  }>();

  const quickPrompts = [
    { label: 'Explain this code', prompt: 'Explain this code in detail:' },
    { label: 'Debug this error', prompt: 'Help me debug this error:' },
    { label: 'Write a summary', prompt: 'Summarize the following:' }
  ];

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
  {#if ephemeral}
    <div
      class="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-[11px] text-amber-300/80 mt-2"
    >
      <EyeOff class="h-3 w-3 shrink-0" />
      <span>Ephemeral mode — this conversation won't be saved</span>
    </div>
  {/if}

  {#if messages.length === 0 && !isLoading}
    <div
      class="flex h-full flex-col items-center justify-center text-center"
      style="color: var(--text-muted);"
    >
      <div class="mb-3 rounded-full p-4" style="background: var(--surface-overlay);">
        <MessageSquare class="h-8 w-8 text-indigo-400/50" />
      </div>
      <p class="text-sm font-medium">How can I help you today?</p>

      <div class="mt-3 flex flex-col gap-1.5 text-[11px]">
        <div class="flex items-center gap-2">
          <Command class="h-3 w-3 text-indigo-400/60" />
          <span
            ><kbd class="rounded bg-white/10 px-1.5 py-0.5">Ctrl+Shift+C</kbd> Copy &amp; ask about selected
            text</span
          >
        </div>
        <div class="flex items-center gap-2">
          <Camera class="h-3 w-3 text-indigo-400/60" />
          <span
            ><kbd class="rounded bg-white/10 px-1.5 py-0.5">Ctrl+Shift+S</kbd> Capture screen region</span
          >
        </div>
      </div>

      {#if onQuickPrompt}
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          {#each quickPrompts as qp (qp.label)}
            <button
              onclick={() => onQuickPrompt(qp.prompt)}
              class="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/50 hover:text-white/80 hover:border-white/20 hover:bg-white/5 transition-colors"
            >
              <Sparkles class="h-3 w-3 text-indigo-400/40" />
              {qp.label}
            </button>
          {/each}
        </div>
      {/if}
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
        <div class="mt-1 flex items-center gap-1.5 px-2">
          {#if msg.incomplete}
            <TriangleAlert class="h-3 w-3 text-amber-400/70" />
            <span class="text-[10px] text-amber-400/70">Incomplete</span>
            <span class="text-[10px]" style="color: var(--text-muted);">·</span>
          {/if}
          <span class="text-[10px]" style="color: var(--text-muted);">
            {formatRelativeTime(msg.timestamp)}
          </span>
        </div>
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
          class="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300"
        >
          <span class="flex-1">{errorMessage}</span>
          {#if onDismissError}
            <button
              onclick={onDismissError}
              class="shrink-0 rounded p-0.5 hover:bg-red-500/20 transition-colors"
              aria-label="Dismiss error"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
