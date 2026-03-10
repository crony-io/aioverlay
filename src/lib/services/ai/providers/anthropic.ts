import type {
  AIProvider,
  AIModelOption,
  AIMessage,
  AIRequestConfig,
  StreamChunkCallback,
  AIStreamResult,
  AIStreamHandle
} from '$lib/services/ai/types';
import { toAnthropicMessage } from '$lib/services/ai/messageUtils';
import { sanitizeApiError } from '$lib/services/ai/utils/sseParser';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';

const ANTHROPIC_MODELS: AIModelOption[] = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    contextWindow: 200000,
    supportsVision: true,
    supportsWebSearch: true
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    supportsVision: true,
    supportsWebSearch: true
  },
  {
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    supportsVision: true,
    supportsWebSearch: true
  },
  {
    id: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    contextWindow: 200000,
    supportsVision: true,
    supportsWebSearch: true
  }
];

/** Parse an SSE event from Anthropic's streaming response */
function parseSSEEvent(line: string): { type: string; data: Record<string, unknown> } | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6).trim();
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  models: ANTHROPIC_MODELS,

  streamChat(
    messages: AIMessage[],
    config: AIRequestConfig,
    onChunk: StreamChunkCallback
  ): { result: Promise<AIStreamResult>; handle: AIStreamHandle } {
    const controller = new AbortController();

    const filteredMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: config.model,
      stream: true,
      max_tokens: config.maxTokens ?? 4096,
      messages: filteredMessages.map(toAnthropicMessage)
    };

    if (config.systemPrompt) {
      body.system = config.systemPrompt;
    }

    if (config.temperature !== undefined) body.temperature = config.temperature;

    if (config.webSearchEnabled) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    }

    const result = (async (): Promise<AIStreamResult> => {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(sanitizeApiError('Anthropic', response.status, errorBody));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body from Anthropic');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let finishReason: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseSSEEvent(line);
          if (!event) continue;

          const eventType = (event as Record<string, unknown>).type as string;

          if (eventType === 'content_block_delta') {
            const delta = (event as Record<string, unknown>).delta as
              | Record<string, unknown>
              | undefined;
            if (delta?.type === 'text_delta') {
              const text = delta.text as string;
              fullContent += text;
              onChunk(text);
            }
          } else if (eventType === 'message_delta') {
            const delta = (event as Record<string, unknown>).delta as
              | Record<string, unknown>
              | undefined;
            finishReason = (delta?.stop_reason as string) ?? null;
          }
        }
      }

      return {
        content: fullContent,
        model: config.model,
        finishReason
      };
    })();

    return {
      result,
      handle: { abort: () => controller.abort() }
    };
  }
};
