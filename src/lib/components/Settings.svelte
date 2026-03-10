<script lang="ts">
  import { saveApiKey, getApiKey } from '$lib/storage';
  import ProviderSelection from './settings/ProviderSelection.svelte';
  import ApiKeysList from './settings/ApiKeysList.svelte';
  import GlobalShortcuts from './settings/GlobalShortcuts.svelte';

  // State
  let openAiKey = $state('');
  let anthropicKey = $state('');
  let geminiKey = $state('');
  
  let screenshotKey = $state('CommandOrControl+Shift+S');
  let copyKey = $state('CommandOrControl+Shift+C');
  let activeProvider = $state('openai');
  let webSearchEnabled = $state(false);

  let savedStatus = $state('');

  async function loadSettings() {
    try {
      openAiKey = (await getApiKey('openai')) || '';
      anthropicKey = (await getApiKey('anthropic')) || '';
      geminiKey = (await getApiKey('gemini')) || '';
      
      screenshotKey = localStorage.getItem('screenshotKey') || 'CommandOrControl+Shift+S';
      copyKey = localStorage.getItem('copyKey') || 'CommandOrControl+Shift+C';
      activeProvider = localStorage.getItem('activeProvider') || 'openai';
      webSearchEnabled = localStorage.getItem('webSearchEnabled') === 'true';
    } catch(e) {
      console.error('Failed to load settings:', e);
    }
  }

  async function saveSettings() {
    try {
      if (openAiKey) await saveApiKey('openai', openAiKey);
      if (anthropicKey) await saveApiKey('anthropic', anthropicKey);
      if (geminiKey) await saveApiKey('gemini', geminiKey);
      
      localStorage.setItem('screenshotKey', screenshotKey);
      localStorage.setItem('copyKey', copyKey);
      localStorage.setItem('activeProvider', activeProvider);
      localStorage.setItem('webSearchEnabled', webSearchEnabled.toString());

      // TODO: Notify Rust backend to update global shortcut listeners
      
      savedStatus = 'Settings saved securely!';
      setTimeout(() => savedStatus = '', 3000);
    } catch(e) {
      console.error('Failed to save settings:', e);
      savedStatus = 'Error saving settings!';
    }
  }

  $effect(() => {
    loadSettings();
  });
</script>

<div class="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar" style="max-height: 380px;">
  
  <ProviderSelection bind:activeProvider={activeProvider} />
  
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

<div class="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
  <p class="text-xs text-emerald-400 font-medium">{savedStatus}</p>
  <button 
    onclick={saveSettings}
    class="rounded-lg bg-indigo-500 hover:bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition-colors shadow-lg"
  >
    Save Settings
  </button>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
