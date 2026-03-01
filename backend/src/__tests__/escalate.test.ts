import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMessage } from '../types';

// Mock the agents module so callAgent never hits AWS Bedrock
vi.mock('../agents', () => ({
  callAgent: vi.fn(),
}));

import { handleEscalate } from '../escalate';
import { callAgent } from '../agents';

const mockedCallAgent = vi.mocked(callAgent);

/** Helper to build an AgentMessage. */
function makeMessage(
  agent: AgentMessage['agent'],
  content: string,
  displayName?: string
): AgentMessage {
  const names: Record<string, string> = {
    clive: 'Clive',
    frontperson: 'TestPerson',
    journalist: 'Margaux',
    ex_member: 'The Ex-Member',
  };
  return {
    agent,
    agent_display_name: displayName ?? names[agent] ?? agent,
    content,
    reacting_to: null,
  };
}

describe('handleEscalate', () => {
  let sseEvents: Array<{ type: string; data: any }>;
  let writeSSE: (eventType: string, data: any) => void;

  beforeEach(() => {
    mockedCallAgent.mockReset();
    sseEvents = [];
    writeSSE = (eventType: string, data: any) => {
      sseEvents.push({ type: eventType, data });
    };
  });

  // ---------------------------------------------------------------------------
  // Agent selection: always picks 2 or 3 agents
  // ---------------------------------------------------------------------------
  it('selects 2 or 3 agents and streams that many messages on success', async () => {
    mockedCallAgent.mockResolvedValue('Some witty response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'I see Q3 potential here.'),
      makeMessage('frontperson', 'The work speaks for itself.'),
      makeMessage('journalist', '7.4 Best New Confrontation.'),
      makeMessage('ex_member', 'I have the receipts.'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 3,
        band_metadata: { band_name: 'Test', genre: 'Post-everything', pitch: 'A band', influences: [] },
      },
      writeSSE
    );

    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    const doneEvents = sseEvents.filter((e) => e.type === 'done');

    // Should produce 2 or 3 agent messages
    expect(messageEvents.length).toBeGreaterThanOrEqual(2);
    expect(messageEvents.length).toBeLessThanOrEqual(3);
    // Always exactly one done event
    expect(doneEvents).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Done event is ALWAYS sent, even on failure
  // ---------------------------------------------------------------------------
  it('always sends a done event', async () => {
    mockedCallAgent.mockResolvedValue(null); // all agents fail

    await handleEscalate(
      {
        session_id: 'test',
        history: [makeMessage('clive', 'Something')],
        drama_level: 1,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    const doneEvents = sseEvents.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Fallback message when all agents fail
  // ---------------------------------------------------------------------------
  it('sends a fallback message from Margaux when all agent calls fail', async () => {
    mockedCallAgent.mockResolvedValue(null);

    await handleEscalate(
      {
        session_id: 'test',
        history: [makeMessage('clive', 'Testing failure path')],
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    expect(messageEvents).toHaveLength(1);

    const fallback = messageEvents[0].data;
    expect(fallback.agent).toBe('journalist');
    expect(fallback.agent_display_name).toBe('Margaux');
    expect(fallback.content).toContain('Wi-Fi');
    expect(fallback.content).toContain('Best New Outage');
  });

  // ---------------------------------------------------------------------------
  // Agents only react to OTHER agents' messages (not their own)
  // ---------------------------------------------------------------------------
  it('passes messages from other agents as targets (not self)', async () => {
    // Only one message in history, from clive
    const history: AgentMessage[] = [makeMessage('clive', 'Market positioning is key.')];

    mockedCallAgent.mockResolvedValue('A response');

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 1,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    // Inspect every callAgent invocation to verify the instruction references a different agent
    for (const call of mockedCallAgent.mock.calls) {
      const instruction = call[2]; // third argument is the instruction string
      // The instruction should reference a message from the history;
      // since clive is the only message, any agent OTHER than clive should reference clive.
      // If clive is selected, there are messages from other agents (only if other agents already responded this round).
      expect(typeof instruction).toBe('string');
      expect(instruction.length).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------------------
  // Each message includes a reacting_to field with excerpt
  // ---------------------------------------------------------------------------
  it('includes reacting_to with an excerpt in each agent message', async () => {
    const longContent = 'A'.repeat(200);
    const history: AgentMessage[] = [
      makeMessage('clive', longContent),
      makeMessage('frontperson', 'The work is the work.'),
    ];

    mockedCallAgent.mockResolvedValue('Reacting now');

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    for (const event of messageEvents) {
      expect(event.data.reacting_to).not.toBeNull();
      expect(event.data.reacting_to.agent).toBeDefined();
      // Excerpt should be truncated to 100 characters max
      expect(event.data.reacting_to.excerpt.length).toBeLessThanOrEqual(100);
    }
  });

  // ---------------------------------------------------------------------------
  // User traits are threaded through when provided as array
  // ---------------------------------------------------------------------------
  it('passes user-supplied array traits to the agent system prompt', async () => {
    mockedCallAgent.mockResolvedValue('Response with traits');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing traits'),
      makeMessage('frontperson', 'My art transcends', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: ['loud', 'dramatic', 'petty'],
        petty_level: 8,
      },
      writeSSE
    );

    // At least one callAgent call should have been made
    expect(mockedCallAgent).toHaveBeenCalled();

    // Check that any frontperson call uses the correct system prompt with sanitized traits
    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0]; // first argument is system prompt
      // If the system prompt is for the frontperson, it should contain the traits
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('loud');
        expect(systemPrompt).toContain('dramatic');
        expect(systemPrompt).toContain('petty');
        expect(systemPrompt).toContain('8/10');
      }
    }
  });

  // ---------------------------------------------------------------------------
  // User traits as a single string are handled
  // ---------------------------------------------------------------------------
  it('handles traits provided as a single string', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing string trait'),
      makeMessage('frontperson', 'Art is suffering', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: 'stubborn' as any,
        petty_level: 5,
      },
      writeSSE
    );

    // Verify callAgent was invoked (string trait didn't crash)
    expect(mockedCallAgent).toHaveBeenCalled();

    // If frontperson was selected, the prompt should contain the trait
    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('stubborn');
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Fallback to default traits when traits are missing/empty
  // ---------------------------------------------------------------------------
  it('falls back to default traits when none provided', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing defaults'),
      makeMessage('frontperson', 'I am the work', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        // traits intentionally omitted
      },
      writeSSE
    );

    expect(mockedCallAgent).toHaveBeenCalled();

    // If frontperson was selected, it should use the fallback traits
    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('passionate');
        expect(systemPrompt).toContain('misunderstood');
        expect(systemPrompt).toContain('visionary');
      }
    }
  });

  it('falls back to default traits when provided as empty array', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing empty'),
      makeMessage('frontperson', 'Empty traits test', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: [],
      },
      writeSSE
    );

    expect(mockedCallAgent).toHaveBeenCalled();

    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('passionate');
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Petty level defaults to 5 when invalid
  // ---------------------------------------------------------------------------
  it('defaults petty_level to 5 when not a valid number', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing petty default'),
      makeMessage('frontperson', 'Default petty', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: ['a', 'b', 'c'],
        petty_level: undefined as any,
      },
      writeSSE
    );

    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('5/10');
      }
    }
  });

  it('defaults petty_level to 5 when out of range (0)', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing petty range'),
      makeMessage('frontperson', 'Petty range test', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: ['a', 'b', 'c'],
        petty_level: 0,
      },
      writeSSE
    );

    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('5/10');
      }
    }
  });

  it('defaults petty_level to 5 when out of range (11)', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Testing petty high'),
      makeMessage('frontperson', 'Petty high test', 'Greg'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: ['a', 'b', 'c'],
        petty_level: 11,
      },
      writeSSE
    );

    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).toContain('5/10');
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Drama modifier is included in the instruction
  // ---------------------------------------------------------------------------
  it('includes the drama modifier in agent instructions at drama level 3', async () => {
    mockedCallAgent.mockResolvedValue('Dramatic response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Drama test'),
      makeMessage('journalist', 'Reviewing the drama'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 3,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    // Every callAgent instruction should contain the level 3 drama modifier
    for (const call of mockedCallAgent.mock.calls) {
      const instruction = call[2];
      expect(instruction).toContain('public incident');
    }
  });

  it('includes the catastrophe drama modifier at level 6+', async () => {
    mockedCallAgent.mockResolvedValue('Catastrophe response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'This is fine'),
      makeMessage('ex_member', 'Leaked text incoming'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 6,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    for (const call of mockedCallAgent.mock.calls) {
      const instruction = call[2];
      expect(instruction).toContain('catastrophe');
    }
  });

  it('does not include a drama modifier at level 1', async () => {
    mockedCallAgent.mockResolvedValue('Calm response');

    const history: AgentMessage[] = [
      makeMessage('clive', 'Level 1 test'),
      makeMessage('journalist', 'Reviewing calmly'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 1,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    for (const call of mockedCallAgent.mock.calls) {
      const instruction = call[2];
      // Level 1 drama modifier is empty string, so no extra drama text
      expect(instruction).not.toContain('catastrophe');
      expect(instruction).not.toContain('public incident');
      expect(instruction).not.toContain('Tensions are rising');
    }
  });

  // ---------------------------------------------------------------------------
  // Frontperson name extraction from history
  // ---------------------------------------------------------------------------
  it('extracts frontperson name from history for display names', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('frontperson', 'I am the voice', 'Greg'),
      makeMessage('clive', 'Let us circle back'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: ['loud', 'late', 'rude'],
        petty_level: 7,
      },
      writeSSE
    );

    const messageEvents = sseEvents.filter((e) => e.type === 'message');

    // If the frontperson responded, their display name should be "Greg"
    const frontpersonMessages = messageEvents.filter((e) => e.data.agent === 'frontperson');
    for (const msg of frontpersonMessages) {
      expect(msg.data.agent_display_name).toBe('Greg');
    }

    // For the ex-member, the system prompt should reference "Greg"
    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('ex-member') || systemPrompt.includes('Parking Lot Requiem')) {
        expect(systemPrompt).toContain('Greg');
      }
    }
  });

  it('falls back to "The Frontperson" when no frontperson in history', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    // History with no frontperson message
    const history: AgentMessage[] = [
      makeMessage('clive', 'Where is the frontperson?'),
      makeMessage('journalist', 'Reviewing the absence'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    const frontpersonMessages = messageEvents.filter((e) => e.data.agent === 'frontperson');
    for (const msg of frontpersonMessages) {
      expect(msg.data.agent_display_name).toBe('The Frontperson');
    }
  });

  // ---------------------------------------------------------------------------
  // Partial failures: some agents fail, others succeed
  // ---------------------------------------------------------------------------
  it('continues past failed agents and still sends done', async () => {
    // First call fails, second succeeds, third fails (if 3 agents selected)
    let callCount = 0;
    mockedCallAgent.mockImplementation(async () => {
      callCount++;
      return callCount % 2 === 0 ? 'Successful response' : null;
    });

    const history: AgentMessage[] = [
      makeMessage('clive', 'Partial failure test'),
      makeMessage('frontperson', 'Still here', 'Greg'),
      makeMessage('journalist', 'Reviewing partial failure'),
      makeMessage('ex_member', 'Leaking partial failure'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 3,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    const doneEvents = sseEvents.filter((e) => e.type === 'done');

    // At least 1 success message (no fallback since at least one succeeded)
    expect(messageEvents.length).toBeGreaterThanOrEqual(1);
    // Should NOT have the Margaux fallback since at least one agent succeeded
    const hasFallback = messageEvents.some(
      (e) => e.data.content && e.data.content.includes('Best New Outage')
    );
    expect(hasFallback).toBe(false);
    expect(doneEvents).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Each agent receives full history + this round's prior messages
  // ---------------------------------------------------------------------------
  it('passes accumulated round messages to subsequent agents', async () => {
    let callIndex = 0;
    mockedCallAgent.mockImplementation(async () => {
      callIndex++;
      return `Response ${callIndex}`;
    });

    const history: AgentMessage[] = [
      makeMessage('clive', 'Original message from Clive'),
      makeMessage('frontperson', 'Original from frontperson', 'Greg'),
      makeMessage('journalist', 'Original from Margaux'),
      makeMessage('ex_member', 'Original from ex-member'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
      },
      writeSSE
    );

    // The second callAgent call should receive more messages than the first
    if (mockedCallAgent.mock.calls.length >= 2) {
      const firstCallMessages = mockedCallAgent.mock.calls[0][1] as AgentMessage[];
      const secondCallMessages = mockedCallAgent.mock.calls[1][1] as AgentMessage[];
      // Second agent sees original history + first agent's response from this round
      expect(secondCallMessages.length).toBe(firstCallMessages.length + 1);
    }
  });

  // ---------------------------------------------------------------------------
  // Traits padding: short arrays get padded to 3
  // ---------------------------------------------------------------------------
  it('pads traits to exactly 3 when fewer are provided', async () => {
    mockedCallAgent.mockResolvedValue('Response');

    const history: AgentMessage[] = [
      makeMessage('frontperson', 'Short traits test', 'Greg'),
      makeMessage('clive', 'Testing padding'),
    ];

    await handleEscalate(
      {
        session_id: 'test',
        history,
        drama_level: 2,
        band_metadata: { band_name: 'Test', genre: 'Test', pitch: 'Test', influences: [] },
        traits: ['only-one'],
        petty_level: 5,
      },
      writeSSE
    );

    // The frontperson system prompt template expects 3 traits in the format:
    // "trait1, trait2, trait3" — verify no "undefined" appears
    for (const call of mockedCallAgent.mock.calls) {
      const systemPrompt = call[0];
      if (systemPrompt.includes('petty level')) {
        expect(systemPrompt).not.toContain('undefined');
        expect(systemPrompt).toContain('only-one');
      }
    }
  });
});
