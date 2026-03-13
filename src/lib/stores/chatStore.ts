import type { Conversation, ChatMessage } from '$lib/types';
import type {
  AIProviderID,
  AIStreamHandle,
  AIMessage,
  AIContentPart
} from '$lib/services/ai/types';
import { saveConversation, generateTitle } from '$lib/chatHistory';
import { getProvider } from '$lib/services/ai/registry';
import { getApiKey } from '$lib/storage';
import { settingsStore } from '$lib/stores/settingsStore.svelte';

/** Regex to match inline base64 images in markdown: ![alt](data:mime;base64,DATA) */
const BASE64_IMAGE_REGEX = /!\[[^\]]*\]\(data:([^;]+);base64,([^)]+)\)/g;

/**
 * Convert a ChatMessage to an AIMessage, extracting inline base64 images
 * into multimodal content parts when present.
 */
function toAIMessage(msg: { role: string; content: string }): AIMessage {
  const matches = [...msg.content.matchAll(BASE64_IMAGE_REGEX)];

  if (matches.length === 0) {
    return { role: msg.role as AIMessage['role'], content: msg.content };
  }

  const parts: AIContentPart[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    const textBefore = msg.content.slice(lastIndex, match.index).trim();
    if (textBefore) {
      parts.push({ type: 'text', text: textBefore });
    }
    parts.push({
      type: 'image',
      mediaType: match[1],
      data: match[2]
    });
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  const textAfter = msg.content.slice(lastIndex).trim();
  if (textAfter) {
    parts.push({ type: 'text', text: textAfter });
  }

  return { role: msg.role as AIMessage['role'], content: parts };
}

/** Read the current active provider from the reactive store */
export function getActiveProvider(): AIProviderID {
  return settingsStore.activeProvider;
}

/** Read the current active model from the reactive store */
export function getActiveModel(): string {
  return settingsStore.activeModel;
}

/** Read the current system prompt from the reactive store */
export function getSystemPrompt(): string {
  return settingsStore.systemPrompt;
}

/** Check if web search is enabled from the reactive store */
export function isWebSearchEnabled(): boolean {
  return settingsStore.webSearchEnabled;
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
  onHandle?: (handle: AIStreamHandle) => void;
}): Promise<void> {
  const {
    conversation,
    userText,
    onConversationUpdate,
    onStreamChunk,
    onComplete,
    onError,
    onHandle
  } = opts;

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
  if (!conversation.ephemeral) await saveConversation(conversation);

  const providerId = getActiveProvider();
  const modelId = getActiveModel();

  const provider = getProvider(providerId);
  const model = modelId || provider.models[0]?.id || '';

  // Validate API key for cloud providers before attempting to stream
  if (providerId !== 'local') {
    const apiKey = await getApiKey(providerId);
    if (!apiKey) {
      onError(`No API key configured for ${provider.label}. Add one in Settings → API Keys.`);
      return;
    }
  }

  const aiMessages = conversation.messages.map(toAIMessage);

  const systemPrompt = getSystemPrompt();

  let streamedContent = '';

  try {
    const { result, handle } = provider.streamChat(
      aiMessages,
      {
        model,
        systemPrompt: systemPrompt || undefined,
        maxTokens: 4096,
        webSearchEnabled: isWebSearchEnabled()
      },
      (chunk) => {
        streamedContent += chunk;
        onStreamChunk(streamedContent);
      }
    );

    onHandle?.(handle);

    const streamResult = await result;

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: streamResult.content,
      timestamp: Date.now(),
      model: streamResult.model
    };

    conversation.messages = [...conversation.messages, assistantMessage];
    if (!conversation.ephemeral) await saveConversation(conversation);
    onComplete(conversation);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (streamedContent) {
        const partialMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: streamedContent,
          timestamp: Date.now(),
          model,
          incomplete: true
        };
        conversation.messages = [...conversation.messages, partialMessage];
        if (!conversation.ephemeral) await saveConversation(conversation);
        onComplete(conversation);
      }
      return;
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    onError(errorMsg);
  }
}
