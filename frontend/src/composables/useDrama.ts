import { ref, watch } from 'vue';
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
  const frontpersonTraits = ref<[string, string, string]>(['passionate', 'misunderstood', 'visionary']);
  const pettyLevel = ref(5);
  const sessionId = ref(crypto.randomUUID());

  /**
   * Start a new drama session by calling the /generate endpoint.
   *
   * Transitions from the input screen to loading, then to the chat screen
   * as messages begin arriving.
   *
   * @param input - The generate request payload with name, traits, and petty level.
   */
  async function generate(input: GenerateRequest): Promise<void> {
    frontpersonName.value = input.name;
    frontpersonTraits.value = input.traits;
    pettyLevel.value = input.petty_level;
    setFrontpersonAvatar(input.pronouns);
    screen.value = 'loading';

    const stream = useSSEStream();

    // React to stream state changes instead of polling with setInterval.
    const stopMessageWatch = watch(stream.messages, (msgs) => {
      if (msgs.length > 0 && screen.value === 'loading') {
        screen.value = 'chat';
      }
      if (msgs.length > allMessages.value.length) {
        allMessages.value = [...msgs];
      }
    });

    const stopMetadataWatch = watch(stream.metadata, (meta) => {
      if (meta) {
        bandMetadata.value = meta;
      }
    });

    const stopFinishedWatch = watch(
      [stream.isDone, stream.error],
      ([done, err]) => {
        if (done || err) {
          isLoading.value = false;
        }
      },
    );

    isLoading.value = true;
    await stream.connect(`${API_BASE}/generate`, input);

    // Stop watchers now that the stream has fully resolved.
    stopMessageWatch();
    stopMetadataWatch();
    stopFinishedWatch();

    // Final sync to capture anything the watchers may not have flushed yet.
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

    // React to new messages and terminal states via watch instead of polling.
    const stopMessageWatch = watch(stream.messages, (msgs) => {
      if (msgs.length > 0) {
        allMessages.value = [
          ...allMessages.value.slice(0, baseCount),
          ...msgs,
        ];
      }
    });

    const stopFinishedWatch = watch(
      [stream.isDone, stream.error],
      ([done, err]) => {
        if (done || err) {
          isLoading.value = false;
        }
      },
    );

    await stream.connect(`${API_BASE}/escalate`, {
      session_id: sessionId.value,
      history: allMessages.value.slice(0, baseCount),
      drama_level: dramaLevel.value,
      band_metadata: bandMetadata.value,
      traits: frontpersonTraits.value,
      petty_level: pettyLevel.value,
    });

    // Stop watchers now that the stream has fully resolved.
    stopMessageWatch();
    stopFinishedWatch();

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
