<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { AgentMessage, BandMetadata } from '../types'
import { AGENT_COLORS, type AgentId } from '../types'
import ChatBubble from './ChatBubble.vue'
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

const chatContainer = ref<HTMLElement | null>(null)
const dramaShake = ref(false)

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  },
)

// Shake animation on drama level change
watch(
  () => props.dramaLevel,
  () => {
    dramaShake.value = true
    setTimeout(() => {
      dramaShake.value = false
    }, 400)
  },
)

function handleEscalate() {
  emit('escalate')
}

const agentIds: AgentId[] = ['clive', 'frontperson', 'journalist', 'ex_member']
const typingColor = AGENT_COLORS[agentIds[Math.floor(Math.random() * agentIds.length)]!]
</script>

<template>
  <div class="chat-screen d-flex flex-column" style="height: 100vh">
    <!-- Header -->
    <v-app-bar flat color="background" class="border-b">
      <v-app-bar-title>
        <div class="d-flex align-center ga-3">
          <span class="font-headline text-h5">
            {{ metadata?.band_name ?? 'Loading...' }}
          </span>
          <v-chip v-if="metadata?.genre" size="small" variant="outlined">
            {{ metadata.genre }}
          </v-chip>
        </div>
        <div v-if="metadata?.pitch" class="text-caption text-medium-emphasis mt-1">
          {{ metadata.pitch }}
        </div>
      </v-app-bar-title>
    </v-app-bar>

    <!-- Chat area -->
    <div
      ref="chatContainer"
      class="flex-grow-1 overflow-y-auto pa-4"
      style="padding-bottom: 140px !important"
    >
      <TransitionGroup name="message">
        <ChatBubble
          v-for="(msg, index) in messages"
          :key="index"
          :message="msg"
        />
      </TransitionGroup>

      <TypingIndicator v-if="isLoading" :color="typingColor" />
    </div>

    <!-- Bottom bar -->
    <div
      class="bottom-bar pa-4 d-flex flex-column align-center ga-2"
      style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgb(var(--v-theme-background)) 30%);
        padding-top: 32px !important;
      "
    >
      <v-btn
        size="large"
        color="secondary"
        class="escalate-btn"
        :disabled="isLoading"
        @click="handleEscalate"
      >
        Escalate Drama 🔥
      </v-btn>

      <div class="d-flex align-center ga-2">
        <span class="text-body-2 text-medium-emphasis">Drama Level:</span>
        <v-chip
          size="small"
          color="secondary"
          :class="{ 'drama-shake': dramaShake }"
        >
          {{ dramaLevel }}
        </v-chip>
      </div>

      <p class="text-caption text-medium-emphasis" style="opacity: 0.6">
        Each click makes it worse. You've been warned.
      </p>
    </div>
  </div>
</template>
