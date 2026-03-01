/** Unique identifier for each agent in the band simulation. */
export type AgentId = 'clive' | 'frontperson' | 'journalist' | 'ex_member';

/** A single message produced by an agent during the simulation. */
export interface AgentMessage {
  /** Which agent authored this message. */
  agent: AgentId;
  /** Human-readable display name of the agent. */
  agent_display_name: string;
  /** The text content of the message. */
  content: string;
  /** The prior message this is reacting to, or null if unprompted. */
  reacting_to: { agent: string; excerpt: string } | null;
}

/** Metadata describing the generated band. */
export interface BandMetadata {
  /** The band's name. */
  band_name: string;
  /** Primary genre of the band. */
  genre: string;
  /** One-line elevator pitch for the band. */
  pitch: string;
  /** List of musical influences. */
  influences: string[];
}

/** Request payload for the /api/generate endpoint. */
export interface GenerateRequest {
  /** The frontperson's name. */
  name: string;
  /** Exactly three personality traits for the frontperson. */
  traits: [string, string, string];
  /** Pettiness level from 1-10. */
  petty_level: number;
}

/** Request payload for the /api/escalate endpoint. */
export interface EscalateRequest {
  /** Unique session identifier. */
  session_id: string;
  /** Conversation history so far. */
  history: AgentMessage[];
  /** Current drama escalation level (1-10). */
  drama_level: number;
  /** Metadata about the generated band. */
  band_metadata: BandMetadata;
  /** The frontperson's personality traits from the original input. */
  traits?: string[] | string;
  /** Pettiness level from the original input (1-10). */
  petty_level?: number;
}
