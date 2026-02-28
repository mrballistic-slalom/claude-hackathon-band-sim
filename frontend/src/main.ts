import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Global styles
import './styles/global.css'
import './styles/animations.css'
import './styles/liquid-glass.css'

const bandSimDark = {
  dark: true,
  colors: {
    background: '#0a0a0a',
    surface: '#1a1a1a',
    'surface-variant': '#2a2a2a',
    primary: '#39ff14',       // neon green
    secondary: '#ff1493',     // hot pink
    'on-background': '#ffffff',
    'on-surface': '#ffffff',
  },
}

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'bandSimDark',
    themes: {
      bandSimDark,
    },
  },
})

createApp(App).use(vuetify).mount('#app')
