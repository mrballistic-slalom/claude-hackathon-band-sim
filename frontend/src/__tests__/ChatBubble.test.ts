import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import ChatBubble from '../components/ChatBubble.vue';
import type { AgentMessage } from '../types';

const vuetify = createVuetify({ components, directives });

function mountChatBubble(message: AgentMessage) {
  return mount(ChatBubble, {
    global: { plugins: [vuetify] },
    props: { message },
  });
}

describe('ChatBubble', () => {
  const baseMessage: AgentMessage = {
    agent: 'clive',
    agent_display_name: 'Clive the Manager',
    content: 'This band is going places!',
    reacting_to: null,
  };

  it('renders agent name and message content', () => {
    const wrapper = mountChatBubble(baseMessage);
    const text = wrapper.text();

    expect(text).toContain('Clive the Manager');
    expect(text).toContain('This band is going places!');
  });

  it('shows reacting_to text when present', () => {
    const message: AgentMessage = {
      ...baseMessage,
      reacting_to: { agent: 'journalist', excerpt: 'Their first album was derivative' },
    };
    const wrapper = mountChatBubble(message);
    const text = wrapper.text();

    expect(text).toContain('replying to journalist');
    expect(text).toContain('Their first album was derivative');
  });

  it('does not show reacting_to block when null', () => {
    const wrapper = mountChatBubble(baseMessage);
    const text = wrapper.text();

    expect(text).not.toContain('replying to');
  });

  it('applies correct agent color to the name', () => {
    const wrapper = mountChatBubble(baseMessage);

    // Clive's colour is #4682b4
    const nameSpan = wrapper.find('.font-agent-name');
    expect(nameSpan.exists()).toBe(true);
    expect(nameSpan.attributes('style')).toContain('#4682b4');
  });

  it('applies correct color for a different agent', () => {
    const message: AgentMessage = {
      agent: 'ex_member',
      agent_display_name: 'The Ex-Member',
      content: 'I was here first.',
      reacting_to: null,
    };
    const wrapper = mountChatBubble(message);

    // ex_member colour is #ef4444
    const nameSpan = wrapper.find('.font-agent-name');
    expect(nameSpan.attributes('style')).toContain('#ef4444');
  });
});
