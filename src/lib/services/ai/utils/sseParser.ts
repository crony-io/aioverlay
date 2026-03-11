/**
 * Unified SSE line parsers for all AI providers.
 *
 * Each parser takes a single raw SSE line and returns a
 * `SSEParseResult` with optional `text` and/or `finishReason`,
 * or `null` if the line is not relevant.
 */

/** Result returned by an SSE line parser. */
export interface SSEParseResult {
  text?: string;
  finishReason?: string;
}

/** Generic SSE line parser signature used by `streamSSE`. */
export type SSELineParser = (line: string) => SSEParseResult | null;

/**
 * OpenAI-compatible SSE parser.
 * Works for OpenAI and local llama.cpp (OpenAI-compatible) providers.
 */
export function parseOpenAILine(line: string): SSEParseResult | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6).trim();
  if (data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data);
    const text = parsed.choices?.[0]?.delta?.content;
    const finishReason = parsed.choices?.[0]?.finish_reason;
    if (text || finishReason)
      return { text: text ?? undefined, finishReason: finishReason ?? undefined };
    return null;
  } catch {
    return null;
  }
}

/**
 * Anthropic SSE parser.
 * Extracts text from `content_block_delta` events and
 * finish reason from `message_delta` events.
 */
export function parseAnthropicLine(line: string): SSEParseResult | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6).trim();
  if (!data) return null;

  try {
    const event = JSON.parse(data) as Record<string, unknown>;
    const eventType = event.type as string | undefined;

    if (eventType === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta') {
        return { text: delta.text as string };
      }
    } else if (eventType === 'message_delta') {
      const delta = event.delta as Record<string, unknown> | undefined;
      const stopReason = delta?.stop_reason as string | undefined;
      if (stopReason) return { finishReason: stopReason };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gemini SSE parser.
 * Extracts text from `candidates[0].content.parts[0].text`.
 */
export function parseGeminiLine(line: string): SSEParseResult | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6).trim();
  if (!data) return null;

  try {
    const parsed = JSON.parse(data);
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return { text };
    return null;
  } catch {
    return null;
  }
}
