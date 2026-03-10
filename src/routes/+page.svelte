<script lang="ts">
  import type { Conversation, ConversationMeta } from '$lib/types';
  import {
    loadConversationList,
    loadConversation,
    deleteConversation,
    createConversation,
    sendMessageAndStream
  } from '$lib/stores/chatStore';
  import type { AIStreamHandle } from '$lib/services/ai/types';

  import Titlebar from '$lib/components/Titlebar.svelte';
  import ChatArea from '$lib/components/ChatArea.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import ConversationList from '$lib/components/ConversationList.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import { Clock } from 'lucide-svelte';

  let activeTab = $state<'chat' | 'settings'>('chat');
  let isLoading = $state(false);
  let showHistory = $state(false);
  let errorMessage = $state('');
  let streamingContent = $state('');
  let currentStreamHandle = $state<AIStreamHandle | null>(null);

  // Conversation state
  let conversations = $state<ConversationMeta[]>([]);
  let currentConversation = $state<Conversation>(createConversation());

  /** Shortcut to current messages */
  let messages = $derived(currentConversation.messages);

  /** Load conversations on mount */
  $effect(() => {
    loadConversationList().then((list) => {
      conversations = list;
    });
  });

  /** Auto-dismiss error after 5 seconds */
  $effect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => (errorMessage = ''), 5000);
      return () => clearTimeout(timer);
    }
  });

  /** Handle sending a new message */
  async function handleMessageSubmit(text: string) {
    if (!text || isLoading) return;

    isLoading = true;
    errorMessage = '';
    streamingContent = '';

    const handle = await sendMessageAndStream({
      conversation: currentConversation,
      userText: text,
      onConversationUpdate: (conv) => {
        currentConversation = { ...conv };
        loadConversationList().then((list) => (conversations = list));
      },
      onStreamChunk: (fullContent) => {
        streamingContent = fullContent;
      },
      onComplete: (conv) => {
        currentConversation = { ...conv };
        streamingContent = '';
        isLoading = false;
        currentStreamHandle = null;
        loadConversationList().then((list) => (conversations = list));
      },
      onError: (error) => {
        errorMessage = error;
        streamingContent = '';
        isLoading = false;
        currentStreamHandle = null;
      }
    });

    currentStreamHandle = handle;
  }

  /** Stop the current AI stream */
  function handleStopStream() {
    currentStreamHandle?.abort();
    currentStreamHandle = null;
    isLoading = false;
  }

  /** Start a new conversation */
  function handleNewChat() {
    if (currentStreamHandle) handleStopStream();
    currentConversation = createConversation();
    showHistory = false;
  }

  /** Select an existing conversation */
  async function handleSelectConversation(id: string) {
    if (currentStreamHandle) handleStopStream();
    const conv = await loadConversation(id);
    if (conv) {
      currentConversation = conv;
    }
    showHistory = false;
  }

  /** Delete a conversation */
  async function handleDeleteConversation(id: string) {
    await deleteConversation(id);
    conversations = await loadConversationList();

    if (id === currentConversation.id) {
      currentConversation = createConversation();
    }
  }
</script>

<div class="flex h-full w-full items-center justify-center p-8">
  <!-- Glassmorphic Container -->
  <div
    class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border p-6 text-white shadow-2xl backdrop-blur-xl"
    style="
      background: var(--surface-base);
      border-color: var(--border-default);
      height: 520px;
    "
  >
    <Titlebar />

    <!-- Tabs -->
    <div
      class="flex items-center gap-4 border-b mb-4 px-2"
      style="border-color: var(--border-subtle);"
    >
      <button
        class="pb-2 font-medium transition-colors {activeTab === 'chat'
          ? 'border-b-2 border-indigo-500 text-white'
          : 'text-white/50 hover:text-white/80'}"
        onclick={() => (activeTab = 'chat')}
      >
        Chat
      </button>
      <button
        class="pb-2 font-medium transition-colors {activeTab === 'settings'
          ? 'border-b-2 border-indigo-500 text-white'
          : 'text-white/50 hover:text-white/80'}"
        onclick={() => (activeTab = 'settings')}
      >
        Settings
      </button>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- History toggle (only on chat tab) -->
      {#if activeTab === 'chat'}
        <button
          class="rounded-lg p-1.5 transition-colors {showHistory
            ? 'bg-white/10 text-white'
            : 'text-white/40 hover:text-white/70'}"
          onclick={() => (showHistory = !showHistory)}
          aria-label="Toggle History"
          title="Chat History"
        >
          <Clock class="h-4 w-4" />
        </button>
      {/if}
    </div>

    <!-- Content Area -->
    <div
      class="flex-1 flex flex-col overflow-hidden rounded-xl border p-4 pb-2 pt-0"
      style="background: var(--surface-raised); border-color: var(--border-subtle);"
    >
      {#if activeTab === 'chat'}
        <!-- History panel (collapsible) -->
        {#if showHistory}
          <div class="border-b py-3" style="border-color: var(--border-subtle);">
            <ConversationList
              {conversations}
              activeConversationId={currentConversation.id}
              onSelect={handleSelectConversation}
              onNewChat={handleNewChat}
              onDelete={handleDeleteConversation}
            />
          </div>
        {/if}

        <ChatArea {messages} {isLoading} {streamingContent} {errorMessage} />

        <div class="border-t pt-2 mt-auto" style="border-color: var(--border-subtle);">
          <ChatInput
            onSubmit={handleMessageSubmit}
            disabled={isLoading}
            isStreaming={!!currentStreamHandle}
            onStop={handleStopStream}
          />
        </div>
      {:else}
        <Settings />
      {/if}
    </div>
  </div>
</div>
