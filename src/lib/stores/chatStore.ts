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

/** Valid provider IDs for localStorage validation */
const VALID_PROVIDERS: AIProviderID[] = ['openai', 'anthropic', 'gemini', 'local'];

/** Settings keys stored in localStorage */
const SETTINGS_KEYS = {
  ACTIVE_PROVIDER: 'activeProvider',
  ACTIVE_MODEL: 'activeModel',
  SYSTEM_PROMPT: 'systemPrompt',
  WEB_SEARCH: 'webSearchEnabled'
} as const;

export function getActiveProvider(): AIProviderID {
  const stored = localStorage.getItem(SETTINGS_KEYS.ACTIVE_PROVIDER);
  if (stored && VALID_PROVIDERS.includes(stored as AIProviderID)) {
    return stored as AIProviderID;
  }
  return 'openai';
}

export function getActiveModel(): string {
  return localStorage.getItem(SETTINGS_KEYS.ACTIVE_MODEL) || '';
}

export function getSystemPrompt(): string {
  return localStorage.getItem(SETTINGS_KEYS.SYSTEM_PROMPT) || '';
}

export function isWebSearchEnabled(): boolean {
  return localStorage.getItem(SETTINGS_KEYS.WEB_SEARCH) === 'true';
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

  const apiKey = providerId !== 'local' ? await getApiKey(providerId) : 'local';

  if (!apiKey) {
    onError(`No API key configured for ${providerId}. Please add one in Settings.`);
    return null;
  }

  const provider = getProvider(providerId);
  const model = modelId || provider.models[0]?.id || '';

  const aiMessages = conversation.messages.map(toAIMessage);

  const systemPrompt = getSystemPrompt();

  let streamedContent = '';

  try {
    const { result, handle } = provider.streamChat(
      aiMessages,
      {
        apiKey,
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
          model,
          incomplete: true
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
