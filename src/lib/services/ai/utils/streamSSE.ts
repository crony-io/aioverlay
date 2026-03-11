import type { AIStreamResult, AIStreamHandle, StreamChunkCallback } from '$lib/services/ai/types';
import type { SSELineParser } from '$lib/services/ai/utils/sseParser';
import { streamViaRust } from '$lib/services/ai/rustProxy';

/**
 * Parameters for the Rust HTTP proxy request.
 * Mirrors the fields expected by `streamViaRust`.
 */
export interface StreamSSERequest {
  provider: string;
  model: string;
  body: string;
  localBaseUrl?: string;
}

/**
 * Generic SSE streaming helper that eliminates the duplicated
 * buffer/parse/accumulate loop across all AI providers.
 *
 * 1. Opens a streaming request via the Rust HTTP proxy.
 * 2. Buffers incoming raw chunks and splits on newlines.
 * 3. Feeds each line to the provider-specific `parseLine` callback.
 * 4. Accumulates text and calls `onChunk` for each text delta.
 * 5. Returns a Promise<AIStreamResult> + an abort handle.
 */
export function streamSSE(
  request: StreamSSERequest,
  parseLine: SSELineParser,
  onChunk: StreamChunkCallback
): { result: Promise<AIStreamResult>; handle: AIStreamHandle } {
  let fullContent = '';
  let sseBuffer = '';
  let finishReason: string | null = null;

  const { result: streamResult, handle } = streamViaRust(request, (rawChunk) => {
    sseBuffer += rawChunk;
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;

      if (parsed.text) {
        fullContent += parsed.text;
        onChunk(parsed.text);
      }
      if (parsed.finishReason) {
        finishReason = parsed.finishReason;
      }
    }
  });

  const result = streamResult.then(() => ({
    content: fullContent,
    model: request.model,
    finishReason
  }));

  return { result, handle };
}
