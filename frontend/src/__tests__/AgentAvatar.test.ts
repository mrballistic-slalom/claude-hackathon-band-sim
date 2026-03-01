import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import AgentAvatar from '../components/AgentAvatar.vue';
import { AGENT_CONFIG } from '../config/agents';

const vuetify = createVuetify({ components, directives });

function mountAvatar(props: { agent: string; size?: number }) {
  return mount(AgentAvatar, {
    global: { plugins: [vuetify] },
    props,
  });
}

describe('AgentAvatar', () => {
  // ── Initials vs image rendering ───────────────────────────────────

  it('renders initials when agent has no avatarUrl', () => {
    // Temporarily clear the frontperson avatar to test the initials path
    const originalUrl = AGENT_CONFIG.frontperson.avatarUrl;
    AGENT_CONFIG.frontperson.avatarUrl = null;

    const wrapper = mountAvatar({ agent: 'frontperson' });

    expect(wrapper.find('.agent-avatar-initials').exists()).toBe(true);
    expect(wrapper.find('.agent-avatar-initials').text()).toBe('FP');
    expect(wrapper.find('img').exists()).toBe(false);

    // Restore
    AGENT_CONFIG.frontperson.avatarUrl = originalUrl;
  });

  it('renders an <img> when agent has an avatarUrl', () => {
    // Clive has an avatarUrl configured (/manager.jpg)
    const wrapper = mountAvatar({ agent: 'clive' });

    const img = wrapper.find('.agent-avatar-img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('/manager.jpg');
    expect(img.attributes('alt')).toBe('Clive');
    expect(wrapper.find('.agent-avatar-initials').exists()).toBe(false);
  });

  it('renders initials for an unknown agent (fallback config)', () => {
    const wrapper = mountAvatar({ agent: 'unknown_agent' });

    expect(wrapper.find('.agent-avatar-initials').exists()).toBe(true);
    expect(wrapper.find('.agent-avatar-initials').text()).toBe('UN');
    expect(wrapper.find('img').exists()).toBe(false);
  });

  // ── Agent color styling ───────────────────────────────────────────

  it('applies agent color as border style on the avatar element', () => {
    const wrapper = mountAvatar({ agent: 'clive' });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    // Clive's colorRgb is '70, 130, 180'
    expect(style).toContain('70, 130, 180');
  });

  it('applies agent color as text color on the avatar element', () => {
    const wrapper = mountAvatar({ agent: 'journalist' });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    // Journalist (Margaux) color is #f59e0b
    expect(style).toContain('#f59e0b');
  });

  it('applies background with agent colorRgb', () => {
    const wrapper = mountAvatar({ agent: 'ex_member' });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    // ex_member colorRgb is '239, 68, 68'
    expect(style).toContain('rgba(239, 68, 68, 0.2)');
  });

  it('applies border with agent colorRgb', () => {
    const wrapper = mountAvatar({ agent: 'ex_member' });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    expect(style).toContain('rgba(239, 68, 68, 0.5)');
  });

  // ── Size prop ─────────────────────────────────────────────────────

  it('defaults to 36px size', () => {
    const wrapper = mountAvatar({ agent: 'clive' });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    expect(style).toContain('width: 36px');
    expect(style).toContain('height: 36px');
  });

  it('respects a custom size prop', () => {
    const wrapper = mountAvatar({ agent: 'clive', size: 48 });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    expect(style).toContain('width: 48px');
    expect(style).toContain('height: 48px');
    expect(style).toContain('min-width: 48px');
  });

  it('scales font-size proportionally to size', () => {
    const wrapper = mountAvatar({ agent: 'clive', size: 100 });
    const style = wrapper.find('.agent-avatar').attributes('style') || '';

    // fontSize is size * 0.36 = 36px
    expect(style).toContain('font-size: 36px');
  });
});
