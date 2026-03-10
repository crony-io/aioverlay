import type { Conversation, ChatMessage } from '$lib/types';
import type { AIProviderID, AIStreamHandle } from '$lib/services/ai/types';
import {
  loadConversationList,
  loadConversation,
  saveConversation,
  deleteConversation,
  createConversation,
  generateTitle
} from '$lib/chatHistory';
import { getProvider } from '$lib/services/ai/registry';
import { getApiKey } from '$lib/storage';

/** Reactive chat state using module-level Svelte 5 runes via .svelte.ts */
// Note: This file should be renamed to .svelte.ts to use runes, but we use
// a plain class-based approach that works with standard TS imports.

/** Settings keys stored in localStorage */
const SETTINGS_KEYS = {
  ACTIVE_PROVIDER: 'activeProvider',
  ACTIVE_MODEL: 'activeModel',
  SYSTEM_PROMPT: 'systemPrompt'
} as const;

export function getActiveProvider(): AIProviderID {
  return (localStorage.getItem(SETTINGS_KEYS.ACTIVE_PROVIDER) as AIProviderID) || 'openai';
}

export function getActiveModel(): string {
  return localStorage.getItem(SETTINGS_KEYS.ACTIVE_MODEL) || '';
}

export function getSystemPrompt(): string {
  return localStorage.getItem(SETTINGS_KEYS.SYSTEM_PROMPT) || '';
}

/**
 * Send a user message and stream the AI response.
 * Returns callbacks to update the reactive UI state externally.
 */
export async function sendMessageAndStream(opts: {
  conversation: Conversation;
  userText: string;
  onConversationUpdate: (conv: Conversation) => void;
  onStreamChunk: (fullContent: string) => void;
  onComplete: (conv: Conversation) => void;
  onError: (error: string) => void;
}): Promise<AIStreamHandle | null> {
  const { conversation, userText, onConversationUpdate, onStreamChunk, onComplete, onError } = opts;

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: userText,
    timestamp: Date.now()
  };

  conversation.messages = [...conversation.messages, userMessage];

  if (conversation.messages.filter((m) => m.role === 'user').length === 1) {
    conversation.title = generateTitle(conversation.messages);
  }

  onConversationUpdate(conversation);
  await saveConversation(conversation);

  const providerId = getActiveProvider();
  const modelId = getActiveModel();

  const apiKey = providerId !== 'local'
    ? await getApiKey(providerId)
    : 'local';

  if (!apiKey) {
    onError(`No API key configured for ${providerId}. Please add one in Settings.`);
    return null;
  }

  const provider = getProvider(providerId);
  const model = modelId || provider.models[0]?.id || '';

  const aiMessages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content
  }));

  const systemPrompt = getSystemPrompt();

  let streamedContent = '';

  try {
    const { result, handle } = provider.streamChat(
      aiMessages,
      {
        apiKey,
        model,
        systemPrompt: systemPrompt || undefined,
        maxTokens: 4096
      },
      (chunk) => {
        streamedContent += chunk;
        onStreamChunk(streamedContent);
      }
    );

    const streamResult = await result;

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: streamResult.content,
      timestamp: Date.now(),
      model: streamResult.model
    };

    conversation.messages = [...conversation.messages, assistantMessage];
    await saveConversation(conversation);
    onComplete(conversation);

    return handle;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (streamedContent) {
        const partialMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: streamedContent,
          timestamp: Date.now(),
          model
        };
        conversation.messages = [...conversation.messages, partialMessage];
        await saveConversation(conversation);
        onComplete(conversation);
      }
      return null;
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    onError(errorMsg);
    return null;
  }
}

export {
  loadConversationList,
  loadConversation,
  saveConversation,
  deleteConversation,
  createConversation,
  generateTitle
};
