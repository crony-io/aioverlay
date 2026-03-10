<script lang="ts">
  import type { Conversation, ConversationMeta } from '$lib/types';
  import {
    loadConversationList,
    loadConversation,
    saveConversation,
    deleteConversation,
    createConversation,
    generateTitle
  } from '$lib/chatHistory';

  import Titlebar from '$lib/components/Titlebar.svelte';
  import ChatArea from '$lib/components/ChatArea.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import ConversationList from '$lib/components/ConversationList.svelte';
  import Settings from '$lib/components/Settings.svelte';

  let activeTab = $state<'chat' | 'settings'>('chat');
  let isLoading = $state(false);
  let showHistory = $state(false);

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

  /** Handle sending a new message */
  async function handleMessageSubmit(text: string) {
    if (!text || isLoading) return;

    // Add user message
    currentConversation.messages = [
      ...currentConversation.messages,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: Date.now()
      }
    ];

    // Auto-generate title from first message
    if (currentConversation.messages.length === 1) {
      currentConversation.title = generateTitle(currentConversation.messages);
    }

    // Save after user message
    await saveConversation(currentConversation);
    conversations = await loadConversationList();

    // Simulate AI response
    isLoading = true;
    setTimeout(async () => {
      currentConversation.messages = [
        ...currentConversation.messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I received your message: "${text}"\n\nThis is a **test** response from the local state. The actual AI backend is not connected yet.\n\nHere is a code block:\n\`\`\`javascript\nconsole.log('Hello from Ai Overlay!');\n\`\`\``,
          timestamp: Date.now()
        }
      ];

      isLoading = false;

      // Save after AI response
      await saveConversation(currentConversation);
      conversations = await loadConversationList();
    }, 1200);
  }

  /** Start a new conversation */
  function handleNewChat() {
    currentConversation = createConversation();
    showHistory = false;
  }

  /** Select an existing conversation */
  async function handleSelectConversation(id: string) {
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

    // If we deleted the active conversation, start a new one
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
    <div class="flex items-center gap-4 border-b mb-4 px-2" style="border-color: var(--border-subtle);">
      <button
        class="pb-2 font-medium transition-colors {activeTab === 'chat' ? 'border-b-2 border-indigo-500 text-white' : 'text-white/50 hover:text-white/80'}"
        onclick={() => activeTab = 'chat'}
      >
        Chat
      </button>
      <button
        class="pb-2 font-medium transition-colors {activeTab === 'settings' ? 'border-b-2 border-indigo-500 text-white' : 'text-white/50 hover:text-white/80'}"
        onclick={() => activeTab = 'settings'}
      >
        Settings
      </button>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- History toggle (only on chat tab) -->
      {#if activeTab === 'chat'}
        <button
          class="rounded-lg p-1.5 transition-colors {showHistory ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}"
          onclick={() => showHistory = !showHistory}
          aria-label="Toggle History"
          title="Chat History"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden rounded-xl border p-4 pb-2 pt-0" style="background: var(--surface-raised); border-color: var(--border-subtle);">
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

        <ChatArea {messages} {isLoading} />

        <div class="border-t pt-2 mt-auto" style="border-color: var(--border-subtle);">
          <ChatInput onSubmit={handleMessageSubmit} disabled={isLoading} />
        </div>
      {:else}
        <Settings />
      {/if}
    </div>
  </div>
</div>
