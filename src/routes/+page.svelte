<script lang="ts">
  import Titlebar from '$lib/components/Titlebar.svelte';
  import ChatArea, { type ChatMessage } from '$lib/components/ChatArea.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import Settings from '$lib/components/Settings.svelte';

  // Demo state for the chat
  let messages = $state<ChatMessage[]>([]);

  function handleMessageSubmit(text: string) {
    if (!text) return;

    // Add user message
    messages = [...messages, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }];

    // Simulate an AI response block
    setTimeout(() => {
      messages = [...messages, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I received your message: "${text}"\n\nThis is a **test** response from the local state. The actual AI backend is not connected yet.\n\nHere is a code block:\n\`\`\`javascript\nconsole.log('Hello from Ai Overlay!');\n\`\`\``,
        timestamp: Date.now()
      }];
    }, 1000);
  }
</script>

<div class="flex h-full w-full items-center justify-center p-8">
  <!-- Glassmorphic Container -->
  <div 
    class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-black/40 p-6 text-white shadow-2xl backdrop-blur-xl transition-all"
    data-tauri-drag-region
  >
    <Titlebar />

    <!-- Content Area -->
    <div class="flex-1 rounded-xl bg-black/20 p-4 border border-white/5 flex flex-col pt-0 pb-2">
      <ChatArea {messages} />
      
      <div class="border-t border-white/10 pt-2 mt-auto">
        <ChatInput onSubmit={handleMessageSubmit} />
      </div>
      
      <Settings />
    </div>
  </div>
</div>
