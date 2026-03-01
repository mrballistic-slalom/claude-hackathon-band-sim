import { describe, it, expect } from 'vitest';
import { getAgentConfig, AGENT_CONFIG } from '../config/agents';
import type { AgentId } from '../types';

describe('smoke test', () => {
  it('getAgentConfig returns correct config for known agents', () => {
    const clive = getAgentConfig('clive');
    expect(clive.id).toBe('clive');
    expect(clive.displayName).toBe('Clive');
    expect(clive.color).toBe('#4682b4');
    expect(clive.role).toBe('A&R Executive');
  });

  it('getAgentConfig returns fallback config for unknown agents', () => {
    const unknown = getAgentConfig('nobody');
    expect(unknown.displayName).toBe('nobody');
    expect(unknown.initials).toBe('NO');
    expect(unknown.color).toBe('#888888');
  });

  it('AGENT_CONFIG contains all four agents', () => {
    const expectedAgents: AgentId[] = ['clive', 'frontperson', 'journalist', 'ex_member'];
    for (const agentId of expectedAgents) {
      expect(AGENT_CONFIG[agentId]).toBeDefined();
      expect(AGENT_CONFIG[agentId].id).toBe(agentId);
    }
  });
});
