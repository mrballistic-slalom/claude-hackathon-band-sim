<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  submit: [payload: { name: string; traits: [string, string, string]; petty_level: number }]
}>()

const name = ref('')
const traits = ref(['', '', ''])
const pettyLevel = ref(5)

const isValid = computed(() => {
  return name.value.trim().length > 0 && traits.value.every((t) => t.trim().length > 0)
})

function handleSubmit() {
  if (!isValid.value) return
  const t0 = traits.value[0]
  const t1 = traits.value[1]
  const t2 = traits.value[2]
  if (t0 === undefined || t1 === undefined || t2 === undefined) return
  emit('submit', {
    name: name.value.trim(),
    traits: [t0.trim(), t1.trim(), t2.trim()],
    petty_level: pettyLevel.value,
  })
}

const microcopyMessages = [
  'A&R executives are nervous...',
  'Pitchfork is already typing...',
  'The vinyl pre-order is live and it hasn\'t even been recorded yet.',
]
const currentMicrocopy = ref(0)
let microcopyInterval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  microcopyInterval = setInterval(() => {
    currentMicrocopy.value = (currentMicrocopy.value + 1) % microcopyMessages.length
  }, 3000)
})

onUnmounted(() => {
  if (microcopyInterval !== undefined) {
    clearInterval(microcopyInterval)
  }
})
</script>

<template>
  <div class="intro-backdrop">
    <div class="intro-center">
      <div class="glass-card intro-card">
        <h1 class="font-headline text-h3 text-center mb-2">Who wronged you?</h1>
        <p class="text-center text-medium-emphasis mb-8">
          Name your nemesis. We'll turn them into a band they never asked for.
        </p>

        <v-text-field
          v-model="name"
          label="Name"
          placeholder="Your nemesis, your boss, your ex..."
          variant="outlined"
          class="mb-2"
        />

        <v-row dense>
          <v-col cols="4">
            <v-text-field
              v-model="traits[0]"
              label="Trait 1"
              placeholder="loud"
              variant="outlined"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model="traits[1]"
              label="Trait 2"
              placeholder="always late"
              variant="outlined"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model="traits[2]"
              label="Trait 3"
              placeholder="replies-all"
              variant="outlined"
            />
          </v-col>
        </v-row>

        <v-slider
          v-model="pettyLevel"
          :min="1"
          :max="10"
          :step="1"
          thumb-label="always"
          color="secondary"
          label="Petty Level"
          class="mt-4 mb-6"
        />

        <v-btn
          size="large"
          block
          color="secondary"
          :disabled="!isValid"
          @click="handleSubmit"
        >
          Turn Them Into a Band
        </v-btn>

        <p class="text-center text-medium-emphasis text-body-2 mt-6" style="min-height: 24px">
          {{ microcopyMessages[currentMicrocopy] }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro-backdrop {
  height: 100vh;
  height: 100dvh;
  width: 100%;
  overflow: auto;
  /* Background image slot — set url() when ready */
  background: #0a0a0a;
  background-size: cover;
  background-position: center;
}

.intro-center {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.intro-card {
  width: 100%;
  max-width: 560px;
  padding: 36px 32px;
}
</style>
