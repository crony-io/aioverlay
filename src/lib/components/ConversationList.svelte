<script lang="ts">
  import type { ConversationMeta } from '$lib/types';
  import { formatRelativeTimeShort } from '$lib/utils/formatTime';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { Plus, Trash2, Search, MessageSquare } from 'lucide-svelte';

  let {
    conversations = [],
    activeConversationId = '',
    onSelect,
    onNewChat,
    onDelete
  } = $props<{
    conversations: ConversationMeta[];
    activeConversationId: string;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    onDelete: (id: string) => void;
  }>();

  let pendingDeleteId = $state<string | null>(null);
  let searchQuery = $state('');

  function filterByQuery(list: ConversationMeta[], query: string): ConversationMeta[] {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }

  let filteredConversations = $derived(filterByQuery(conversations, searchQuery));

  function requestDelete(id: string) {
    pendingDeleteId = id;
  }

  function confirmDelete() {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      pendingDeleteId = null;
    }
  }

  function cancelDelete() {
    pendingDeleteId = null;
  }
</script>

{#if pendingDeleteId}
  <ConfirmDialog
    title="Delete Conversation"
    message="This conversation and all its messages will be permanently deleted."
    confirmLabel="Delete"
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
  />
{/if}

<div class="flex flex-col gap-1">
  <!-- Header row: New Chat + search -->
  <div class="flex items-center gap-2">
    <button
      onclick={onNewChat}
      class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors shrink-0"
      style="background: var(--surface-overlay);"
    >
      <Plus class="h-3.5 w-3.5" />
      New
    </button>

    {#if conversations.length > 3}
      <div class="relative flex-1">
        <Search
          class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30 pointer-events-none"
        />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter…"
          class="w-full rounded-lg border border-white/10 bg-black/30 pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
    {/if}
  </div>

  <!-- Conversation List -->
  {#if filteredConversations.length > 0}
    <div
      class="mt-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar"
      style="max-height: 180px;"
    >
      {#each filteredConversations as conv (conv.id)}
        <div
          class="group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors"
          style="background: {conv.id === activeConversationId
            ? 'var(--surface-overlay)'
            : 'transparent'};"
          role="button"
          tabindex="0"
          onclick={() => onSelect(conv.id)}
          onkeydown={(e) => e.key === 'Enter' && onSelect(conv.id)}
        >
          <div class="flex-1 min-w-0">
            <p
              class="truncate text-sm {conv.id === activeConversationId
                ? 'text-white'
                : 'text-white/60'}"
            >
              {conv.title}
            </p>
            <p class="text-[10px]" style="color: var(--text-muted);">
              {formatRelativeTimeShort(conv.updatedAt)} · {conv.messageCount} msgs
            </p>
          </div>

          <button
            onclick={(e) => {
              e.stopPropagation();
              requestDelete(conv.id);
            }}
            class="ml-2 shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-opacity"
            aria-label="Delete conversation"
            title="Delete"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      {/each}
    </div>
  {:else if conversations.length === 0}
    <div class="flex items-center gap-2 py-3 px-2 text-white/25 text-xs">
      <MessageSquare class="h-4 w-4" />
      <span>No conversations yet</span>
    </div>
  {:else}
    <div class="py-3 px-2 text-white/25 text-xs text-center">
      No matches for "{searchQuery}"
    </div>
  {/if}
</div>
