<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Pronouns } from '../types'

const emit = defineEmits<{
  submit: [payload: { name: string; traits: [string, string, string]; petty_level: number; pronouns: Pronouns }]
}>()

const name = ref('')
const traits = ref(['', '', ''])
const pettyLevel = ref(5)
const pronouns = ref<Pronouns | null>(null)

const isValid = computed(() => {
  return (
    name.value.trim().length > 0 &&
    traits.value.every((t) => t.trim().length > 0) &&
    pronouns.value !== null
  )
})

function handleSubmit() {
  if (!isValid.value || !pronouns.value) return
  const t0 = traits.value[0]
  const t1 = traits.value[1]
  const t2 = traits.value[2]
  if (t0 === undefined || t1 === undefined || t2 === undefined) return
  emit('submit', {
    name: name.value.trim(),
    traits: [t0.trim(), t1.trim(), t2.trim()],
    petty_level: pettyLevel.value,
    pronouns: pronouns.value,
  })
}

const pronounOptions: { value: Pronouns; label: string; vibe: string }[] = [
  { value: 'he', label: 'he/him', vibe: 'brooding' },
  { value: 'she', label: 'she/her', vibe: 'ethereal' },
  { value: 'they', label: 'they/them', vibe: 'enigmatic' },
]

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
    <video
      class="intro-video"
      autoplay
      loop
      muted
      playsinline
      src="/background.mp4"
    />
    <div class="intro-overlay" />

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

        <!-- Pronoun selector -->
        <div class="mt-2 mb-2">
          <label class="text-caption text-medium-emphasis d-block mb-2">
            How should the press refer to this person?
          </label>
          <div class="pronoun-options">
            <button
              v-for="opt in pronounOptions"
              :key="opt.value"
              class="pronoun-chip"
              :class="{ 'pronoun-chip--active': pronouns === opt.value }"
              type="button"
              @click="pronouns = opt.value"
            >
              <span class="pronoun-label">{{ opt.label }}</span>
              <span class="pronoun-vibe">{{ opt.vibe }}</span>
            </button>
          </div>
        </div>

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
  position: relative;
  background: #0a0a0a;
}

.intro-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.intro-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1;
}

.intro-center {
  position: relative;
  z-index: 2;
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

.pronoun-options {
  display: flex;
  gap: 10px;
}

.pronoun-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
}

.pronoun-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.pronoun-chip--active {
  background: rgba(255, 20, 147, 0.15);
  border-color: rgba(255, 20, 147, 0.5);
}

.pronoun-label {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
}

.pronoun-vibe {
  font-size: 0.7rem;
  opacity: 0.5;
  font-style: italic;
}
</style>
