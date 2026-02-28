<script setup lang="ts">
import { computed } from 'vue'
import type { AgentMessage } from '../types'
import { getAgentConfig } from '../config/agents'
import { renderMarkdown } from '../composables/useMarkdown'
import AgentAvatar from './AgentAvatar.vue'

const props = defineProps<{ message: AgentMessage }>()

const config = computed(() => getAgentConfig(props.message.agent))
</script>

<template>
  <div class="bubble-row">
    <AgentAvatar :agent="message.agent" :size="36" />

    <div class="bubble-content" style="max-width: 80%">
      <span
        class="font-agent-name text-caption font-weight-bold"
        :style="{ color: config.color }"
      >
        {{ message.agent_display_name }}
      </span>

      <div
        v-if="message.reacting_to"
        class="reacting-to"
        :style="{ borderColor: `rgba(${config.colorRgb}, 0.3)` }"
      >
        replying to {{ message.reacting_to.agent }}:
        &ldquo;{{ message.reacting_to.excerpt }}&rdquo;
      </div>

      <div
        class="glass-bubble"
        :style="{
          background: `rgba(${config.colorRgb}, 0.08)`,
          borderColor: `rgba(${config.colorRgb}, 0.15)`,
        }"
      >
        <div class="markdown-body" v-html="renderMarkdown(message.content)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.bubble-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reacting-to {
  font-size: 0.75rem;
  font-style: italic;
  opacity: 0.6;
  border-left: 2px solid;
  padding-left: 8px;
  margin-left: 2px;
}

/* Markdown content styles */
.markdown-body :deep(p) {
  margin: 0 0 0.4em;
  font-size: 0.875rem;
  line-height: 1.5;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 10px 14px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.15);
  padding-left: 12px;
  margin: 0.5em 0;
  opacity: 0.8;
}

.markdown-body :deep(a) {
  color: #39ff14;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  font-weight: 700;
}

.markdown-body :deep(em) {
  font-style: italic;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.2em;
  margin: 0.3em 0;
  font-size: 0.875rem;
}
</style>
