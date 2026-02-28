import { ref } from 'vue';
import type { AgentMessage, BandMetadata } from '../types';

interface SSEEvent {
  type: string;
  data: string;
}

function parseSSEBuffer(buffer: string): { parsed: SSEEvent[]; remaining: string } {
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

export function useSSEStream() {
  const messages = ref<AgentMessage[]>([]);
  const metadata = ref<BandMetadata | null>(null);
  const isStreaming = ref(false);
  const isDone = ref(false);
  const error = ref<string | null>(null);

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

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const result = parseSSEBuffer(buffer);
        buffer = result.remaining;

        for (const event of result.parsed) {
          if (event.type === 'message') {
            messages.value = [...messages.value, JSON.parse(event.data)];
          } else if (event.type === 'metadata') {
            metadata.value = JSON.parse(event.data);
          } else if (event.type === 'done') {
            isDone.value = true;
          } else if (event.type === 'error') {
            error.value = JSON.parse(event.data).message;
          }
        }
      }
    } catch (err: any) {
      error.value = err.message || 'Connection failed';
    } finally {
      isStreaming.value = false;
    }
  }

  function reset() {
    messages.value = [];
    metadata.value = null;
    isStreaming.value = false;
    isDone.value = false;
    error.value = null;
  }

  return { messages, metadata, isStreaming, isDone, error, connect, reset };
}
