import { ref } from 'vue';
import type { AgentMessage, BandMetadata, GenerateRequest } from '../types';
import { useSSEStream } from './useSSEStream';
import { setFrontpersonAvatar } from '../config/agents';

/** The three possible UI screens in the drama flow. */
export type Screen = 'input' | 'loading' | 'chat';

// Use relative URL so CloudFront proxies to Lambda
const API_BASE = '/api';

/**
 * Top-level composable that orchestrates the drama simulation lifecycle.
 *
 * Manages screen transitions, accumulated messages, band metadata,
 * and the generate/escalate API calls.
 *
 * @returns Reactive state and action functions for the drama UI.
 */
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

  /**
   * Start a new drama session by calling the /generate endpoint.
   *
   * Transitions from the input screen to loading, then to the chat screen
   * as messages begin arriving.
   *
   * @param input - The generate request payload with name, traits, and petty level.
   */
  async function generate(input: GenerateRequest): Promise<void> {
    generateInput.value = input;
    frontpersonName.value = input.name;
    setFrontpersonAvatar(input.pronouns);
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

  /**
   * Escalate the drama by calling the /escalate endpoint with the current history.
   *
   * Increments the drama level and appends new messages to the conversation.
   * No-ops if a request is already in flight.
   */
  async function escalate(): Promise<void> {
    if (isLoading.value) return;

    dramaLevel.value++;
    isLoading.value = true;

    const stream = useSSEStream();
    const baseCount = allMessages.value.length;

    const checkInterval = setInterval(() => {
      const newMessages = stream.messages.value;
      if (newMessages.length > 0) {
        allMessages.value = [
          ...allMessages.value.slice(0, baseCount),
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
      history: allMessages.value.slice(0, baseCount),
      drama_level: dramaLevel.value,
      band_metadata: bandMetadata.value,
    });

    clearInterval(checkInterval);

    // Final sync
    allMessages.value = [
      ...allMessages.value.slice(0, baseCount),
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
