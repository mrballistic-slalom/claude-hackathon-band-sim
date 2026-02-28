import { ref } from 'vue';
import type { AgentMessage, BandMetadata, GenerateRequest } from '../types';
import { useSSEStream } from './useSSEStream';

export type Screen = 'input' | 'loading' | 'chat';

// Use relative URL so CloudFront proxies to Lambda
const API_BASE = '/api';

export function useDrama() {
  const screen = ref<Screen>('input');
  const allMessages = ref<AgentMessage[]>([]);
  const bandMetadata = ref<BandMetadata | null>(null);
  const dramaLevel = ref(1);
  const isLoading = ref(false);
  const frontpersonName = ref('');
  const sessionId = ref(crypto.randomUUID());

  // For tracking generate input (needed for escalation context)
  const generateInput = ref<GenerateRequest | null>(null);

  async function generate(input: GenerateRequest): Promise<void> {
    generateInput.value = input;
    frontpersonName.value = input.name;
    screen.value = 'loading';

    const stream = useSSEStream();

    // Watch for first message to transition to chat
    const checkInterval = setInterval(() => {
      if (stream.messages.value.length > 0 && screen.value === 'loading') {
        screen.value = 'chat';
      }
      // Sync messages
      if (stream.messages.value.length > allMessages.value.length) {
        allMessages.value = [...stream.messages.value];
      }
      if (stream.metadata.value) {
        bandMetadata.value = stream.metadata.value;
      }
      if (stream.isDone.value || stream.error.value) {
        clearInterval(checkInterval);
        isLoading.value = false;
      }
    }, 100);

    isLoading.value = true;
    await stream.connect(`${API_BASE}/generate`, input);
    clearInterval(checkInterval);

    // Final sync
    allMessages.value = [...stream.messages.value];
    if (stream.metadata.value) {
      bandMetadata.value = stream.metadata.value;
    }
    if (screen.value === 'loading') {
      screen.value = 'chat'; // fallback transition
    }
    isLoading.value = false;
  }

  async function escalate(): Promise<void> {
    if (isLoading.value) return;

    dramaLevel.value++;
    isLoading.value = true;

    const stream = useSSEStream();

    const checkInterval = setInterval(() => {
      // Append new messages from this round
      const existingCount = allMessages.value.length;
      const newMessages = stream.messages.value;
      if (newMessages.length > 0) {
        // Merge: keep existing + add new from stream
        allMessages.value = [
          ...allMessages.value.slice(0, existingCount),
          ...newMessages,
        ];
      }
      if (stream.isDone.value || stream.error.value) {
        clearInterval(checkInterval);
        isLoading.value = false;
      }
    }, 100);

    await stream.connect(`${API_BASE}/escalate`, {
      session_id: sessionId.value,
      history: allMessages.value,
      drama_level: dramaLevel.value,
      band_metadata: bandMetadata.value,
    });

    clearInterval(checkInterval);

    // Final sync - append stream messages to existing
    const existingCount = allMessages.value.length - stream.messages.value.length;
    allMessages.value = [
      ...allMessages.value.slice(0, existingCount > 0 ? existingCount : allMessages.value.length),
      ...stream.messages.value,
    ];
    isLoading.value = false;
  }

  return {
    screen,
    allMessages,
    bandMetadata,
    dramaLevel,
    isLoading,
    frontpersonName,
    generate,
    escalate,
  };
}
