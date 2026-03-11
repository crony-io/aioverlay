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
import { parseOpenAILine } from '$lib/services/ai/utils/sseParser';
import { streamSSE } from '$lib/services/ai/utils/streamSSE';

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
    const model = config.model || 'local-default';

    const body: Record<string, unknown> = {
      model,
      stream: true,
      messages: [
        ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
        ...messages.map(toOpenAIMessage)
      ]
    };

    if (config.temperature !== undefined) body.temperature = config.temperature;
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;

    return streamSSE(
      {
        provider: 'local',
        model,
        body: JSON.stringify(body),
        localBaseUrl: 'http://127.0.0.1:8080'
      },
      parseOpenAILine,
      onChunk
    );
  }
};
