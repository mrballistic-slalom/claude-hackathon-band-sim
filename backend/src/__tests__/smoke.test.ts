import { describe, it, expect } from 'vitest';
import {
  getCliveSystemPrompt,
  getFrontpersonSystemPrompt,
  getMargauxSystemPrompt,
  getExMemberSystemPrompt,
  getDramaModifier,
  getAgentDisplayName,
} from '../prompts';
import {
  validateGenerateRequest,
  validateEscalateRequest,
} from '../validation';

describe('prompt generation', () => {
  it('getCliveSystemPrompt returns a non-empty string', () => {
    const prompt = getCliveSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('Clive');
  });

  it('getFrontpersonSystemPrompt includes name, traits, and petty level', () => {
    const prompt = getFrontpersonSystemPrompt('Greg', ['loud', 'late', 'rude'], 7);
    expect(prompt).toContain('Greg');
    expect(prompt).toContain('loud');
    expect(prompt).toContain('late');
    expect(prompt).toContain('rude');
    expect(prompt).toContain('7/10');
  });

  it('getMargauxSystemPrompt returns a non-empty string mentioning Margaux', () => {
    const prompt = getMargauxSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Margaux');
  });

  it('getExMemberSystemPrompt includes the frontperson name', () => {
    const prompt = getExMemberSystemPrompt('Greg');
    expect(prompt).toContain('Greg');
    expect(prompt).toContain('Parking Lot Requiem');
  });
});

describe('getDramaModifier', () => {
  it('returns empty string for level 1', () => {
    expect(getDramaModifier(1)).toBe('');
  });

  it('returns empty string for level 0', () => {
    expect(getDramaModifier(0)).toBe('');
  });

  it('returns a non-empty modifier for levels 2-5', () => {
    for (let level = 2; level <= 5; level++) {
      const modifier = getDramaModifier(level);
      expect(modifier.length).toBeGreaterThan(0);
    }
  });

  it('returns catastrophe text for level 6+', () => {
    const modifier = getDramaModifier(6);
    expect(modifier).toContain('catastrophe');
    expect(getDramaModifier(10)).toContain('catastrophe');
  });
});

describe('getAgentDisplayName', () => {
  it('returns "Clive" for clive', () => {
    expect(getAgentDisplayName('clive')).toBe('Clive');
  });

  it('returns custom name for frontperson when provided', () => {
    expect(getAgentDisplayName('frontperson', 'Greg')).toBe('Greg');
  });

  it('returns default name for frontperson when no custom name', () => {
    expect(getAgentDisplayName('frontperson')).toBe('The Frontperson');
  });

  it('returns "Margaux" for journalist', () => {
    expect(getAgentDisplayName('journalist')).toBe('Margaux');
  });

  it('returns "The Ex-Member" for ex_member', () => {
    expect(getAgentDisplayName('ex_member')).toBe('The Ex-Member');
  });
});

describe('validateGenerateRequest', () => {
  const validBody = {
    name: 'Greg',
    traits: 'loud',
    petty_level: 5,
  };

  it('returns null for a valid request', () => {
    expect(validateGenerateRequest(validBody)).toBeNull();
  });

  it('rejects null body', () => {
    expect(validateGenerateRequest(null)).not.toBeNull();
  });

  it('rejects missing name', () => {
    expect(validateGenerateRequest({ ...validBody, name: undefined })).not.toBeNull();
  });

  it('rejects name exceeding 100 chars', () => {
    expect(validateGenerateRequest({ ...validBody, name: 'a'.repeat(101) })).not.toBeNull();
  });

  it('rejects empty name', () => {
    expect(validateGenerateRequest({ ...validBody, name: '' })).not.toBeNull();
  });

  it('rejects non-string name', () => {
    expect(validateGenerateRequest({ ...validBody, name: 123 })).not.toBeNull();
  });

  it('rejects missing traits', () => {
    expect(validateGenerateRequest({ ...validBody, traits: undefined })).not.toBeNull();
  });

  it('rejects traits exceeding 50 chars', () => {
    expect(validateGenerateRequest({ ...validBody, traits: 'a'.repeat(51) })).not.toBeNull();
  });

  it('rejects empty traits', () => {
    expect(validateGenerateRequest({ ...validBody, traits: '' })).not.toBeNull();
  });

  it('rejects non-string traits', () => {
    expect(validateGenerateRequest({ ...validBody, traits: ['loud'] })).not.toBeNull();
  });

  it('rejects petty_level below 1', () => {
    expect(validateGenerateRequest({ ...validBody, petty_level: 0 })).not.toBeNull();
  });

  it('rejects petty_level above 10', () => {
    expect(validateGenerateRequest({ ...validBody, petty_level: 11 })).not.toBeNull();
  });

  it('rejects non-number petty_level', () => {
    expect(validateGenerateRequest({ ...validBody, petty_level: 'five' })).not.toBeNull();
  });

  it('rejects NaN petty_level', () => {
    expect(validateGenerateRequest({ ...validBody, petty_level: NaN })).not.toBeNull();
  });

  it('rejects Infinity petty_level', () => {
    expect(validateGenerateRequest({ ...validBody, petty_level: Infinity })).not.toBeNull();
  });

  it('allows valid pronouns', () => {
    expect(validateGenerateRequest({ ...validBody, pronouns: 'he/him' })).toBeNull();
    expect(validateGenerateRequest({ ...validBody, pronouns: 'she/her' })).toBeNull();
    expect(validateGenerateRequest({ ...validBody, pronouns: 'they/them' })).toBeNull();
  });

  it('rejects invalid pronouns', () => {
    expect(validateGenerateRequest({ ...validBody, pronouns: 'invalid' })).not.toBeNull();
  });

  it('allows missing pronouns (optional field)', () => {
    expect(validateGenerateRequest(validBody)).toBeNull();
  });
});

describe('validateEscalateRequest', () => {
  const validBody = {
    history: [
      { agent: 'clive', agent_display_name: 'Clive', content: 'Test message' },
    ],
    drama_level: 3,
    session_id: 'test-session-123',
  };

  it('returns null for a valid request', () => {
    expect(validateEscalateRequest(validBody)).toBeNull();
  });

  it('returns null for empty history array', () => {
    expect(validateEscalateRequest({ ...validBody, history: [] })).toBeNull();
  });

  it('rejects null body', () => {
    expect(validateEscalateRequest(null)).not.toBeNull();
  });

  it('rejects missing history', () => {
    expect(validateEscalateRequest({ drama_level: 3, session_id: 'x' })).not.toBeNull();
  });

  it('rejects non-array history', () => {
    expect(validateEscalateRequest({ ...validBody, history: 'not-an-array' })).not.toBeNull();
  });

  it('rejects history exceeding 200 items', () => {
    const bigHistory = Array.from({ length: 201 }, () => ({
      agent: 'clive', agent_display_name: 'Clive', content: 'msg',
    }));
    expect(validateEscalateRequest({ ...validBody, history: bigHistory })).not.toBeNull();
  });

  it('rejects history item with invalid agent', () => {
    expect(validateEscalateRequest({
      ...validBody,
      history: [{ agent: 'hacker', agent_display_name: 'X', content: 'hi' }],
    })).not.toBeNull();
  });

  it('rejects history item with content exceeding 2000 chars', () => {
    expect(validateEscalateRequest({
      ...validBody,
      history: [{ agent: 'clive', agent_display_name: 'Clive', content: 'a'.repeat(2001) }],
    })).not.toBeNull();
  });

  it('rejects missing drama_level', () => {
    expect(validateEscalateRequest({ history: [], session_id: 'x' })).not.toBeNull();
  });

  it('rejects non-number drama_level', () => {
    expect(validateEscalateRequest({ ...validBody, drama_level: 'high' })).not.toBeNull();
  });

  it('rejects NaN drama_level', () => {
    expect(validateEscalateRequest({ ...validBody, drama_level: NaN })).not.toBeNull();
  });

  it('rejects drama_level below 1', () => {
    expect(validateEscalateRequest({ ...validBody, drama_level: 0 })).not.toBeNull();
  });

  it('rejects drama_level above 100', () => {
    expect(validateEscalateRequest({ ...validBody, drama_level: 101 })).not.toBeNull();
  });

  it('rejects missing session_id', () => {
    expect(validateEscalateRequest({ history: [], drama_level: 3 })).not.toBeNull();
  });

  it('rejects session_id exceeding 100 chars', () => {
    expect(validateEscalateRequest({ ...validBody, session_id: 'a'.repeat(101) })).not.toBeNull();
  });

  it('validates band_metadata structure when present', () => {
    expect(validateEscalateRequest({
      ...validBody,
      band_metadata: { band_name: 'Test', genre: 'Rock', pitch: 'A band' },
    })).toBeNull();
  });

  it('rejects invalid band_metadata', () => {
    expect(validateEscalateRequest({
      ...validBody,
      band_metadata: { band_name: 123 },
    })).not.toBeNull();
  });

  it('rejects agent_display_name exceeding 100 chars', () => {
    expect(validateEscalateRequest({
      ...validBody,
      history: [{ agent: 'clive', agent_display_name: 'a'.repeat(101), content: 'hi' }],
    })).not.toBeNull();
  });

  it('rejects session_id with special characters', () => {
    expect(validateEscalateRequest({ ...validBody, session_id: 'test<script>' })).not.toBeNull();
  });

  it('accepts session_id with hyphens and underscores', () => {
    expect(validateEscalateRequest({ ...validBody, session_id: 'test-session_123' })).toBeNull();
  });

  it('rejects reacting_to with oversized excerpt', () => {
    expect(validateEscalateRequest({
      ...validBody,
      history: [{
        agent: 'clive', agent_display_name: 'Clive', content: 'hi',
        reacting_to: { agent: 'frontperson', excerpt: 'a'.repeat(201) },
      }],
    })).not.toBeNull();
  });

  it('accepts valid reacting_to in history', () => {
    expect(validateEscalateRequest({
      ...validBody,
      history: [{
        agent: 'clive', agent_display_name: 'Clive', content: 'hi',
        reacting_to: { agent: 'frontperson', excerpt: 'some quote' },
      }],
    })).toBeNull();
  });

  it('rejects band_metadata.band_name exceeding 200 chars', () => {
    expect(validateEscalateRequest({
      ...validBody,
      band_metadata: { band_name: 'a'.repeat(201), genre: 'Rock', pitch: 'A band' },
    })).not.toBeNull();
  });
});
