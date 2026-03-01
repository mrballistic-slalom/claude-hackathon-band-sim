import { ref } from 'vue';
import type { AgentMessage, BandMetadata } from '../types';

/** A single parsed SSE event with its type and raw data payload. */
export interface SSEEvent {
  /** Event type (e.g. "message", "metadata", "done", "error"). */
  type: string;
  /** Raw JSON string carried in the `data:` field. */
  data: string;
}

/**
 * Parse a raw SSE text buffer into discrete events.
 *
 * Events in SSE are separated by double newlines (`\n\n`).
 * The last segment may be incomplete, so it is returned as `remaining`
 * to be prepended to the next chunk.
 *
 * @param buffer - Accumulated raw SSE text.
 * @returns An object containing `parsed` events and the `remaining` incomplete buffer.
 */
export function parseSSEBuffer(buffer: string): { parsed: SSEEvent[]; remaining: string } {
  const events: SSEEvent[] = [];
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() || ''; // last part may be incomplete

  for (const part of parts) {
    if (!part.trim()) continue;
    let type = 'message';
    let data = '';
    for (const line of part.split('\n')) {
      if (line.startsWith('event: ')) {
        type = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }
    if (data) {
      events.push({ type, data });
    }
  }

  return { parsed: events, remaining };
}

/**
 * Composable that manages a Server-Sent Events stream for drama generation.
 *
 * Provides reactive refs for messages, metadata, streaming state, and errors,
 * plus `connect` and `reset` methods.
 *
 * @returns Reactive SSE stream state and control functions.
 */
export function useSSEStream() {
  const messages = ref<AgentMessage[]>([]);
  const metadata = ref<BandMetadata | null>(null);
  const isStreaming = ref(false);
  const isDone = ref(false);
  const error = ref<string | null>(null);

  /**
   * Open a POST-based SSE connection and incrementally parse events.
   *
   * @param url - API endpoint URL.
   * @param body - JSON-serialisable request body.
   */
  async function connect(url: string, body: object): Promise<void> {
    isStreaming.value = true;
    isDone.value = false;
    error.value = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response has no body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const result = parseSSEBuffer(buffer);
        buffer = result.remaining;

        for (const event of result.parsed) {
          try {
            if (event.type === 'message') {
              messages.value = [...messages.value, JSON.parse(event.data)];
            } else if (event.type === 'metadata') {
              metadata.value = JSON.parse(event.data);
            } else if (event.type === 'done') {
              isDone.value = true;
            } else if (event.type === 'error') {
              error.value = JSON.parse(event.data).message;
            }
          } catch {
            console.warn('Skipping malformed SSE event:', event);
          }
        }
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Connection failed';
    } finally {
      isStreaming.value = false;
    }
  }

  /** Reset all reactive state back to initial values. */
  function reset() {
    messages.value = [];
    metadata.value = null;
    isStreaming.value = false;
    isDone.value = false;
    error.value = null;
  }

  return { messages, metadata, isStreaming, isDone, error, connect, reset };
}
