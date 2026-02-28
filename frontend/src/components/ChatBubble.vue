<script setup lang="ts">
/**
 * ChatBubble -- renders a single agent message in the drama chat log.
 *
 * Displays the agent's name (colour-coded), an optional "reacting to" quote,
 * and the message body inside a left-bordered card.
 *
 * @prop message - The agent message to render.
 */
import type { AgentMessage } from '../types'
import { AGENT_COLORS, type AgentId } from '../types'

defineProps<{ message: AgentMessage }>()

/**
 * Look up the UI colour for a given agent ID.
 *
 * @param agent - Agent identifier string.
 * @returns Hex colour string, or a grey fallback for unknown agents.
 */
function getAgentColor(agent: string): string {
  return AGENT_COLORS[agent as AgentId] ?? '#888888'
}
</script>

<template>
  <div class="chat-bubble mb-3" style="max-width: 80%">
    <span
      class="font-agent-name text-caption font-weight-bold d-block mb-1"
      :style="{ color: getAgentColor(message.agent) }"
    >
      {{ message.agent_display_name }}
    </span>

    <div
      v-if="message.reacting_to"
      class="text-caption font-italic text-medium-emphasis mb-1"
    >
      replying to {{ message.reacting_to.agent }}:
      &ldquo;{{ message.reacting_to.excerpt }}&rdquo;
    </div>

    <v-card
      variant="flat"
      rounded="lg"
      class="pa-3"
      :style="{
        borderLeft: `4px solid ${getAgentColor(message.agent)}`,
        backgroundColor: 'rgb(var(--v-theme-surface))',
      }"
    >
      <span class="text-body-2">{{ message.content }}</span>
    </v-card>
  </div>
</template>
