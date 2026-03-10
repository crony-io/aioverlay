/**
 * Parse an SSE line from an OpenAI-compatible streaming response.
 * Shared by OpenAI and local llama.cpp providers.
 */
export function parseOpenAISSEChunk(line: string): string | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6).trim();
  if (data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Sanitize raw API error bodies into safe, user-friendly messages.
 * Strips potentially sensitive details like internal URLs, stack traces, and request IDs.
 */
export function sanitizeApiError(providerLabel: string, status: number, rawBody: string): string {
  const MAX_LENGTH = 200;

  try {
    const parsed = JSON.parse(rawBody);

    const message = parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? null;

    if (typeof message === 'string' && message.length > 0) {
      const truncated = message.length > MAX_LENGTH ? message.slice(0, MAX_LENGTH) + '…' : message;
      return `${providerLabel} error (${status}): ${truncated}`;
    }
  } catch {
    // rawBody is not JSON
  }

  if (status === 401) return `${providerLabel} error: Invalid or missing API key.`;
  if (status === 403)
    return `${providerLabel} error: Access denied. Check your API key permissions.`;
  if (status === 429)
    return `${providerLabel} error: Rate limit exceeded. Please wait and try again.`;
  if (status === 500) return `${providerLabel} error: Server error. Try again later.`;
  if (status === 503) return `${providerLabel} error: Service temporarily unavailable.`;

  return `${providerLabel} error (${status}): Request failed. Please try again.`;
}
