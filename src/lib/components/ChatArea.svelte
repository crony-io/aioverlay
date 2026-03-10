<script lang="ts" module>
  export type MessageRole = 'user' | 'assistant' | 'system';
  
  export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    model?: string;
  }
</script>

<script lang="ts">
  import Markdown from './Markdown.svelte';

  let { messages = [] } = $props<{ messages: ChatMessage[] }>();
</script>

<div class="flex h-[300px] flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
  {#if messages.length === 0}
    <div class="flex h-full flex-col items-center justify-center text-center text-white/40">
      <div class="mb-3 rounded-full bg-white/5 p-4">
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
        <div class="max-w-[85%] rounded-2xl px-4 py-3 {msg.role === 'user' ? 'bg-indigo-500/80 text-white shadow-md' : 'bg-black/40 border border-white/10 text-white/90 shadow-sm'}">
          {#if msg.role === 'assistant'}
            <Markdown content={msg.content} />
          {:else}
            <p class="whitespace-pre-wrap text-sm">{msg.content}</p>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  /* Custom scrollbar for the chat area */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
