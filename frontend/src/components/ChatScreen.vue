<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { AgentMessage, BandMetadata, AgentId } from '../types'
import { AGENT_CONFIG } from '../config/agents'
import ChatBubble from './ChatBubble.vue'
import ChatSidebar from './ChatSidebar.vue'
import TypingIndicator from './TypingIndicator.vue'

interface Props {
  messages: AgentMessage[]
  metadata: BandMetadata | null
  dramaLevel: number
  isLoading: boolean
  frontpersonName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ escalate: [] }>()

const scrollAnchor = ref<HTMLElement | null>(null)

// Smooth-scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    scrollAnchor.value?.scrollIntoView({ behavior: 'smooth' })
  },
)

const agentIds: AgentId[] = ['clive', 'frontperson', 'journalist', 'ex_member']
const randomAgent = agentIds[Math.floor(Math.random() * agentIds.length)] ?? 'clive'
const typingColor = AGENT_CONFIG[randomAgent].color
</script>

<template>
  <div class="chat-layout">
    <!-- Chat Panel -->
    <div class="chat-panel">
      <div class="chat-messages glass-scrollbar">
        <TransitionGroup name="message">
          <ChatBubble
            v-for="(msg, index) in messages"
            :key="index"
            :message="msg"
          />
        </TransitionGroup>

        <TypingIndicator v-if="isLoading" :color="typingColor" />

        <div ref="scrollAnchor" class="scroll-anchor" />
      </div>

      <!-- Mobile bottom bar -->
      <div class="mobile-bottom-bar glass-card">
        <v-btn
          color="secondary"
          class="escalate-btn"
          :disabled="isLoading"
          @click="emit('escalate')"
        >
          Escalate Drama
        </v-btn>
        <span class="text-caption text-medium-emphasis">
          Drama Level: <strong style="color: #ff1493">{{ dramaLevel }}</strong>
        </span>
      </div>
    </div>

    <!-- Sidebar -->
    <ChatSidebar
      :metadata="metadata"
      :drama-level="dramaLevel"
      :is-loading="isLoading"
      :frontperson-name="frontpersonName"
      @escalate="emit('escalate')"
    />
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.chat-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  padding-bottom: 16px;
}

.mobile-bottom-bar {
  display: none;
}

@media (max-width: 900px) {
  .mobile-bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    margin: 0;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    flex-shrink: 0;
  }

  .chat-messages {
    padding-bottom: 8px;
  }
}

.scroll-anchor {
  height: 1px;
}

.chat-layout > :deep(.glass-sidebar) {
  width: 340px;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .chat-layout > :deep(.glass-sidebar) {
    display: none;
  }
}
</style>
