import { EscalateRequest, AgentMessage, AgentId } from './types';
import { callAgent } from './agents';
import {
  getCliveSystemPrompt,
  getFrontpersonSystemPrompt,
  getMargauxSystemPrompt,
  getExMemberSystemPrompt,
  getDramaModifier,
  getAgentDisplayName,
  sanitizeUserInput,
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

  // Use traits from the request, falling back to defaults only if genuinely missing.
  const fallbackTraits = ['passionate', 'misunderstood', 'visionary'];
  let traits: string[];
  if (Array.isArray(input.traits) && input.traits.length > 0) {
    traits = input.traits.map((t) => sanitizeUserInput(String(t), 50));
  } else if (typeof input.traits === 'string' && input.traits.length > 0) {
    traits = [sanitizeUserInput(input.traits, 50)];
  } else {
    traits = fallbackTraits;
  }
  // Ensure we have exactly 3 traits for the prompt template
  while (traits.length < 3) {
    traits.push(fallbackTraits[traits.length] || 'enigmatic');
  }

  const pettyLevel =
    typeof input.petty_level === 'number' && input.petty_level >= 1 && input.petty_level <= 10
      ? input.petty_level
      : 5;

  // Track this round's new messages and which targets have been used this round
  const roundMessages: AgentMessage[] = [];
  const roundTargets: Array<{ agent: string; excerpt: string }> = [];
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

    // b. Pick a random message, avoiding ones this agent already reacted to
    //    AND ones other agents already targeted this round
    const previousReactions = allMessages
      .filter((m) => m.agent === agentId && m.reacting_to)
      .map((m) => m.reacting_to!);
    const allExclusions = [...previousReactions, ...roundTargets];
    const freshMessages = otherMessages.filter((candidate) => {
      const candidateExcerpt = candidate.content.substring(0, 100);
      return !allExclusions.some(
        (r) => r.agent === candidate.agent && r.excerpt === candidateExcerpt
      );
    });
    const pool = freshMessages.length > 0 ? freshMessages : otherMessages;
    const targetMessage = pool[Math.floor(Math.random() * pool.length)];

    // Track this target so other agents in this round pick different messages
    roundTargets.push({ agent: targetMessage.agent, excerpt: targetMessage.content.substring(0, 100) });

    // c. Build instruction (truncate content to prevent prompt stuffing)
    const excerpt = targetMessage.content.substring(0, 200);
    const instruction = `React specifically to ${targetMessage.agent_display_name}'s statement: '${excerpt}'. ${dramaModifier}`;

    // d. Get the system prompt for this agent
    const systemPrompt = getSystemPromptForAgent(
      agentId,
      frontpersonName,
      traits,
      pettyLevel
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
