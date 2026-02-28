import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import TypingIndicator from '../components/TypingIndicator.vue';

const vuetify = createVuetify({ components, directives });

function mountTypingIndicator(color: string) {
  return mount(TypingIndicator, {
    global: { plugins: [vuetify] },
    props: { color },
  });
}

describe('TypingIndicator', () => {
  it('renders 3 dots', () => {
    const wrapper = mountTypingIndicator('#ff0000');
    const dots = wrapper.findAll('.dot');

    expect(dots).toHaveLength(3);
  });

  it('applies the color prop to each dot', () => {
    const wrapper = mountTypingIndicator('#8b5cf6');
    const dots = wrapper.findAll('.dot');

    for (const dot of dots) {
      expect(dot.attributes('style')).toContain('#8b5cf6');
    }
  });
});
