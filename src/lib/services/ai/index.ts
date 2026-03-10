export type {
  AIProviderID,
  AIModelOption,
  AIRequestConfig,
  AIMessage,
  AITextContent,
  AIImageContent,
  AIContentPart,
  StreamChunkCallback,
  AIStreamResult,
  AIStreamHandle,
  AIProvider
} from '$lib/services/ai/types';

export {
  getProvider,
  getAllProviders,
  getModelsForProvider,
  getDefaultModel
} from '$lib/services/ai/registry';

export {
  toOpenAIMessage,
  toAnthropicMessage,
  toGeminiMessage,
  getTextContent,
  hasImageContent
} from '$lib/services/ai/messageUtils';
