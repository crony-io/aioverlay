/** Supported AI provider identifiers */
export type AIProviderID = 'openai' | 'anthropic' | 'gemini' | 'local';

/** A model option available for a given provider */
export interface AIModelOption {
  id: string;
  label: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsWebSearch?: boolean;
  /** Alternate model ID used when web search is enabled (e.g. OpenAI search variants) */
  searchModelId?: string;
}

/** Configuration needed to make an AI request */
export interface AIRequestConfig {
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  webSearchEnabled?: boolean;
}

/** A text-only content part */
export interface AITextContent {
  type: 'text';
  text: string;
}

/** A base64-encoded image content part */
export interface AIImageContent {
  type: 'image';
  /** Base64-encoded image data (without data URI prefix) */
  data: string;
  /** MIME type, e.g. 'image/png' */
  mediaType: string;
}

/** A single content part in a multimodal message */
export type AIContentPart = AITextContent | AIImageContent;

/** A message in the format expected by AI providers (supports text-only or multimodal) */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | AIContentPart[];
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
