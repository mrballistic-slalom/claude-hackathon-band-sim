import type { AgentId } from '../types'

export interface AgentConfig {
  id: AgentId
  displayName: string
  initials: string
  role: string
  color: string
  colorRgb: string
  avatarUrl: string | null
}

export const AGENT_CONFIG: Record<AgentId, AgentConfig> = {
  clive: {
    id: 'clive',
    displayName: 'Clive',
    initials: 'CL',
    role: 'A&R Executive',
    color: '#4682b4',
    colorRgb: '70, 130, 180',
    avatarUrl: null,
  },
  frontperson: {
    id: 'frontperson',
    displayName: 'Frontperson',
    initials: 'FP',
    role: 'Lead Vocalist',
    color: '#8b5cf6',
    colorRgb: '139, 92, 246',
    avatarUrl: null,
  },
  journalist: {
    id: 'journalist',
    displayName: 'Margaux',
    initials: 'MX',
    role: 'Music Journalist',
    color: '#f59e0b',
    colorRgb: '245, 158, 11',
    avatarUrl: null,
  },
  ex_member: {
    id: 'ex_member',
    displayName: 'Ex-Member',
    initials: 'XM',
    role: 'Former Bassist',
    color: '#ef4444',
    colorRgb: '239, 68, 68',
    avatarUrl: null,
  },
}

export function getAgentConfig(agent: string): AgentConfig {
  return AGENT_CONFIG[agent as AgentId] ?? {
    id: agent as AgentId,
    displayName: agent,
    initials: agent.slice(0, 2).toUpperCase(),
    role: 'Unknown',
    color: '#888888',
    colorRgb: '136, 136, 136',
    avatarUrl: null,
  }
}
