<script lang="ts">
  let { onSubmit } = $props<{ onSubmit: (text: string) => void }>();
  let inputText = $state('');

  function handleSubmit() {
    if (!inputText.trim()) return;
    onSubmit(inputText);
    inputText = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="mt-4 flex gap-3 relative">
  <textarea 
    bind:value={inputText}
    onkeydown={handleKeydown}
    placeholder="Ask Ai Overlay... (Enter to send)" 
    rows="1"
    class="w-full resize-none rounded-xl border border-white/10 bg-white/5 py-3 pl-4 pr-12 text-sm text-white placeholder-white/40 shadow-inner focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 custom-scrollbar"
  ></textarea>
  <button 
    onclick={handleSubmit}
    disabled={!inputText.trim()}
    class="absolute right-2 top-2 bottom-2 rounded-lg bg-indigo-500 px-3 py-1 font-semibold text-white shadow-lg transition-all hover:bg-indigo-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    aria-label="Send Message"
    title="Send Message"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  </button>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
</style>

