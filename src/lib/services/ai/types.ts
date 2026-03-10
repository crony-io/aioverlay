/** Supported AI provider identifiers */
export type AIProviderID = 'openai' | 'anthropic' | 'gemini' | 'local';

/** A model option available for a given provider */
export interface AIModelOption {
  id: string;
  label: string;
  contextWindow: number;
  supportsVision: boolean;
}

/** Configuration needed to make an AI request */
export interface AIRequestConfig {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/** A message in the format expected by AI providers */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Callback invoked on each streamed text chunk */
export type StreamChunkCallback = (chunk: string) => void;

/** Result returned after a completed AI stream */
export interface AIStreamResult {
  content: string;
  model: string;
  finishReason: string | null;
}

/** Abort handle returned when starting a stream */
export interface AIStreamHandle {
  abort: () => void;
}

/**
 * Unified interface that every AI provider must implement.
 * Providers handle their own API format translation internally.
 */
export interface AIProvider {
  readonly id: AIProviderID;
  readonly label: string;
  readonly models: AIModelOption[];

  /**
   * Stream a chat completion. Calls `onChunk` for each text delta.
   * Returns a Promise that resolves with the full result when done.
   */
  streamChat(
    messages: AIMessage[],
    config: AIRequestConfig,
    onChunk: StreamChunkCallback
  ): { result: Promise<AIStreamResult>; handle: AIStreamHandle };
}
