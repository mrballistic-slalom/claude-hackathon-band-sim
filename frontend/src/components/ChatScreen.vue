<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { AgentMessage, BandMetadata } from '../types'
import { AGENT_COLORS, type AgentId } from '../types'
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
const typingColor = AGENT_COLORS[agentIds[Math.floor(Math.random() * agentIds.length)]!]
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
