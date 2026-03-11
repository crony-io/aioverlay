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
    cleanupShortcuts,
    getBinding,
    formatAccelerator
  } from '$lib/services/shortcuts/shortcutManager';

  import ChatHeader from '$lib/components/ChatHeader.svelte';
  import ChatArea from '$lib/components/ChatArea.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import ConversationList from '$lib/components/ConversationList.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import ScreenshotOverlay from '$lib/components/ScreenshotOverlay.svelte';
  import UpdateNotification from '$lib/components/UpdateNotification.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { errorStore, showError } from '$lib/stores/errorStore.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { ensureServerRunning, destroyOrchestrator } from '$lib/services/local/serverOrchestrator';
  import { X } from 'lucide-svelte';

  /** Convert a KeyboardEvent into a Tauri accelerator string for matching against stored bindings */
  function buildAcceleratorFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    const key = e.key;
    // Skip if the key itself is just a modifier
    if (['Control', 'Meta', 'Shift', 'Alt'].includes(key)) return '';

    // Map special keys
    const keyMap: Record<string, string> = {
      ',': ',',
      '<': ',',
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right'
    };

    let mapped = keyMap[key];
    if (!mapped) {
      if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
        mapped = key.toUpperCase();
      } else if (/^F([1-9]|1\d|2[0-4])$/.test(key)) {
        mapped = key;
      } else {
        mapped = key;
      }
    }

    parts.push(mapped);
    return parts.join('+');
  }

  let showSettings = $state(false);
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
    loadConversationList()
      .then((list) => {
        conversations = list;
      })
      .catch((e) => showError(e));

    // Push stored API keys into Rust's SecureKeyStore so the HTTP proxy can authenticate
    initSecureStore().catch((e) => showError(e));

    /* Auto-start local server if local provider is selected */
    if (settingsStore.activeProvider === 'local') {
      ensureServerRunning();
    }

    onShortcutAction((action, payload) => {
      showSettings = false;
      if (action === 'captureText' && payload) {
        prefillText = payload;
      }
      if (action === 'captureScreen' && payload) {
        if (!settingsStore.activeModelSupportsVision) {
          showError(
            'Screenshot capture is not available — the selected model does not support vision.'
          );
          return;
        }
        try {
          screenshotData = JSON.parse(payload);
        } catch (e) {
          showError(`Failed to parse screenshot data: ${e}`);
        }
      }
    });

    registerShortcuts().catch((e) => showError(e));

    /** App-level keyboard shortcuts — reads configurable bindings */
    function handleKeyboard(e: KeyboardEvent) {
      const pressed = buildAcceleratorFromEvent(e);
      if (!pressed) return;

      const newChatKey = getBinding('newChat');
      const historyKey = getBinding('toggleHistory');
      const settingsKey = getBinding('toggleSettings');

      if (pressed === newChatKey) {
        e.preventDefault();
        handleNewChat();
      } else if (pressed === settingsKey) {
        e.preventDefault();
        showSettings = !showSettings;
      } else if (pressed === historyKey) {
        e.preventDefault();
        showHistory = !showHistory;
      }
    }

    window.addEventListener('keydown', handleKeyboard);

    return () => {
      cleanupShortcuts();
      destroyOrchestrator();
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

    try {
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to send message';
      errorMessage = msg;
      showError(msg);
      streamingContent = '';
      isLoading = false;
      currentStreamHandle = null;
    }
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
    // Always clear loading/error state so a new conversation starts clean
    isLoading = false;
    errorMessage = '';
    streamingContent = '';
    currentStreamHandle = null;
    currentConversation = createConversation();
    showHistory = false;
  }

  /** Toggle ephemeral mode — if already ephemeral switch to normal, otherwise start ephemeral */
  function handleToggleEphemeral() {
    if (currentStreamHandle) handleStopStream();
    messageDebounce.cancel();
    queuedMessage = '';
    isLoading = false;
    errorMessage = '';
    streamingContent = '';
    currentStreamHandle = null;
    if (currentConversation.ephemeral) {
      currentConversation = createConversation();
    } else {
      currentConversation = createEphemeralConversation();
    }
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

{#if errorStore.error}
  <ConfirmDialog
    title="Error"
    message={errorStore.error}
    confirmLabel="OK"
    onConfirm={() => errorStore.dismiss()}
    onCancel={() => errorStore.dismiss()}
  />
{/if}

{#if screenshotData}
  <ScreenshotOverlay
    {screenshotData}
    onConfirm={handleScreenshotConfirm}
    onCancel={handleScreenshotCancel}
  />
{/if}

<div class="flex h-full w-full items-center justify-center p-8" data-tauri-drag-region>
  <!-- Glassmorphic Container -->
  <div
    class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border p-4 text-white shadow-2xl backdrop-blur-xl"
    data-tauri-drag-region
    style="
      background: var(--surface-base);
      border-color: var(--border-default);
      max-height: 520px;
      height: calc(100vh - 4rem);
    "
  >
    <!-- Compact header: model selector + actions + window controls -->
    <ChatHeader
      onToggleSettings={() => (showSettings = !showSettings)}
      onToggleHistory={() => (showHistory = !showHistory)}
      onToggleEphemeral={handleToggleEphemeral}
      {showHistory}
      isEphemeral={currentConversation.ephemeral ?? false}
      isSettingsOpen={showSettings}
    />

    <UpdateNotification />

    <!-- Chat content (always visible) -->
    <div
      class="flex-1 flex flex-col overflow-hidden rounded-xl border p-4 pb-2 pt-0"
      style="background: var(--surface-raised); border-color: var(--border-subtle);"
    >
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
        copyTextLabel={formatAccelerator(getBinding('captureText'))}
        screenshotLabel={formatAccelerator(getBinding('captureScreen'))}
        onDismissError={dismissError}
        onQuickPrompt={(text) => (prefillText = text)}
      />

      <div class="border-t pt-2 mt-auto" style="border-color: var(--border-subtle);">
        <ChatInput
          onSubmit={handleMessageSubmit}
          isStreaming={!!currentStreamHandle}
          onStop={handleStopStream}
          {pendingMessages}
          bind:prefillText
          bind:attachedImage
        />
      </div>
    </div>

    <!-- Settings drawer (slides over chat) -->
    {#if showSettings}
      <div
        class="absolute inset-0 z-40 flex flex-col rounded-2xl overflow-hidden"
        style="background: var(--surface-base);"
      >
        <!-- Drawer header (draggable) -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b"
          style="border-color: var(--border-subtle);"
          data-tauri-drag-region
        >
          <h2 class="text-sm font-semibold text-white/80 pointer-events-none">Settings</h2>
          <button
            onclick={() => (showSettings = false)}
            class="rounded-md p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors pointer-events-auto"
            aria-label="Close Settings"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <!-- Drawer content -->
        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <Settings />
        </div>
      </div>
    {/if}
  </div>
</div>
