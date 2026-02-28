import { EscalateRequest, AgentMessage, AgentId } from './types';
import { callAgent } from './agents';
import {
  getCliveSystemPrompt,
  getFrontpersonSystemPrompt,
  getMargauxSystemPrompt,
  getExMemberSystemPrompt,
  getDramaModifier,
  getAgentDisplayName,
} from './prompts';

/** All available agents that can be selected for an escalation round. */
const AGENT_LIST: AgentId[] = ['clive', 'frontperson', 'journalist', 'ex_member'];

/**
 * Fisher-Yates shuffle — returns a new shuffled copy of the array.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Returns the system prompt for a given agent.
 * For the frontperson, uses provided name, traits, and petty level.
 */
function getSystemPromptForAgent(
  agentId: AgentId,
  frontpersonName: string,
  traits: string[],
  pettyLevel: number
): string {
  switch (agentId) {
    case 'clive':
      return getCliveSystemPrompt();
    case 'frontperson':
      return getFrontpersonSystemPrompt(frontpersonName, traits, pettyLevel);
    case 'journalist':
      return getMargauxSystemPrompt();
    case 'ex_member':
      return getExMemberSystemPrompt(frontpersonName);
  }
}

/**
 * Extracts the frontperson's display name from conversation history.
 * Falls back to "The Frontperson" if no frontperson message is found.
 */
function extractFrontpersonName(history: AgentMessage[]): string {
  const frontpersonMsg = history.find((m) => m.agent === 'frontperson');
  if (frontpersonMsg && frontpersonMsg.agent_display_name) {
    return frontpersonMsg.agent_display_name;
  }
  return 'The Frontperson';
}

/**
 * Handles the /api/escalate endpoint.
 *
 * Randomly selects 2-3 agents, has each react to a random message from
 * another agent in the conversation history, and streams responses as SSE.
 */
export async function handleEscalate(
  input: EscalateRequest,
  writeSSE: (eventType: string, data: any) => void
): Promise<void> {
  // 1. Randomly select 2-3 agents
  const count = Math.random() < 0.5 ? 2 : 3;
  const selectedAgents = shuffleArray(AGENT_LIST).slice(0, count);

  // 2. Get drama modifier
  const dramaModifier = getDramaModifier(input.drama_level);

  // 3. Extract frontperson name from history
  const frontpersonName = extractFrontpersonName(input.history);

  // Default traits and petty level for escalation rounds — the conversation
  // history already carries the agent's personality, so these are fallbacks.
  const defaultTraits = ['passionate', 'misunderstood', 'visionary'];
  const defaultPettyLevel = 5;

  // Track this round's new messages
  const roundMessages: AgentMessage[] = [];
  let anySuccess = false;

  // 4. Process each selected agent sequentially
  for (const agentId of selectedAgents) {
    // a. Filter history for messages NOT from this agent
    const allMessages = [...input.history, ...roundMessages];
    const otherMessages = allMessages.filter((m) => m.agent !== agentId);

    // If no messages from other agents exist, skip this agent
    if (otherMessages.length === 0) {
      continue;
    }

    // b. Pick a random message from the filtered list
    const targetMessage = otherMessages[Math.floor(Math.random() * otherMessages.length)];

    // c. Build instruction
    const instruction = `React specifically to ${targetMessage.agent_display_name}'s statement: '${targetMessage.content}'. ${dramaModifier}`;

    // d. Get the system prompt for this agent
    const systemPrompt = getSystemPromptForAgent(
      agentId,
      frontpersonName,
      defaultTraits,
      defaultPettyLevel
    );

    // e. Call agent with FULL history (original + this round's responses so far)
    const response = await callAgent(systemPrompt, allMessages, instruction);

    // If agent call failed, skip and continue
    if (response === null) {
      continue;
    }

    anySuccess = true;

    // f. Build the response message
    const agentMessage: AgentMessage = {
      agent: agentId,
      agent_display_name: getAgentDisplayName(agentId, frontpersonName),
      content: response,
      reacting_to: {
        agent: targetMessage.agent,
        excerpt: targetMessage.content.substring(0, 100),
      },
    };

    // Write SSE message event
    writeSSE('message', agentMessage);

    // g. Append to round messages for next agent's context
    roundMessages.push(agentMessage);
  }

  // 5. If ALL selected agents failed, write canned fallback message
  if (!anySuccess) {
    writeSSE('message', {
      agent: 'journalist',
      agent_display_name: 'Margaux',
      content:
        "The band's Wi-Fi went down during a heated argument about whether Wi-Fi is 'authentic.' 3.2 — Best New Outage.",
      reacting_to: null,
    });
  }

  // 6. Always write done event
  writeSSE('done', {});
}
