<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BandMetadata } from '../types'
import { AGENT_CONFIG } from '../config/agents'
import AgentAvatar from './AgentAvatar.vue'

const props = defineProps<{
  metadata: BandMetadata | null
  dramaLevel: number
  isLoading: boolean
  frontpersonName: string
}>()

const emit = defineEmits<{ escalate: [] }>()

const dramaShake = ref(false)

watch(
  () => props.dramaLevel,
  () => {
    dramaShake.value = true
    setTimeout(() => { dramaShake.value = false }, 400)
  },
)

const agents = Object.values(AGENT_CONFIG)
</script>

<template>
  <aside class="glass-sidebar sidebar-container">
    <!-- Band Info -->
    <div class="glass-card sidebar-section">
      <h2 class="font-headline sidebar-band-name">
        {{ metadata?.band_name ?? 'Loading...' }}
      </h2>
      <v-chip v-if="metadata?.genre" size="small" variant="outlined" class="mt-1">
        {{ metadata.genre }}
      </v-chip>
      <p v-if="metadata?.pitch" class="text-caption text-medium-emphasis mt-2 mb-0">
        {{ metadata.pitch }}
      </p>
    </div>

    <!-- Agent Roster -->
    <div class="sidebar-section">
      <span class="text-overline text-medium-emphasis" style="letter-spacing: 2px">
        THE CAST
      </span>
      <div class="roster-list">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="roster-item"
        >
          <AgentAvatar :agent="agent.id" :size="40" />
          <div class="roster-info">
            <span class="font-agent-name roster-name" :style="{ color: agent.color }">
              {{ agent.id === 'frontperson' && frontpersonName ? frontpersonName : agent.displayName }}
            </span>
            <span class="text-caption text-medium-emphasis">{{ agent.role }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Drama Controls -->
    <div class="sidebar-section sidebar-controls">
      <div class="drama-display">
        <span class="text-body-2 text-medium-emphasis">Drama Level</span>
        <span
          class="drama-number font-headline"
          :class="{ 'drama-shake': dramaShake }"
        >
          {{ dramaLevel }}
        </span>
      </div>

      <v-btn
        block
        size="large"
        color="secondary"
        class="escalate-btn"
        :disabled="isLoading"
        @click="emit('escalate')"
      >
        Escalate Drama
      </v-btn>

      <p class="text-caption text-medium-emphasis text-center" style="opacity: 0.5">
        Each click makes it worse.
      </p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  gap: 20px;
  overflow-y: auto;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
}

.sidebar-band-name {
  font-size: 1.4rem;
  line-height: 1.3;
  margin: 0;
}

.roster-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.roster-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.roster-info {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.roster-name {
  font-size: 0.8rem;
  font-weight: 600;
}

.sidebar-controls {
  margin-top: auto;
  gap: 12px;
}

.drama-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drama-number {
  font-size: 2rem;
  color: #ff1493;
  line-height: 1;
}
</style>
