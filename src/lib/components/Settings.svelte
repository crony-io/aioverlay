<script lang="ts">
  import { saveApiKey, getApiKey, removeApiKey } from '$lib/storage';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { showError } from '$lib/stores/errorStore.svelte';
  import { getAllBindings, type ShortcutAction } from '$lib/services/shortcuts/shortcutManager';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
  import ProviderSelection from '$lib/components/settings/ProviderSelection.svelte';
  import ApiKeysList from '$lib/components/settings/ApiKeysList.svelte';
  import GlobalShortcuts from '$lib/components/settings/GlobalShortcuts.svelte';
  import SystemPrompt from '$lib/components/settings/SystemPrompt.svelte';
  import LocalModelSetup from '$lib/components/settings/LocalModelSetup.svelte';
  import ModelDownloader from '$lib/components/settings/ModelDownloader.svelte';
  import ServerControls from '$lib/components/settings/ServerControls.svelte';

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

  // Debounced auto-save for API keys (async Stronghold operations)
  $effect(() => {
    void openAiKey;
    void anthropicKey;
    void geminiKey;

    scheduleSave();
  });
</script>

<div class="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar" style="max-height: 380px;">
  <SettingsSection title="AI Provider & Model" defaultOpen={true}>
    <ProviderSelection
      bind:activeProvider
      bind:activeModel
      bind:webSearchEnabled
      refreshKey={modelRefreshKey}
    />
  </SettingsSection>

  <SettingsSection title="API Keys" defaultOpen={true}>
    <ApiKeysList bind:openAiKey bind:anthropicKey bind:geminiKey />
  </SettingsSection>

  <SettingsSection title="System Prompt" defaultOpen={false}>
    <SystemPrompt bind:value={systemPrompt} />
  </SettingsSection>

  <SettingsSection title="Local Inference" defaultOpen={false}>
    <LocalModelSetup />
    <ModelDownloader onModelsChanged={() => modelRefreshKey++} />
    <ServerControls
      activeModel={activeProvider === 'local' ? activeModel : ''}
      refreshKey={modelRefreshKey}
    />
  </SettingsSection>

  <SettingsSection title="Shortcuts" defaultOpen={false}>
    <GlobalShortcuts bind:bindings={shortcutBindings} />
  </SettingsSection>
</div>

<!-- Auto-save status indicator -->
{#if savedStatus}
  <div class="mt-3 text-center">
    <span class="text-xs font-medium" style="color: var(--accent-success);">
      {savedStatus}
    </span>
  </div>
{/if}
