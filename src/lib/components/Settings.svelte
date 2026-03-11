<script lang="ts">
  import { saveApiKey, getApiKey, removeApiKey } from '$lib/storage';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { showError } from '$lib/stores/errorStore.svelte';
  import { getAllBindings, type ShortcutAction } from '$lib/services/shortcuts/shortcutManager';
  import ProviderSelection from '$lib/components/settings/ProviderSelection.svelte';
  import ApiKeysList from '$lib/components/settings/ApiKeysList.svelte';
  import GlobalShortcuts from '$lib/components/settings/GlobalShortcuts.svelte';
  import SystemPrompt from '$lib/components/settings/SystemPrompt.svelte';
  import LocalModelSetup from '$lib/components/settings/LocalModelSetup.svelte';
  import ModelDownloader from '$lib/components/settings/ModelDownloader.svelte';
  import ServerControls from '$lib/components/settings/ServerControls.svelte';
  import { Plug, Key, MessageSquare, Server, Keyboard } from 'lucide-svelte';

  type SettingsTab = 'connection' | 'keys' | 'identity' | 'local' | 'shortcuts';

  const tabs: { id: SettingsTab; label: string; icon: typeof Plug }[] = [
    { id: 'connection', label: 'Connection', icon: Plug },
    { id: 'keys', label: 'Keys', icon: Key },
    { id: 'identity', label: 'Identity', icon: MessageSquare },
    { id: 'local', label: 'Local', icon: Server },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard }
  ];

  let activeSettingsTab = $state<SettingsTab>('connection');

  let openAiKey = $state('');
  let anthropicKey = $state('');
  let geminiKey = $state('');

  /** Bind to the reactive store so changes propagate to ChatStatusBar, chatStore, etc. */
  let activeProvider = $state(settingsStore.activeProvider);
  let activeModel = $state(settingsStore.activeModel);
  let systemPrompt = $state(settingsStore.systemPrompt);
  let webSearchEnabled = $state(settingsStore.webSearchEnabled);
  let shortcutBindings = $state<Record<ShortcutAction, string>>(getAllBindings());

  let savedStatus = $state('');
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoaded = $state(false);

  /** Incremented when models are downloaded/deleted to trigger ServerControls refresh */
  let modelRefreshKey = $state(0);

  async function loadSettings() {
    try {
      openAiKey = (await getApiKey('openai')) || '';
      anthropicKey = (await getApiKey('anthropic')) || '';
      geminiKey = (await getApiKey('gemini')) || '';

      activeProvider = settingsStore.activeProvider;
      activeModel = settingsStore.activeModel;
      systemPrompt = settingsStore.systemPrompt;
      webSearchEnabled = settingsStore.webSearchEnabled;
      shortcutBindings = getAllBindings();
      isLoaded = true;
    } catch (e) {
      showError(e);
    }
  }

  /** Debounced auto-save triggered by reactive changes */
  function scheduleSave() {
    if (!isLoaded) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => performSave(), 800);
  }

  async function performSave() {
    try {
      if (openAiKey) await saveApiKey('openai', openAiKey);
      else await removeApiKey('openai');

      if (anthropicKey) await saveApiKey('anthropic', anthropicKey);
      else await removeApiKey('anthropic');

      if (geminiKey) await saveApiKey('gemini', geminiKey);
      else await removeApiKey('gemini');

      savedStatus = 'Saved ✓';
      setTimeout(() => (savedStatus = ''), 2000);
    } catch (e) {
      savedStatus = 'Error saving!';
      showError(e);
    }
  }

  // Load settings on mount
  $effect(() => {
    loadSettings();
  });

  $effect(() => {
    if (!isLoaded) return;
    settingsStore.activeProvider = activeProvider;
    settingsStore.activeModel = activeModel;
    settingsStore.systemPrompt = systemPrompt;
    settingsStore.webSearchEnabled = webSearchEnabled;
  });

  /** Reverse sync: when orchestrator or ModelSelector updates the store directly,
   *  pull changes back into local state so ProviderSelection stays in sync. */
  $effect(() => {
    const storeProvider = settingsStore.activeProvider;
    const storeModel = settingsStore.activeModel;
    if (storeProvider !== activeProvider) activeProvider = storeProvider;
    if (storeModel !== activeModel) activeModel = storeModel;
  });

  // Debounced auto-save for API keys (async Stronghold operations)
  $effect(() => {
    void openAiKey;
    void anthropicKey;
    void geminiKey;

    scheduleSave();
  });
</script>

<div class="flex h-full gap-0">
  <!-- Icon tab bar (left) -->
  <div
    class="flex flex-col gap-1 border-r pr-2 pt-1 shrink-0"
    style="border-color: var(--border-subtle);"
  >
    {#each tabs as tab (tab.id)}
      {@const Icon = tab.icon}
      <button
        onclick={() => (activeSettingsTab = tab.id)}
        class="group flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors
          {activeSettingsTab === tab.id
          ? 'bg-indigo-500/15 text-white/90'
          : 'text-white/40 hover:text-white/60 hover:bg-white/5'}"
        title={tab.label}
        aria-label={tab.label}
      >
        <Icon class="h-4 w-4 shrink-0" />
        <span class="hidden sm:inline">{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Tab content (right) -->
  <div class="flex-1 overflow-y-auto pl-3 pr-1 custom-scrollbar">
    {#if activeSettingsTab === 'connection'}
      <div class="flex flex-col gap-3">
        <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider">
          AI Provider & Model
        </h3>
        <ProviderSelection
          bind:activeProvider
          bind:activeModel
          bind:webSearchEnabled
          refreshKey={modelRefreshKey}
        />
      </div>
    {:else if activeSettingsTab === 'keys'}
      <div class="flex flex-col gap-3">
        <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider">API Keys</h3>
        <ApiKeysList bind:openAiKey bind:anthropicKey bind:geminiKey />
      </div>
    {:else if activeSettingsTab === 'identity'}
      <div class="flex flex-col gap-3">
        <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider">System Prompt</h3>
        <SystemPrompt bind:value={systemPrompt} />
      </div>
    {:else if activeSettingsTab === 'local'}
      <div class="flex flex-col gap-3">
        <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider">
          Local Inference
        </h3>
        <LocalModelSetup />
        <ModelDownloader onModelsChanged={() => modelRefreshKey++} />
        <ServerControls
          activeModel={activeProvider === 'local' ? activeModel : ''}
          refreshKey={modelRefreshKey}
        />
      </div>
    {:else if activeSettingsTab === 'shortcuts'}
      <div class="flex flex-col gap-3">
        <h3 class="text-xs font-semibold text-white/50 uppercase tracking-wider">Shortcuts</h3>
        <GlobalShortcuts bind:bindings={shortcutBindings} />
      </div>
    {/if}

    <!-- Auto-save status indicator -->
    {#if savedStatus}
      <div class="mt-3 text-center">
        <span class="text-xs font-medium" style="color: var(--accent-success);">
          {savedStatus}
        </span>
      </div>
    {/if}
  </div>
</div>
