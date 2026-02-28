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
  <v-container
    class="d-flex flex-column align-center justify-center"
    style="min-height: 100vh"
  >
    <div class="text-center">
      <Transition name="fade" mode="out-in">
        <p
          :key="currentIndex"
          class="font-headline text-h4 mb-8"
        >
          {{ messages[currentIndex] }}
        </p>
      </Transition>
      <v-progress-circular
        indeterminate
        color="primary"
        size="64"
        width="6"
      />
    </div>
  </v-container>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
