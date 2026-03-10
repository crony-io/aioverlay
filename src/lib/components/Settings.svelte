<script lang="ts">
  import { saveApiKey, getApiKey, removeApiKey } from '$lib/storage';
  import type { AIProviderID } from '$lib/services/ai/types';
  import { registerShortcuts } from '$lib/services/shortcuts/shortcutManager';
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

  let screenshotKey = $state('CommandOrControl+Shift+S');
  let copyKey = $state('CommandOrControl+Shift+C');
  let activeProvider = $state<AIProviderID>('openai');
  let activeModel = $state('');
  let systemPrompt = $state('');
  let webSearchEnabled = $state(false);

  let savedStatus = $state('');
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoaded = $state(false);

  /** Track previous shortcut values to avoid unnecessary re-registration */
  let prevCopyKey = '';
  let prevScreenshotKey = '';

  async function loadSettings() {
    try {
      openAiKey = (await getApiKey('openai')) || '';
      anthropicKey = (await getApiKey('anthropic')) || '';
      geminiKey = (await getApiKey('gemini')) || '';

      screenshotKey = localStorage.getItem('screenshotKey') || 'CommandOrControl+Shift+S';
      copyKey = localStorage.getItem('copyKey') || 'CommandOrControl+Shift+C';
      activeProvider = (localStorage.getItem('activeProvider') as AIProviderID) || 'openai';
      activeModel = localStorage.getItem('activeModel') || '';
      systemPrompt = localStorage.getItem('systemPrompt') || '';
      webSearchEnabled = localStorage.getItem('webSearchEnabled') === 'true';
      prevCopyKey = copyKey;
      prevScreenshotKey = screenshotKey;
      isLoaded = true;
    } catch (e) {
      console.error('Failed to load settings:', e);
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
      // Save or remove API keys based on whether they have a value
      if (openAiKey) await saveApiKey('openai', openAiKey);
      else await removeApiKey('openai');

      if (anthropicKey) await saveApiKey('anthropic', anthropicKey);
      else await removeApiKey('anthropic');

      if (geminiKey) await saveApiKey('gemini', geminiKey);
      else await removeApiKey('gemini');

      localStorage.setItem('screenshotKey', screenshotKey);
      localStorage.setItem('copyKey', copyKey);
      localStorage.setItem('activeProvider', activeProvider);
      localStorage.setItem('activeModel', activeModel);
      localStorage.setItem('systemPrompt', systemPrompt);
      localStorage.setItem('webSearchEnabled', String(webSearchEnabled));
      // Only re-register shortcuts when bindings actually changed
      if (copyKey !== prevCopyKey || screenshotKey !== prevScreenshotKey) {
        await registerShortcuts();
        prevCopyKey = copyKey;
        prevScreenshotKey = screenshotKey;
      }

      savedStatus = 'Saved ✓';
      setTimeout(() => (savedStatus = ''), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
      savedStatus = 'Error saving!';
    }
  }

  // Load settings on mount
  $effect(() => {
    loadSettings();
  });

  // Reactive auto-save when any value changes
  $effect(() => {
    // Read all reactive values to subscribe
    void openAiKey;
    void anthropicKey;
    void geminiKey;
    void screenshotKey;
    void copyKey;
    void activeProvider;
    void activeModel;
    void systemPrompt;
    void webSearchEnabled;

    scheduleSave();
  });
</script>

<div class="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar" style="max-height: 380px;">
  <SettingsSection title="AI Provider & Model" defaultOpen={true}>
    <ProviderSelection bind:activeProvider bind:activeModel bind:webSearchEnabled />
  </SettingsSection>

  <SettingsSection title="API Keys" defaultOpen={true}>
    <ApiKeysList bind:openAiKey bind:anthropicKey bind:geminiKey />
  </SettingsSection>

  <SettingsSection title="System Prompt" defaultOpen={false}>
    <SystemPrompt bind:value={systemPrompt} />
  </SettingsSection>

  <SettingsSection title="Local Inference" defaultOpen={false}>
    <LocalModelSetup />
    <ModelDownloader />
    <ServerControls />
  </SettingsSection>

  <SettingsSection title="Shortcuts" defaultOpen={false}>
    <GlobalShortcuts bind:copyKey bind:screenshotKey />
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
