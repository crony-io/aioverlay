import type { AIMessage, AIContentPart } from '$lib/services/ai/types';

/** Extract plain text from an AIMessage content (string or parts array) */
export function getTextContent(content: string | AIContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/** Check if a message contains image content */
export function hasImageContent(content: string | AIContentPart[]): boolean {
  if (typeof content === 'string') return false;
  return content.some((p) => p.type === 'image');
}

/**
 * Convert AIMessage to OpenAI API message format.
 * OpenAI uses: { role, content: string | Array<{type: "text", text} | {type: "image_url", image_url: {url}}> }
 */
export function toOpenAIMessage(msg: AIMessage): Record<string, unknown> {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }

  const parts = msg.content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    return {
      type: 'image_url',
      image_url: { url: `data:${part.mediaType};base64,${part.data}` }
    };
  });

  return { role: msg.role, content: parts };
}

/**
 * Convert AIMessage to Anthropic API message format.
 * Anthropic uses: { role, content: string | Array<{type: "text", text} | {type: "image", source: {type: "base64", media_type, data}}> }
 */
export function toAnthropicMessage(msg: AIMessage): Record<string, unknown> {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }

  const parts = msg.content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: part.mediaType,
        data: part.data
      }
    };
  });

  return { role: msg.role, content: parts };
}

/**
 * Convert AIMessage to Gemini API message format.
 * Gemini uses: { role: "user"|"model", parts: Array<{text} | {inlineData: {mimeType, data}}> }
 */
export function toGeminiMessage(msg: AIMessage): Record<string, unknown> {
  const role = msg.role === 'assistant' ? 'model' : 'user';

  if (typeof msg.content === 'string') {
    return { role, parts: [{ text: msg.content }] };
  }

  const parts = msg.content.map((part) => {
    if (part.type === 'text') {
      return { text: part.text };
    }
    return {
      inlineData: {
        mimeType: part.mediaType,
        data: part.data
      }
    };
  });

  return { role, parts };
}
