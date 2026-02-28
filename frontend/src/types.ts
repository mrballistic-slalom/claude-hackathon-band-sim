export type AgentId = 'clive' | 'frontperson' | 'journalist' | 'ex_member';

export interface AgentMessage {
  agent: AgentId;
  agent_display_name: string;
  content: string;
  reacting_to: { agent: string; excerpt: string } | null;
}

export interface BandMetadata {
  band_name: string;
  genre: string;
  pitch: string;
  influences: string[];
}

export interface GenerateRequest {
  name: string;
  traits: [string, string, string];
  petty_level: number;
}

export interface EscalateRequest {
  session_id: string;
  history: AgentMessage[];
  drama_level: number;
  band_metadata: BandMetadata;
}

/** Agent color mapping for UI */
export const AGENT_COLORS: Record<AgentId, string> = {
  clive: '#4682b4',
  frontperson: '#8b5cf6',
  journalist: '#f59e0b',
  ex_member: '#ef4444',
};
