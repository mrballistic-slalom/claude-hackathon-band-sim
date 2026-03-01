import { describe, it, expect } from 'vitest';
import {
  getCliveSystemPrompt,
  getFrontpersonSystemPrompt,
  getMargauxSystemPrompt,
  getExMemberSystemPrompt,
  getDramaModifier,
  getAgentDisplayName,
  AGENT_DISPLAY_NAMES,
} from '../prompts';

describe('getCliveSystemPrompt', () => {
  it('returns a string containing "Clive" and "A&R"', () => {
    const prompt = getCliveSystemPrompt();
    expect(prompt).toContain('Clive');
    expect(prompt).toContain('A&R');
  });

  it('includes corporate jargon keywords', () => {
    const prompt = getCliveSystemPrompt();
    expect(prompt).toContain('brand');
    expect(prompt).toContain('Q3 streaming targets');
  });
});

describe('getFrontpersonSystemPrompt', () => {
  it('substitutes name, traits, and pettyLevel into the prompt', () => {
    const prompt = getFrontpersonSystemPrompt('Greg', ['loud', 'late', 'rude'], 7);
    expect(prompt).toContain('"""Greg"""');
    expect(prompt).toContain('loud');
    expect(prompt).toContain('late');
    expect(prompt).toContain('rude');
    expect(prompt).toContain('7/10');
  });

  it('works with different names and levels', () => {
    const prompt = getFrontpersonSystemPrompt('Zara', ['shy', 'anxious', 'dramatic'], 3);
    expect(prompt).toContain('"""Zara"""');
    expect(prompt).toContain('shy');
    expect(prompt).toContain('3/10');
  });
});

describe('getMargauxSystemPrompt', () => {
  it('returns a string containing "Margaux" and "Dissolve"', () => {
    const prompt = getMargauxSystemPrompt();
    expect(prompt).toContain('Margaux');
    expect(prompt).toContain('Dissolve');
  });

  it('mentions scoring and reviews', () => {
    const prompt = getMargauxSystemPrompt();
    expect(prompt).toContain('decimal score');
    expect(prompt).toContain('Best New');
  });
});

describe('getExMemberSystemPrompt', () => {
  it('replaces the frontperson name in triple-quote delimiters', () => {
    const prompt = getExMemberSystemPrompt('Greg');
    expect(prompt).toContain('"""Greg"""');
    expect(prompt).toContain('Direct quote from [their name]');
  });

  it('works with a different name', () => {
    const prompt = getExMemberSystemPrompt('Zara');
    expect(prompt).toContain('Zara');
    expect(prompt).not.toContain('Greg');
  });

  it('mentions Parking Lot Requiem', () => {
    const prompt = getExMemberSystemPrompt('Anyone');
    expect(prompt).toContain('Parking Lot Requiem');
  });
});

describe('getDramaModifier', () => {
  it('returns empty string for level 0', () => {
    expect(getDramaModifier(0)).toBe('');
  });

  it('returns empty string for level 1', () => {
    expect(getDramaModifier(1)).toBe('');
  });

  it('returns unique text for level 3', () => {
    const result = getDramaModifier(3);
    expect(result).toContain('public incident');
  });

  it('returns unique text for level 5', () => {
    const result = getDramaModifier(5);
    expect(result).toContain('documentary-worthy meltdown');
  });

  it('returns catastrophe text for level 6', () => {
    const result = getDramaModifier(6);
    expect(result).toContain('Lawsuits');
    expect(result).toContain('NPR Tiny Desk');
  });

  it('returns same catastrophe text for level 10', () => {
    const result = getDramaModifier(10);
    expect(result).toContain('Lawsuits');
    expect(result).toBe(getDramaModifier(6));
  });

  it('returns different text for each level 2-5', () => {
    const results = [2, 3, 4, 5].map(getDramaModifier);
    const unique = new Set(results);
    expect(unique.size).toBe(4);
  });
});

describe('getAgentDisplayName', () => {
  it('returns "Clive" for clive', () => {
    expect(getAgentDisplayName('clive')).toBe('Clive');
  });

  it('returns "The Frontperson" when no custom name provided', () => {
    expect(getAgentDisplayName('frontperson')).toBe('The Frontperson');
  });

  it('returns custom name for frontperson when provided', () => {
    expect(getAgentDisplayName('frontperson', 'Greg')).toBe('Greg');
  });

  it('returns "Margaux" for journalist', () => {
    expect(getAgentDisplayName('journalist')).toBe('Margaux');
  });

  it('returns "The Ex-Member" for ex_member', () => {
    expect(getAgentDisplayName('ex_member')).toBe('The Ex-Member');
  });

  it('ignores frontpersonName for non-frontperson agents', () => {
    expect(getAgentDisplayName('clive', 'Greg')).toBe('Clive');
    expect(getAgentDisplayName('journalist', 'Greg')).toBe('Margaux');
  });
});

describe('AGENT_DISPLAY_NAMES', () => {
  it('has entries for all four agents', () => {
    expect(Object.keys(AGENT_DISPLAY_NAMES)).toHaveLength(4);
    expect(AGENT_DISPLAY_NAMES).toHaveProperty('clive');
    expect(AGENT_DISPLAY_NAMES).toHaveProperty('frontperson');
    expect(AGENT_DISPLAY_NAMES).toHaveProperty('journalist');
    expect(AGENT_DISPLAY_NAMES).toHaveProperty('ex_member');
  });
});
