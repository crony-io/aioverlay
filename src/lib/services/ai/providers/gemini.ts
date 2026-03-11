import type {
  AIProvider,
  AIModelOption,
  AIMessage,
  AIRequestConfig,
  StreamChunkCallback,
  AIStreamResult,
  AIStreamHandle
} from '$lib/services/ai/types';
import { toGeminiMessage, getTextContent } from '$lib/services/ai/messageUtils';
import { parseGeminiLine } from '$lib/services/ai/utils/sseParser';
import { streamSSE } from '$lib/services/ai/utils/streamSSE';

const GEMINI_MODELS: AIModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    contextWindow: 1048576,
    supportsVision: true,
    supportsWebSearch: true
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    contextWindow: 1048576,
    supportsVision: true,
    supportsWebSearch: true
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    contextWindow: 1048576,
    supportsVision: true,
    supportsWebSearch: true
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    contextWindow: 2097152,
    supportsVision: true,
    supportsWebSearch: true
  }
];

export const geminiProvider: AIProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  models: GEMINI_MODELS,

  streamChat(
    messages: AIMessage[],
    config: AIRequestConfig,
    onChunk: StreamChunkCallback
  ): { result: Promise<AIStreamResult>; handle: AIStreamHandle } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const systemText = [
      config.systemPrompt,
      ...systemMessages.map((m) => getTextContent(m.content))
    ]
      .filter(Boolean)
      .join('\n\n');

    const body: Record<string, unknown> = {
      contents: chatMessages.map(toGeminiMessage)
    };

    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }

    const generationConfig: Record<string, unknown> = {};
    if (config.temperature !== undefined) generationConfig.temperature = config.temperature;
    if (config.maxTokens !== undefined) generationConfig.maxOutputTokens = config.maxTokens;
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    if (config.webSearchEnabled) {
      body.tools = [{ google_search: {} }];
    }

    return streamSSE(
      { provider: 'gemini', model: config.model, body: JSON.stringify(body) },
      parseGeminiLine,
      onChunk
    );
  }
};
