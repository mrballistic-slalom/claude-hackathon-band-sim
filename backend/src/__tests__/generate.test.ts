import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMessage } from '../types';

// Mock the agents module so callAgent never hits AWS Bedrock
vi.mock('../agents', () => ({
  callAgent: vi.fn(),
}));

import { handleGenerate } from '../generate';
import { callAgent } from '../agents';

const mockedCallAgent = vi.mocked(callAgent);

describe('handleGenerate', () => {
  let sseEvents: Array<{ type: string; data: any }>;
  let writeSSE: (eventType: string, data: any) => void;

  const validInput = {
    name: 'Greg',
    traits: ['loud', 'late', 'rude'] as [string, string, string],
    petty_level: 7,
  };

  beforeEach(() => {
    mockedCallAgent.mockReset();
    sseEvents = [];
    writeSSE = (eventType: string, data: any) => {
      sseEvents.push({ type: eventType, data });
    };
  });

  // ---------------------------------------------------------------------------
  // extractBandMetadata: parses structured fields from Clive's response
  // ---------------------------------------------------------------------------
  describe('band metadata extraction (via Clive response)', () => {
    it('parses BAND NAME, GENRE, PITCH, and INFLUENCES from structured response', async () => {
      const cliveResponse = [
        'BAND NAME: The Existential Dread',
        'GENRE: Post-Ironic Shoegaze',
        'PITCH: A band that makes you feel like you forgot something important.',
        'INFLUENCES: Radiohead, A sense of impending dread, The sound of a fridge humming',
        'This band has real Q3 potential.',
      ].join('\n');

      mockedCallAgent
        .mockResolvedValueOnce(cliveResponse) // Clive
        .mockResolvedValueOnce('The work speaks for itself.') // Frontperson
        .mockResolvedValueOnce('7.4 Best New Formation.') // Margaux
        .mockResolvedValueOnce('I have the texts.'); // Ex-Member

      await handleGenerate(validInput, writeSSE);

      const metadataEvents = sseEvents.filter((e) => e.type === 'metadata');
      expect(metadataEvents).toHaveLength(1);

      const metadata = metadataEvents[0].data;
      expect(metadata.band_name).toBe('The Existential Dread');
      expect(metadata.genre).toBe('Post-Ironic Shoegaze');
      expect(metadata.pitch).toBe(
        'A band that makes you feel like you forgot something important.'
      );
      expect(metadata.influences).toEqual([
        'Radiohead',
        'A sense of impending dread',
        'The sound of a fridge humming',
      ]);
    });

    it('uses fallback metadata when Clive response lacks structured fields', async () => {
      // Clive's response has no BAND NAME:, GENRE:, etc.
      const unstructuredResponse = 'This band is going to be huge. Trust me on this.';

      mockedCallAgent
        .mockResolvedValueOnce(unstructuredResponse) // Clive
        .mockResolvedValueOnce('Fine.') // Frontperson
        .mockResolvedValueOnce('6.0') // Margaux
        .mockResolvedValueOnce('Leaked.'); // Ex-Member

      await handleGenerate(validInput, writeSSE);

      const metadataEvents = sseEvents.filter((e) => e.type === 'metadata');
      expect(metadataEvents).toHaveLength(1);

      const metadata = metadataEvents[0].data;
      // Fallback band name uses the input name
      expect(metadata.band_name).toBe('The Greg Experience');
      expect(metadata.genre).toBe('Post-everything');
      expect(metadata.pitch).toBe(
        'A band that defies categorization, mostly by accident.'
      );
      expect(metadata.influences).toEqual([
        'Radiohead',
        'A sense of impending dread',
      ]);
    });

    it('handles partial structured fields with fallbacks for missing ones', async () => {
      const partialResponse = [
        'BAND NAME: Half-Formed Thoughts',
        'This is going to be a commercial success.',
      ].join('\n');

      mockedCallAgent
        .mockResolvedValueOnce(partialResponse)
        .mockResolvedValueOnce('Sure.')
        .mockResolvedValueOnce('5.0')
        .mockResolvedValueOnce('Whatever.');

      await handleGenerate(validInput, writeSSE);

      const metadata = sseEvents.find((e) => e.type === 'metadata')!.data;
      expect(metadata.band_name).toBe('Half-Formed Thoughts');
      // Missing fields get fallbacks
      expect(metadata.genre).toBe('Post-everything');
      expect(metadata.pitch).toBe(
        'A band that defies categorization, mostly by accident.'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Full successful flow: metadata + 4 agent messages + done
  // ---------------------------------------------------------------------------
  it('produces metadata, 4 agent messages, and a done event on full success', async () => {
    const cliveResponse =
      'BAND NAME: Test Band\nGENRE: Test\nPITCH: Test pitch\nINFLUENCES: Test1, Test2\nGreat potential.';

    mockedCallAgent
      .mockResolvedValueOnce(cliveResponse)
      .mockResolvedValueOnce('Frontperson response')
      .mockResolvedValueOnce('Margaux response')
      .mockResolvedValueOnce('Ex-member response');

    await handleGenerate(validInput, writeSSE);

    const types = sseEvents.map((e) => e.type);
    expect(types).toEqual(['metadata', 'message', 'message', 'message', 'message', 'done']);

    // Verify agent ordering: Clive -> Frontperson -> Margaux -> Ex-Member
    const messages = sseEvents.filter((e) => e.type === 'message');
    expect(messages[0].data.agent).toBe('clive');
    expect(messages[1].data.agent).toBe('frontperson');
    expect(messages[2].data.agent).toBe('journalist');
    expect(messages[3].data.agent).toBe('ex_member');
  });

  // ---------------------------------------------------------------------------
  // Agent display names are correct
  // ---------------------------------------------------------------------------
  it('uses correct display names for each agent', async () => {
    const cliveResponse =
      'BAND NAME: X\nGENRE: X\nPITCH: X\nINFLUENCES: X\nGreat.';

    mockedCallAgent
      .mockResolvedValueOnce(cliveResponse)
      .mockResolvedValueOnce('Response')
      .mockResolvedValueOnce('Response')
      .mockResolvedValueOnce('Response');

    await handleGenerate(validInput, writeSSE);

    const messages = sseEvents.filter((e) => e.type === 'message');
    expect(messages[0].data.agent_display_name).toBe('Clive');
    expect(messages[1].data.agent_display_name).toBe('Greg'); // Uses input name
    expect(messages[2].data.agent_display_name).toBe('Margaux');
    expect(messages[3].data.agent_display_name).toBe('The Ex-Member');
  });

  // ---------------------------------------------------------------------------
  // Done event is ALWAYS sent
  // ---------------------------------------------------------------------------
  it('always sends a done event even on full failure', async () => {
    mockedCallAgent.mockResolvedValue(null);

    await handleGenerate(validInput, writeSSE);

    const doneEvents = sseEvents.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Fallback message when all agents fail
  // ---------------------------------------------------------------------------
  it('sends a Clive fallback message when all agents fail', async () => {
    mockedCallAgent.mockResolvedValue(null);

    await handleGenerate(validInput, writeSSE);

    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    expect(messageEvents).toHaveLength(1);

    const fallback = messageEvents[0].data;
    expect(fallback.agent).toBe('clive');
    expect(fallback.agent_display_name).toBe('Clive');
    expect(fallback.content).toContain('Wi-Fi');
  });

  // ---------------------------------------------------------------------------
  // Partial failure: Clive fails, others may still try
  // ---------------------------------------------------------------------------
  it('skips metadata and Clive message when Clive fails but continues with other agents', async () => {
    mockedCallAgent
      .mockResolvedValueOnce(null) // Clive fails
      .mockResolvedValueOnce('Frontperson still here') // Frontperson succeeds
      .mockResolvedValueOnce(null) // Margaux fails
      .mockResolvedValueOnce('Ex-member leaks'); // Ex-member succeeds

    await handleGenerate(validInput, writeSSE);

    // No metadata event since Clive failed
    const metadataEvents = sseEvents.filter((e) => e.type === 'metadata');
    expect(metadataEvents).toHaveLength(0);

    // Should have 2 successful messages
    const messageEvents = sseEvents.filter((e) => e.type === 'message');
    expect(messageEvents).toHaveLength(2);
    expect(messageEvents[0].data.agent).toBe('frontperson');
    expect(messageEvents[1].data.agent).toBe('ex_member');

    // No fallback since some agents succeeded
    const hasFallback = messageEvents.some((e) => e.data.content.includes('Wi-Fi'));
    expect(hasFallback).toBe(false);

    // Done event still sent
    expect(sseEvents.filter((e) => e.type === 'done')).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Sequential agent calls: each agent sees prior messages
  // ---------------------------------------------------------------------------
  it('passes accumulated messages to each subsequent agent', async () => {
    const cliveResponse =
      'BAND NAME: X\nGENRE: X\nPITCH: X\nINFLUENCES: X\nClive says something.';

    // Track the messages array length at each call since generate.ts passes
    // the same mutable array reference to all callAgent invocations.
    const messagesLengthPerCall: number[] = [];

    mockedCallAgent.mockImplementation(async (_systemPrompt, messages, _instruction) => {
      messagesLengthPerCall.push((messages as AgentMessage[]).length);
      const callIndex = messagesLengthPerCall.length;
      if (callIndex === 1) return cliveResponse;
      if (callIndex === 2) return 'Frontperson reacts';
      if (callIndex === 3) return 'Margaux reviews';
      if (callIndex === 4) return 'Ex-member leaks';
      return null;
    });

    await handleGenerate(validInput, writeSSE);

    // Clive gets empty messages array (first agent)
    expect(messagesLengthPerCall[0]).toBe(0);
    // Frontperson gets 1 message (Clive's)
    expect(messagesLengthPerCall[1]).toBe(1);
    // Margaux gets 2 messages (Clive + Frontperson)
    expect(messagesLengthPerCall[2]).toBe(2);
    // Ex-Member gets 3 messages (Clive + Frontperson + Margaux)
    expect(messagesLengthPerCall[3]).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Input sanitization: name and traits are sanitized before use
  // ---------------------------------------------------------------------------
  it('sanitizes name and traits before passing to prompts', async () => {
    const cliveResponse =
      'BAND NAME: X\nGENRE: X\nPITCH: X\nINFLUENCES: X\nSanitized.';

    mockedCallAgent
      .mockResolvedValueOnce(cliveResponse)
      .mockResolvedValueOnce('Response')
      .mockResolvedValueOnce('Response')
      .mockResolvedValueOnce('Response');

    // Input with special characters
    const inputWithSpecialChars = {
      name: 'Greg<script>alert(1)</script>',
      traits: ['loud & proud', 'late!!!', 'rude@home'] as [string, string, string],
      petty_level: 5,
    };

    await handleGenerate(inputWithSpecialChars, writeSSE);

    // Clive's instruction should contain sanitized name (no angle brackets)
    const cliveInstruction = mockedCallAgent.mock.calls[0][2];
    expect(cliveInstruction).not.toContain('<script>');
    expect(cliveInstruction).not.toContain('</script>');
    expect(cliveInstruction).toContain('Greg');
  });

  // ---------------------------------------------------------------------------
  // Traits passed as string: Clive call works, but frontperson call crashes
  // because generate.ts passes raw input.traits (a string) to
  // getFrontpersonSystemPrompt which calls traits.map(). This is a known
  // issue — the validation layer should reject non-array traits before
  // reaching handleGenerate.
  // ---------------------------------------------------------------------------
  it('handles string traits by sanitizing to an array', async () => {
    const cliveResponse =
      'BAND NAME: X\nGENRE: X\nPITCH: X\nINFLUENCES: X\nString trait.';

    mockedCallAgent.mockResolvedValue(cliveResponse);

    const inputWithStringTraits = {
      name: 'Greg',
      traits: 'stubborn' as any,
      petty_level: 5,
    };

    // Should handle string traits without crashing (sanitized to array)
    await handleGenerate(inputWithStringTraits, writeSSE);

    // Clive's call should have been made with sanitized traits
    const cliveInstruction = mockedCallAgent.mock.calls[0][2];
    expect(cliveInstruction).toContain('stubborn');
  });

  // ---------------------------------------------------------------------------
  // All agents called exactly once in correct order
  // ---------------------------------------------------------------------------
  it('calls exactly 4 agents in order: Clive, Frontperson, Margaux, Ex-Member', async () => {
    const cliveResponse =
      'BAND NAME: X\nGENRE: X\nPITCH: X\nINFLUENCES: X\nDone.';

    mockedCallAgent
      .mockResolvedValueOnce(cliveResponse)
      .mockResolvedValueOnce('FP')
      .mockResolvedValueOnce('MX')
      .mockResolvedValueOnce('EX');

    await handleGenerate(validInput, writeSSE);

    expect(mockedCallAgent).toHaveBeenCalledTimes(4);

    // Verify system prompts contain expected agent markers
    const [cliveCall, fpCall, mxCall, exCall] = mockedCallAgent.mock.calls;

    expect(cliveCall[0]).toContain('Clive'); // Clive system prompt
    expect(fpCall[0]).toContain('frontperson'); // Frontperson system prompt
    expect(mxCall[0]).toContain('Margaux'); // Margaux system prompt
    expect(exCall[0]).toContain('Parking Lot Requiem'); // Ex-member system prompt
  });
});
