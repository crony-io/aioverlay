<script lang="ts">
  import type { Conversation, ConversationMeta } from '$lib/types';
  import {
    loadConversationList,
    loadConversation,
    deleteConversation,
    createConversation,
    createEphemeralConversation
  } from '$lib/chatHistory';
  import { sendMessageAndStream } from '$lib/stores/chatStore';
  import type { AIStreamHandle } from '$lib/services/ai/types';
  import { createMessageDebounce } from '$lib/utils/messageDebounce';
  import { initSecureStore } from '$lib/storage';
  import {
    registerShortcuts,
    onShortcutAction,
    cleanupShortcuts
  } from '$lib/services/shortcuts/shortcutManager';

  import Titlebar from '$lib/components/Titlebar.svelte';
  import ChatArea from '$lib/components/ChatArea.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import ConversationList from '$lib/components/ConversationList.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import ScreenshotOverlay from '$lib/components/ScreenshotOverlay.svelte';
  import ChatStatusBar from '$lib/components/ChatStatusBar.svelte';
  import { Clock, EyeOff } from 'lucide-svelte';

  let activeTab = $state<'chat' | 'settings'>('chat');
  let isLoading = $state(false);
  let showHistory = $state(false);
  let errorMessage = $state('');
  let streamingContent = $state('');
  let currentStreamHandle = $state<AIStreamHandle | null>(null);

  /** Pre-fill text for ChatInput (U3: captured text goes here instead of auto-sending) */
  let prefillText = $state('');

  /** Number of messages waiting in the debounce buffer */
  let pendingMessages = $state(0);

  /** Queued combined message to send after current stream completes */
  let queuedMessage = $state('');

  /** Base64 image data for screenshot attachment preview (U2) */
  let attachedImage = $state('');

  // Screenshot state
  let screenshotData = $state<{ data: string; width: number; height: number } | null>(null);

  // Conversation state
  let conversations = $state<ConversationMeta[]>([]);
  let currentConversation = $state<Conversation>(createConversation());

  /** Shortcut to current messages */
  let messages = $derived(currentConversation.messages);

  /** Load conversations, init secure key store, and register global shortcuts on mount */
  $effect(() => {
    loadConversationList().then((list) => {
      conversations = list;
    });

    // Push stored API keys into Rust's SecureKeyStore so the HTTP proxy can authenticate
    initSecureStore();

    onShortcutAction((action, payload) => {
      activeTab = 'chat';
      if (action === 'captureText' && payload) {
        prefillText = payload;
      }
      if (action === 'captureScreen' && payload) {
        try {
          screenshotData = JSON.parse(payload);
        } catch {
          console.error('Failed to parse screenshot data');
        }
      }
    });

    registerShortcuts();

    /** U10: App-level keyboard shortcuts */
    function handleKeyboard(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNewChat();
      } else if (e.key === ',' || e.key === '<') {
        e.preventDefault();
        activeTab = activeTab === 'settings' ? 'chat' : 'settings';
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        if (activeTab === 'chat') showHistory = !showHistory;
      }
    }

    window.addEventListener('keydown', handleKeyboard);

    return () => {
      cleanupShortcuts();
      messageDebounce.destroy();
      window.removeEventListener('keydown', handleKeyboard);
    };
  });

  /** U11: Dismiss error manually */
  function dismissError() {
    errorMessage = '';
  }

  /** Send a combined message to the AI (called by debounce flush or queue drain) */
  async function dispatchToAI(text: string) {
    if (!text) return;

    isLoading = true;
    errorMessage = '';
    streamingContent = '';

    const handle = await sendMessageAndStream({
      conversation: currentConversation,
      userText: text,
      onConversationUpdate: (conv) => {
        currentConversation = { ...conv };
        if (!conv.ephemeral) loadConversationList().then((list) => (conversations = list));
      },
      onStreamChunk: (fullContent) => {
        streamingContent = fullContent;
      },
      onComplete: (conv) => {
        currentConversation = { ...conv };
        streamingContent = '';
        isLoading = false;
        currentStreamHandle = null;
        if (!conv.ephemeral) loadConversationList().then((list) => (conversations = list));

        // Auto-send queued messages that arrived while AI was busy
        if (queuedMessage) {
          const queued = queuedMessage;
          queuedMessage = '';
          dispatchToAI(queued);
        }
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

  /** Debounce handle — batches rapid-fire messages before sending to AI */
  const messageDebounce = createMessageDebounce({
    onFlush: (combinedText) => {
      if (isLoading) {
        // AI is busy — queue for after current stream completes
        queuedMessage = queuedMessage ? `${queuedMessage}\n${combinedText}` : combinedText;
      } else {
        dispatchToAI(combinedText);
      }
    },
    onPendingChange: (count) => {
      pendingMessages = count;
    },
    delayMs: 2000
  });

  /** Handle user message — enqueues into debounce buffer */
  function handleMessageSubmit(text: string) {
    if (!text) return;
    messageDebounce.enqueue(text);
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
    messageDebounce.cancel();
    queuedMessage = '';
    currentConversation = createConversation();
    showHistory = false;
  }

  /** Start an ephemeral conversation (not persisted to disk) */
  function handleNewEphemeralChat() {
    if (currentStreamHandle) handleStopStream();
    messageDebounce.cancel();
    queuedMessage = '';
    currentConversation = createEphemeralConversation();
    showHistory = false;
  }

  /** Select an existing conversation */
  async function handleSelectConversation(id: string) {
    if (currentStreamHandle) handleStopStream();
    messageDebounce.cancel();
    queuedMessage = '';
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

  /** Handle confirmed screenshot selection — show preview thumbnail so user can add a prompt */
  function handleScreenshotConfirm(croppedBase64: string) {
    screenshotData = null;
    attachedImage = croppedBase64;
  }

  /** Cancel screenshot selection */
  function handleScreenshotCancel() {
    screenshotData = null;
  }
</script>

{#if screenshotData}
  <ScreenshotOverlay
    {screenshotData}
    onConfirm={handleScreenshotConfirm}
    onCancel={handleScreenshotCancel}
  />
{/if}

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

      <!-- Chat tab actions -->
      {#if activeTab === 'chat'}
        <button
          onclick={handleNewEphemeralChat}
          class="rounded-lg p-1.5 transition-colors {currentConversation.ephemeral
            ? 'bg-amber-500/20 text-amber-300'
            : 'text-white/40 hover:text-white/70'}"
          aria-label="Ephemeral Chat"
          title={currentConversation.ephemeral
            ? 'In ephemeral mode (not saved)'
            : 'New ephemeral chat (not saved)'}
        >
          <EyeOff class="h-4 w-4" />
        </button>
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

        <ChatArea
          {messages}
          {isLoading}
          {streamingContent}
          {errorMessage}
          ephemeral={currentConversation.ephemeral ?? false}
          onDismissError={dismissError}
          onQuickPrompt={(text) => (prefillText = text)}
        />

        <div class="border-t pt-2 mt-auto" style="border-color: var(--border-subtle);">
          <ChatStatusBar />
          <ChatInput
            onSubmit={handleMessageSubmit}
            isStreaming={!!currentStreamHandle}
            onStop={handleStopStream}
            {pendingMessages}
            bind:prefillText
            bind:attachedImage
          />
        </div>
      {:else}
        <Settings />
      {/if}
    </div>
  </div>
</div>
