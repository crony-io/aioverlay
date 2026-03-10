import type {
  AIProvider,
  AIModelOption,
  AIMessage,
  AIRequestConfig,
  StreamChunkCallback,
  AIStreamResult,
  AIStreamHandle
} from '$lib/services/ai/types';
import { toOpenAIMessage } from '$lib/services/ai/messageUtils';
import { parseOpenAISSEChunk, sanitizeApiError } from '$lib/services/ai/utils/sseParser';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const OPENAI_MODELS: AIModelOption[] = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    contextWindow: 128000,
    supportsVision: true,
    supportsWebSearch: true,
    searchModelId: 'gpt-4o-search-preview'
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    contextWindow: 128000,
    supportsVision: true,
    supportsWebSearch: true,
    searchModelId: 'gpt-4o-mini-search-preview'
  },
  { id: 'gpt-4.1', label: 'GPT-4.1', contextWindow: 1047576, supportsVision: true },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', contextWindow: 1047576, supportsVision: true },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', contextWindow: 1047576, supportsVision: true },
  { id: 'o4-mini', label: 'o4-mini', contextWindow: 200000, supportsVision: true }
];

/** Map base model IDs to their Chat Completions search variants */
const SEARCH_MODEL_MAP: Record<string, string> = Object.fromEntries(
  OPENAI_MODELS.filter((m) => m.searchModelId).map((m) => [m.id, m.searchModelId!])
);

export const openaiProvider: AIProvider = {
  id: 'openai',
  label: 'OpenAI',
  models: OPENAI_MODELS,

  streamChat(
    messages: AIMessage[],
    config: AIRequestConfig,
    onChunk: StreamChunkCallback
  ): { result: Promise<AIStreamResult>; handle: AIStreamHandle } {
    const controller = new AbortController();

    const effectiveModel = config.webSearchEnabled
      ? (SEARCH_MODEL_MAP[config.model] ?? config.model)
      : config.model;

    const body: Record<string, unknown> = {
      model: effectiveModel,
      stream: true,
      messages: [
        ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
        ...messages.map(toOpenAIMessage)
      ]
    };

    if (config.temperature !== undefined) body.temperature = config.temperature;
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;

    const result = (async (): Promise<AIStreamResult> => {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(sanitizeApiError('OpenAI', response.status, errorBody));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body from OpenAI');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const chunk = parseOpenAISSEChunk(line);
          if (chunk) {
            fullContent += chunk;
            onChunk(chunk);
          }
        }
      }

      return {
        content: fullContent,
        model: config.model,
        finishReason: 'stop'
      };
    })();

    return {
      result,
      handle: { abort: () => controller.abort() }
    };
  }
};
