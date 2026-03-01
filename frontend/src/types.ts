/** Unique identifier for each agent role in the drama simulation. */
export type AgentId = 'clive' | 'frontperson' | 'journalist' | 'ex_member';

/** A single chat message produced by an agent during a drama round. */
export interface AgentMessage {
  /** Which agent sent this message. */
  agent: AgentId;
  /** Human-readable display name for the agent. */
  agent_display_name: string;
  /** The text body of the message. */
  content: string;
  /** Optional reference to a previous message this is reacting to. */
  reacting_to: { agent: string; excerpt: string } | null;
}

/** Metadata describing the fictitious band created for the session. */
export interface BandMetadata {
  /** The generated band name. */
  band_name: string;
  /** Musical genre of the band. */
  genre: string;
  /** One-line elevator pitch for the band. */
  pitch: string;
  /** List of musical influences. */
  influences: string[];
}

/** Pronoun choice for the frontperson. */
export type Pronouns = 'he' | 'she' | 'they';

/** Payload sent to the /generate endpoint to kick off a new drama session. */
export interface GenerateRequest {
  /** Name of the nemesis / frontperson. */
  name: string;
  /** Three personality traits describing the nemesis. */
  traits: [string, string, string];
  /** How petty the drama should be, 1-10. */
  petty_level: number;
  /** Pronoun choice (client-side only, used for avatar). */
  pronouns: Pronouns;
}

/** Payload sent to the /escalate endpoint to ramp up the drama. */
export interface EscalateRequest {
  /** Unique session identifier. */
  session_id: string;
  /** Full conversation history so far. */
  history: AgentMessage[];
  /** Current drama escalation level. */
  drama_level: number;
  /** Band metadata from the initial generation. */
  band_metadata: BandMetadata;
  /** The frontperson's personality traits from the original input. */
  traits?: [string, string, string];
  /** Pettiness level from the original input (1-10). */
  petty_level?: number;
}

