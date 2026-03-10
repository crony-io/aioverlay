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
import { sanitizeApiError } from '$lib/services/ai/utils/sseParser';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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
    const controller = new AbortController();

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

    const url = `${GEMINI_API_BASE}/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

    const result = (async (): Promise<AIStreamResult> => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(sanitizeApiError('Gemini', response.status, errorBody));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body from Gemini');

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
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullContent += text;
              onChunk(text);
            }
          } catch {
            // Skip malformed chunks
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
