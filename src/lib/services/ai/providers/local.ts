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

/** Default local llama-server endpoint (OpenAI-compatible) */
const LOCAL_API_URL = 'http://127.0.0.1:8080/v1/chat/completions';

const LOCAL_MODELS: AIModelOption[] = [
  {
    id: 'local-default',
    label: 'Local Model (llama.cpp)',
    contextWindow: 8192,
    supportsVision: false
  }
];

export const localProvider: AIProvider = {
  id: 'local',
  label: 'Local (llama.cpp)',
  models: LOCAL_MODELS,

  streamChat(
    messages: AIMessage[],
    config: AIRequestConfig,
    onChunk: StreamChunkCallback
  ): { result: Promise<AIStreamResult>; handle: AIStreamHandle } {
    const controller = new AbortController();

    const body: Record<string, unknown> = {
      model: config.model || 'local-default',
      stream: true,
      messages: [
        ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
        ...messages.map(toOpenAIMessage)
      ]
    };

    if (config.temperature !== undefined) body.temperature = config.temperature;
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;

    const result = (async (): Promise<AIStreamResult> => {
      const response = await fetch(LOCAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(sanitizeApiError('Local server', response.status, errorBody));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body from local server');

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
        model: config.model || 'local-default',
        finishReason: 'stop'
      };
    })();

    return {
      result,
      handle: { abort: () => controller.abort() }
    };
  }
};
