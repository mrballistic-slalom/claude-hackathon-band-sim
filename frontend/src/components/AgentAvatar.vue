<script setup lang="ts">
import { computed } from 'vue'
import { getAgentConfig } from '../config/agents'

const props = withDefaults(defineProps<{
  agent: string
  size?: number
}>(), {
  size: 36,
})

const config = computed(() => getAgentConfig(props.agent))
</script>

<template>
  <div
    class="agent-avatar"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      minWidth: `${size}px`,
      background: `rgba(${config.colorRgb}, 0.2)`,
      border: `1.5px solid rgba(${config.colorRgb}, 0.5)`,
      fontSize: `${size * 0.36}px`,
      color: config.color,
    }"
  >
    <img
      v-if="config.avatarUrl"
      :src="config.avatarUrl"
      :alt="config.displayName"
      class="agent-avatar-img"
    />
    <span v-else class="agent-avatar-initials">{{ config.initials }}</span>
  </div>
</template>

<style scoped>
.agent-avatar {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-family: 'Roboto Mono', monospace;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}

.agent-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.agent-avatar-initials {
  user-select: none;
}
</style>
