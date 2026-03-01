<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const messages = [
  'Signing record deal...',
  'Fabricating mysterious backstory...',
  'Inventing childhood trauma...',
  'Scheduling inevitable breakup...',
  'Alerting The Dissolve...',
  'Filing preemptive cease and desist...',
]

const currentIndex = ref(0)
let interval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  interval = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % messages.length
  }, 1500)
})

onUnmounted(() => {
  if (interval !== undefined) {
    clearInterval(interval)
  }
})
</script>

<template>
  <div class="loading-backdrop">
    <video
      class="loading-video"
      autoplay
      loop
      muted
      playsinline
      src="/background.mp4"
    />
    <div class="loading-overlay" />
    <div class="loading-center">
      <div class="glass-card loading-card">
        <Transition name="fade" mode="out-in">
          <p
            :key="currentIndex"
            class="font-headline text-h4 mb-8 text-center"
          >
            {{ messages[currentIndex] }}
          </p>
        </Transition>
        <div class="d-flex justify-center">
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
            width="6"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-backdrop {
  height: 100vh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: #0a0a0a;
}

.loading-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1;
}

.loading-center {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.loading-card {
  width: 100%;
  max-width: 480px;
  padding: 40px 32px;
}
</style>
