<script lang="ts">
  import { saveApiKey, getApiKey } from '$lib/storage';

  let openAiKey = $state('');
  let savedKeyStatus = $state('');

  async function loadKeys() {
    try {
      const key = await getApiKey('openai');
      if (key) {
        openAiKey = key;
        savedKeyStatus = 'Key loaded from Stronghold!';
      }
    } catch(e) {
      console.error(e);
    }
  }

  async function saveKeys() {
    try {
      await saveApiKey('openai', openAiKey);
      savedKeyStatus = 'Key securely saved to Stronghold!';
      setTimeout(() => savedKeyStatus = '', 3000);
    } catch(e) {
      console.error(e);
      savedKeyStatus = 'Error saving key!';
    }
  }

  $effect(() => {
    loadKeys();
  });
</script>

<div class="mt-8 border-t border-white/10 pt-4">
  <p class="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Secure Storage Test</p>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <input 
        type="password" 
        bind:value={openAiKey}
        placeholder="OpenAI API Key (sk-...)" 
        class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      />
      <button 
        onclick={saveKeys}
        class="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
      >
        Save Key
      </button>
    </div>
    {#if savedKeyStatus}
      <p class="text-xs text-emerald-400">{savedKeyStatus}</p>
    {/if}
  </div>
</div>
