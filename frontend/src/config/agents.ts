import type { AgentId, Pronouns } from '../types'

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
    avatarUrl: '/manager.jpg',
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
    avatarUrl: '/margeaux.jpg',
  },
  ex_member: {
    id: 'ex_member',
    displayName: 'Ex-Member',
    initials: 'XM',
    role: 'Former Bassist',
    color: '#ef4444',
    colorRgb: '239, 68, 68',
    avatarUrl: '/old-band-member.jpg',
  },
}

export function setFrontpersonAvatar(pronouns: Pronouns): void {
  const map: Record<Pronouns, string> = {
    he: '/band_male.jpg',
    she: '/band_female.jpg',
    they: Math.random() < 0.5 ? '/band_male.jpg' : '/band_female.jpg',
  }
  AGENT_CONFIG.frontperson.avatarUrl = map[pronouns]
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
