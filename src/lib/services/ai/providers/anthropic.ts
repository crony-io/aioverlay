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
import { parseAnthropicLine } from '$lib/services/ai/utils/sseParser';
import { streamSSE } from '$lib/services/ai/utils/streamSSE';

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

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  models: ANTHROPIC_MODELS,

  streamChat(
    messages: AIMessage[],
    config: AIRequestConfig,
    onChunk: StreamChunkCallback
  ): { result: Promise<AIStreamResult>; handle: AIStreamHandle } {
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

    return streamSSE(
      { provider: 'anthropic', model: config.model, body: JSON.stringify(body) },
      parseAnthropicLine,
      onChunk
    );
  }
};
