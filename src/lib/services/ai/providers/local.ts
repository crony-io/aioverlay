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

/**
 * Merge two message content values (string or multimodal array).
 */
function mergeContent(a: unknown, b: unknown): unknown {
  if (typeof a === 'string' && typeof b === 'string') {
    return `${a}\n\n${b}`;
  }
  const arrA = Array.isArray(a) ? a : [{ type: 'text', text: String(a) }];
  const arrB = Array.isArray(b) ? b : [{ type: 'text', text: String(b) }];
  return [...arrA, ...arrB];
}

/**
 * Ensure messages follow strict user/assistant alternation required by
 * models like Gemma 3. Consecutive same-role messages are merged.
 * A leading system message is preserved as-is.
 */
function ensureAlternatingRoles(messages: Record<string, unknown>[]): Record<string, unknown>[] {
  if (messages.length === 0) return messages;

  const result: Record<string, unknown>[] = [];

  for (const msg of messages) {
    const prev = result[result.length - 1];
    if (prev && prev.role === msg.role && msg.role !== 'system') {
      prev.content = mergeContent(prev.content, msg.content);
    } else {
      result.push({ ...msg });
    }
  }

  return result;
}

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
      response_format: { type: 'text' },
      messages: ensureAlternatingRoles([
        ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
        ...messages.map(toOpenAIMessage)
      ])
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
