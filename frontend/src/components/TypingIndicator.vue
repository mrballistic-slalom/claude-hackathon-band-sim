<template>
  <div class="typing-indicator d-flex align-center ga-1 pa-2">
    <span class="dot" :style="{ backgroundColor: color }" />
    <span class="dot" :style="{ backgroundColor: color }" />
    <span class="dot" :style="{ backgroundColor: color }" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ color: string }>()
</script>

<style scoped>
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}
.dot:nth-child(2) {
  animation-delay: 0.2s;
}
.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}
</style>
