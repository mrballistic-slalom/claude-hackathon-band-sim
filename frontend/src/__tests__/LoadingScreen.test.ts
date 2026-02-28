import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import LoadingScreen from '../components/LoadingScreen.vue';

const vuetify = createVuetify({ components, directives });

function mountLoadingScreen() {
  return mount(LoadingScreen, {
    global: { plugins: [vuetify] },
  });
}

describe('LoadingScreen', () => {
  it('renders without errors', () => {
    const wrapper = mountLoadingScreen();
    expect(wrapper.exists()).toBe(true);
  });

  it('shows a status message text', () => {
    const wrapper = mountLoadingScreen();

    // The first message displayed should be "Signing record deal..."
    const text = wrapper.text();
    expect(text).toContain('Signing record deal...');
  });
});
