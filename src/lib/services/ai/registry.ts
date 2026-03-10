import type { AIProvider, AIProviderID, AIModelOption } from '$lib/services/ai/types';
import { openaiProvider } from '$lib/services/ai/providers/openai';
import { anthropicProvider } from '$lib/services/ai/providers/anthropic';
import { geminiProvider } from '$lib/services/ai/providers/gemini';
import { localProvider } from '$lib/services/ai/providers/local';

/** Registry of all available AI providers keyed by ID */
const providers: Record<AIProviderID, AIProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  local: localProvider
};

/** Get a provider by ID */
export function getProvider(id: AIProviderID): AIProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown AI provider: ${id}`);
  return provider;
}

/** Get all registered providers */
export function getAllProviders(): AIProvider[] {
  return Object.values(providers);
}

/** Get available models for a provider */
export function getModelsForProvider(id: AIProviderID): AIModelOption[] {
  return getProvider(id).models;
}

/** Get the default model ID for a provider */
export function getDefaultModel(id: AIProviderID): string {
  const models = getModelsForProvider(id);
  return models[0]?.id ?? '';
}
