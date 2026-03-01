import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSSEBuffer, useSSEStream } from '../composables/useSSEStream';

// ── parseSSEBuffer (pure function) ──────────────────────────────────

describe('parseSSEBuffer', () => {
  it('parses a single complete event', () => {
    const buffer = 'event: message\ndata: {"agent":"clive"}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ type: 'message', data: '{"agent":"clive"}' });
    expect(remaining).toBe('');
  });

  it('returns incomplete data as remaining', () => {
    const buffer = 'event: message\ndata: {"agent":"cli';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(0);
    expect(remaining).toBe('event: message\ndata: {"agent":"cli');
  });

  it('parses multiple complete events', () => {
    const buffer =
      'event: message\ndata: {"a":1}\n\n' +
      'event: message\ndata: {"a":2}\n\n' +
      'event: message\ndata: {"a":3}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ type: 'message', data: '{"a":1}' });
    expect(parsed[1]).toEqual({ type: 'message', data: '{"a":2}' });
    expect(parsed[2]).toEqual({ type: 'message', data: '{"a":3}' });
    expect(remaining).toBe('');
  });

  it('parses a metadata event', () => {
    const buffer = 'event: metadata\ndata: {"band_name":"The Grudges"}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      type: 'metadata',
      data: '{"band_name":"The Grudges"}',
    });
    expect(remaining).toBe('');
  });

  it('parses a done event', () => {
    const buffer = 'event: done\ndata: {}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ type: 'done', data: '{}' });
    expect(remaining).toBe('');
  });

  it('handles multiple complete events with a trailing incomplete event', () => {
    const buffer =
      'event: message\ndata: {"a":1}\n\n' +
      'event: message\ndata: {"a":2}\n\n' +
      'event: message\ndata: {"a":';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(2);
    expect(remaining).toBe('event: message\ndata: {"a":');
  });

  it('defaults to type "message" when no event line is present', () => {
    const buffer = 'data: {"default":true}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ type: 'message', data: '{"default":true}' });
    expect(remaining).toBe('');
  });

  it('skips empty blocks between events', () => {
    const buffer = '\n\nevent: message\ndata: {"a":1}\n\n\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);

    // The leading \n\n creates an empty block which is skipped.
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ type: 'message', data: '{"a":1}' });
    expect(remaining).toBe('');
  });

  it('returns empty parsed array and empty remaining for empty buffer', () => {
    const { parsed, remaining } = parseSSEBuffer('');

    expect(parsed).toHaveLength(0);
    expect(remaining).toBe('');
  });

  it('ignores events with no data: line', () => {
    const buffer = 'event: heartbeat\n\n';
    const { parsed } = parseSSEBuffer(buffer);

    expect(parsed).toHaveLength(0);
  });
});

// ── useSSEStream composable ─────────────────────────────────────────

describe('useSSEStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct initial state', () => {
    const { messages, metadata, isStreaming, isDone, error } = useSSEStream();

    expect(messages.value).toEqual([]);
    expect(metadata.value).toBeNull();
    expect(isStreaming.value).toBe(false);
    expect(isDone.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('reset() clears all state back to initial values', () => {
    const stream = useSSEStream();

    // Simulate some state changes
    stream.messages.value = [
      { agent: 'clive' as const, agent_display_name: 'Clive', content: 'test', reacting_to: null },
    ];
    stream.metadata.value = { band_name: 'X', genre: 'Rock', pitch: 'test', influences: [] };
    stream.isStreaming.value = true;
    stream.isDone.value = true;
    stream.error.value = 'some error';

    stream.reset();

    expect(stream.messages.value).toEqual([]);
    expect(stream.metadata.value).toBeNull();
    expect(stream.isStreaming.value).toBe(false);
    expect(stream.isDone.value).toBe(false);
    expect(stream.error.value).toBeNull();
  });

  it('cancel() does not throw when no stream is active', () => {
    const { cancel } = useSSEStream();
    expect(() => cancel()).not.toThrow();
  });

  it('cancel() can be called multiple times safely', () => {
    const { cancel } = useSSEStream();
    expect(() => {
      cancel();
      cancel();
      cancel();
    }).not.toThrow();
  });

  it('connect() sets error on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const stream = useSSEStream();
    await stream.connect('/api/generate', { name: 'test' });

    expect(stream.error.value).toBe('HTTP 500');
    expect(stream.isStreaming.value).toBe(false);
  });

  it('connect() sets error when response has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    }));

    const stream = useSSEStream();
    await stream.connect('/api/generate', { name: 'test' });

    expect(stream.error.value).toBe('Response has no body');
    expect(stream.isStreaming.value).toBe(false);
  });

  it('connect() parses streamed SSE message events into messages', async () => {
    const ssePayload =
      'event: message\ndata: {"agent":"clive","agent_display_name":"Clive","content":"hello","reacting_to":null}\n\n' +
      'event: done\ndata: {}\n\n';

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(ssePayload) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    }));

    const stream = useSSEStream();
    await stream.connect('/api/test', {});

    expect(stream.messages.value).toHaveLength(1);
    expect(stream.messages.value[0].agent).toBe('clive');
    expect(stream.messages.value[0].content).toBe('hello');
    expect(stream.isDone.value).toBe(true);
    expect(stream.isStreaming.value).toBe(false);
  });

  it('connect() parses metadata events', async () => {
    const ssePayload =
      'event: metadata\ndata: {"band_name":"The Grudges","genre":"Post-Punk","pitch":"angst","influences":["Joy Division"]}\n\n';

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(ssePayload) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    }));

    const stream = useSSEStream();
    await stream.connect('/api/test', {});

    expect(stream.metadata.value).not.toBeNull();
    expect(stream.metadata.value!.band_name).toBe('The Grudges');
    expect(stream.metadata.value!.genre).toBe('Post-Punk');
    expect(stream.metadata.value!.influences).toContain('Joy Division');
  });

  it('connect() handles error events from the server', async () => {
    const ssePayload = 'event: error\ndata: {"message":"Agent timeout"}\n\n';

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(ssePayload) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    }));

    const stream = useSSEStream();
    await stream.connect('/api/test', {});

    expect(stream.error.value).toBe('Agent timeout');
  });

  it('connect() handles chunked delivery across multiple reads', async () => {
    // Split SSE data across two reads so parseSSEBuffer must reassemble
    const chunk1 = 'event: message\ndata: {"agent":"clive","agent_display_name":"Clive",';
    const chunk2 = '"content":"split","reacting_to":null}\n\n';

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(chunk1) });
        }
        if (readCount === 1) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(chunk2) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    }));

    const stream = useSSEStream();
    await stream.connect('/api/test', {});

    expect(stream.messages.value).toHaveLength(1);
    expect(stream.messages.value[0].content).toBe('split');
  });

  it('connect() skips malformed JSON events without crashing', async () => {
    const ssePayload =
      'event: message\ndata: NOT_VALID_JSON\n\n' +
      'event: message\ndata: {"agent":"clive","agent_display_name":"Clive","content":"ok","reacting_to":null}\n\n';

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(ssePayload) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    }));

    const stream = useSSEStream();
    await stream.connect('/api/test', {});

    // The malformed event should be skipped, the valid one processed
    expect(stream.messages.value).toHaveLength(1);
    expect(stream.messages.value[0].content).toBe('ok');
  });

  it('connect() sets generic error for non-Error thrown objects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string-error'));

    const stream = useSSEStream();
    await stream.connect('/api/test', {});

    expect(stream.error.value).toBe('Connection failed');
    expect(stream.isStreaming.value).toBe(false);
  });
});
