import { describe, it, expect } from 'vitest';
import { parseSSEBuffer } from '../composables/useSSEStream';

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
});
