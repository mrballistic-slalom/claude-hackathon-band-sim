<script setup lang="ts">
import { useDrama } from './composables/useDrama'
import InputScreen from './components/InputScreen.vue'
import LoadingScreen from './components/LoadingScreen.vue'
import ChatScreen from './components/ChatScreen.vue'

const drama = useDrama()
</script>

<template>
  <v-app>
    <v-main>
      <Transition name="fade" mode="out-in">
        <InputScreen
          v-if="drama.screen.value === 'input'"
          key="input"
          @submit="drama.generate($event)"
        />
        <LoadingScreen
          v-else-if="drama.screen.value === 'loading'"
          key="loading"
        />
        <ChatScreen
          v-else
          key="chat"
          :messages="drama.allMessages.value"
          :metadata="drama.bandMetadata.value"
          :drama-level="drama.dramaLevel.value"
          :is-loading="drama.isLoading.value"
          :frontperson-name="drama.frontpersonName.value"
          @escalate="drama.escalate"
        />
      </Transition>
    </v-main>
  </v-app>
</template>
