<script lang="ts">
  import { saveApiKey, getApiKey } from '$lib/storage';
  import ProviderSelection from '$lib/components/settings/ProviderSelection.svelte';
  import ApiKeysList from '$lib/components/settings/ApiKeysList.svelte';
  import GlobalShortcuts from '$lib/components/settings/GlobalShortcuts.svelte';

  let openAiKey = $state('');
  let anthropicKey = $state('');
  let geminiKey = $state('');

  let screenshotKey = $state('CommandOrControl+Shift+S');
  let copyKey = $state('CommandOrControl+Shift+C');
  let activeProvider = $state('openai');
  let activeModel = $state('');
  let webSearchEnabled = $state(false);

  let savedStatus = $state('');
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoaded = $state(false);

  async function loadSettings() {
    try {
      openAiKey = (await getApiKey('openai')) || '';
      anthropicKey = (await getApiKey('anthropic')) || '';
      geminiKey = (await getApiKey('gemini')) || '';

      screenshotKey = localStorage.getItem('screenshotKey') || 'CommandOrControl+Shift+S';
      copyKey = localStorage.getItem('copyKey') || 'CommandOrControl+Shift+C';
      activeProvider = localStorage.getItem('activeProvider') || 'openai';
      activeModel = localStorage.getItem('activeModel') || '';
      webSearchEnabled = localStorage.getItem('webSearchEnabled') === 'true';
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
      if (openAiKey) await saveApiKey('openai', openAiKey);
      if (anthropicKey) await saveApiKey('anthropic', anthropicKey);
      if (geminiKey) await saveApiKey('gemini', geminiKey);

      localStorage.setItem('screenshotKey', screenshotKey);
      localStorage.setItem('copyKey', copyKey);
      localStorage.setItem('activeProvider', activeProvider);
      localStorage.setItem('activeModel', activeModel);
      localStorage.setItem('webSearchEnabled', webSearchEnabled.toString());

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
    void webSearchEnabled;

    scheduleSave();
  });
</script>

<div class="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar" style="max-height: 380px;">

  <ProviderSelection bind:activeProvider={activeProvider} bind:activeModel={activeModel} />

  <ApiKeysList
    bind:openAiKey={openAiKey}
    bind:anthropicKey={anthropicKey}
    bind:geminiKey={geminiKey}
  />

  <GlobalShortcuts
    bind:copyKey={copyKey}
    bind:screenshotKey={screenshotKey}
    bind:webSearchEnabled={webSearchEnabled}
  />

</div>

<!-- Auto-save status indicator -->
{#if savedStatus}
  <div class="mt-3 text-center">
    <span class="text-xs font-medium" style="color: var(--accent-success);">
      {savedStatus}
    </span>
  </div>
{/if}
