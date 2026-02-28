import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import InputScreen from '../components/InputScreen.vue';

const vuetify = createVuetify({ components, directives });

function mountInputScreen() {
  return mount(InputScreen, {
    global: { plugins: [vuetify] },
  });
}

describe('InputScreen', () => {
  it('renders all form fields', () => {
    const wrapper = mountInputScreen();

    // Name field
    const nameInput = wrapper.find('input[type="text"]');
    expect(nameInput.exists()).toBe(true);

    // Three trait fields + the name field = 4 text inputs
    const allInputs = wrapper.findAll('input[type="text"]');
    expect(allInputs.length).toBe(4);

    // Submit button
    const btn = wrapper.find('button');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Turn Them Into a Band');
  });

  it('disables the submit button when fields are empty', () => {
    const wrapper = mountInputScreen();

    const btn = wrapper.find('button');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('enables the submit button when all fields are filled', async () => {
    const wrapper = mountInputScreen();

    const inputs = wrapper.findAll('input[type="text"]');
    // inputs[0] = name, inputs[1-3] = traits
    await inputs[0]!.setValue('Dave');
    await inputs[1]!.setValue('loud');
    await inputs[2]!.setValue('late');
    await inputs[3]!.setValue('rude');

    const btn = wrapper.find('button');
    expect(btn.attributes('disabled')).toBeUndefined();
  });
});
