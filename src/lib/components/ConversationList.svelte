<script lang="ts">
  import type { ConversationMeta } from '$lib/types';
  import { formatRelativeTimeShort } from '$lib/utils/formatTime';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { Plus, Trash2 } from 'lucide-svelte';

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
  <!-- New Chat Button -->
  <button
    onclick={onNewChat}
    class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
    style="background: var(--surface-overlay); transition: background var(--transition-fast);"
  >
    <Plus class="h-4 w-4" />
    New Chat
  </button>

  <!-- Conversation List -->
  {#if conversations.length > 0}
    <div
      class="mt-2 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar"
      style="max-height: 200px;"
    >
      {#each conversations as conv (conv.id)}
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

          <!-- Delete button (visible on hover) -->
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
  {/if}
</div>
