import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentMessage } from '../types';

// Use vi.hoisted so mockSend is available when the vi.mock factory runs (hoisted above imports)
const { mockSend } = vi.hoisted(() => {
  return { mockSend: vi.fn() };
});

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: class MockBedrockRuntimeClient {
      send = mockSend;
    },
    InvokeModelCommand: class MockInvokeModelCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

import { callAgent } from '../agents';

describe('callAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns content string on successful invocation', async () => {
    const responseBody = {
      content: [{ text: 'I am Clive and I disapprove.' }],
    };
    mockSend.mockResolvedValueOnce({
      body: new TextEncoder().encode(JSON.stringify(responseBody)),
    });

    const result = await callAgent('You are Clive.', [], 'Say something.');
    expect(result).toBe('I am Clive and I disapprove.');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns null when the SDK throws an error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Bedrock timeout'));

    const result = await callAgent('You are Clive.', [], 'Say something.');
    expect(result).toBeNull();
  });

  it('returns null when response content text is missing', async () => {
    const responseBody = { content: [{}] };
    mockSend.mockResolvedValueOnce({
      body: new TextEncoder().encode(JSON.stringify(responseBody)),
    });

    const result = await callAgent('System prompt', [], 'Instruction');
    expect(result).toBeNull();
  });

  it('formats conversation history into context messages', async () => {
    const messages: AgentMessage[] = [
      {
        agent: 'clive',
        agent_display_name: 'Clive',
        content: 'Let us circle back on Q3 targets.',
        reacting_to: null,
      },
      {
        agent: 'journalist',
        agent_display_name: 'Margaux',
        content: '7.4 — Best New Corporate Despair.',
        reacting_to: { agent: 'clive', excerpt: 'Q3 targets' },
      },
    ];

    const responseBody = {
      content: [{ text: 'Response text' }],
    };
    mockSend.mockResolvedValueOnce({
      body: new TextEncoder().encode(JSON.stringify(responseBody)),
    });

    await callAgent('System prompt', messages, 'React to the conversation.');

    // Extract the command passed to send() and parse the body
    const sendArg = mockSend.mock.calls[0][0];
    const body = JSON.parse(new TextDecoder().decode(sendArg.input.body));

    // Should have 3 messages: context, ack, instruction
    expect(body.messages).toHaveLength(3);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toContain('Clive: Let us circle back on Q3 targets.');
    expect(body.messages[0].content).toContain('Margaux: 7.4');
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[2].role).toBe('user');
    expect(body.messages[2].content).toBe('React to the conversation.');
    expect(body.system).toBe('System prompt');
  });

  it('sends only instruction when history is empty', async () => {
    const responseBody = {
      content: [{ text: 'Hello' }],
    };
    mockSend.mockResolvedValueOnce({
      body: new TextEncoder().encode(JSON.stringify(responseBody)),
    });

    await callAgent('System prompt', [], 'Just the instruction.');

    const sendArg = mockSend.mock.calls[0][0];
    const body = JSON.parse(new TextDecoder().decode(sendArg.input.body));

    // Only 1 message (the instruction), no context or ack
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toBe('Just the instruction.');
  });
});
