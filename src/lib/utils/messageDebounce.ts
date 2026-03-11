/** Debounce delay in milliseconds before flushing buffered messages */
const DEFAULT_DELAY_MS = 2000;

/**
 * Buffers rapid-fire user messages and flushes them as a single
 * concatenated prompt after a configurable debounce window.
 *
 * Handles "double-texting" — when a user sends multiple messages
 * before the AI can reply — by batching them into one request.
 */
export interface MessageDebounceOptions {
  /** Called with the concatenated message when the debounce timer expires */
  onFlush: (combinedText: string) => void;
  /** Called whenever the pending buffer changes (for UI feedback) */
  onPendingChange?: (count: number) => void;
  /** Debounce delay in ms (default 2000) */
  delayMs?: number;
}

export interface MessageDebounceHandle {
  /** Add a message to the buffer and (re)start the debounce timer */
  enqueue: (text: string) => void;
  /** Immediately flush all buffered messages (skips the timer) */
  flush: () => void;
  /** Discard all buffered messages and cancel the timer */
  cancel: () => void;
  /** Current number of messages in the buffer */
  pendingCount: () => number;
  /** Clean up the timer on unmount */
  destroy: () => void;
}

export function createMessageDebounce(options: MessageDebounceOptions): MessageDebounceHandle {
  const { onFlush, onPendingChange, delayMs = DEFAULT_DELAY_MS } = options;

  let buffer: string[] = [];
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function notifyPending() {
    onPendingChange?.(buffer.length);
  }

  function flush() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }

    if (buffer.length === 0) return;

    const combined = buffer.join('\n');
    buffer = [];
    notifyPending();
    onFlush(combined);
  }

  function enqueue(text: string) {
    if (!text.trim()) return;

    buffer.push(text);
    notifyPending();

    if (timerId !== null) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(flush, delayMs);
  }

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    buffer = [];
    notifyPending();
  }

  function pendingCount() {
    return buffer.length;
  }

  function destroy() {
    cancel();
  }

  return { enqueue, flush, cancel, pendingCount, destroy };
}
