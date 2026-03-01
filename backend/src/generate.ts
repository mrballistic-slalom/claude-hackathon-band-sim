import { GenerateRequest, AgentMessage, BandMetadata, AgentId } from './types';
import { callAgent } from './agents';
import {
  getCliveSystemPrompt,
  getFrontpersonSystemPrompt,
  getMargauxSystemPrompt,
  getExMemberSystemPrompt,
  getAgentDisplayName,
} from './prompts';

function extractBandMetadata(cliveResponse: string, inputName: string): BandMetadata {
  const bandNameMatch = cliveResponse.match(/BAND NAME:\s*(.+)/i);
  const genreMatch = cliveResponse.match(/GENRE:\s*(.+)/i);
  const pitchMatch = cliveResponse.match(/PITCH:\s*(.+)/i);
  const influencesMatch = cliveResponse.match(/INFLUENCES:\s*(.+)/i);

  return {
    band_name: bandNameMatch?.[1]?.trim() || `The ${inputName} Experience`,
    genre: genreMatch?.[1]?.trim() || 'Post-everything',
    pitch: pitchMatch?.[1]?.trim() || 'A band that defies categorization, mostly by accident.',
    influences: influencesMatch?.[1]?.split(',').map(s => s.trim()) || ['Radiohead', 'A sense of impending dread'],
  };
}

export async function handleGenerate(
  input: GenerateRequest,
  writeSSE: (eventType: string, data: any) => void
): Promise<void> {
  const messages: AgentMessage[] = [];
  let anySuccess = false;

  // 1. Call Clive
  const cliveSystemPrompt = getCliveSystemPrompt();
  const cliveInstruction = `You've just discovered a new artist named ${input.name}. Their defining traits are: ${input.traits.join(', ')}. Pitch the band concept to the group. You MUST include in your response: the band name (format: BAND NAME: <name>), a genre (format: GENRE: <genre>), a one-line pitch (format: PITCH: <pitch>), and 2-3 influences (format: INFLUENCES: <comma separated list>). After these details, give your A&R executive take on the commercial potential.`;

  const cliveResponse = await callAgent(cliveSystemPrompt, messages, cliveInstruction);

  if (cliveResponse) {
    anySuccess = true;

    // 3. Parse band_metadata from Clive's response
    const metadata = extractBandMetadata(cliveResponse, input.name);

    // 4. Write metadata SSE event
    writeSSE('metadata', metadata);

    // 5. Write Clive's message SSE event
    const cliveMessage: AgentMessage = {
      agent: 'clive' as AgentId,
      agent_display_name: getAgentDisplayName('clive'),
      content: cliveResponse,
      reacting_to: null,
    };
    messages.push(cliveMessage);
    writeSSE('message', cliveMessage);
  }

  // 6. Call Frontperson with Clive's message as context
  const frontpersonSystemPrompt = getFrontpersonSystemPrompt(input.name, input.traits, input.petty_level);
  const frontpersonInstruction = "Your A&R executive Clive just pitched a vision for your band. React to his pitch.";

  const frontpersonResponse = await callAgent(frontpersonSystemPrompt, messages, frontpersonInstruction);

  if (frontpersonResponse) {
    anySuccess = true;

    // 7. Write Frontperson's message SSE event
    const frontpersonMessage: AgentMessage = {
      agent: 'frontperson' as AgentId,
      agent_display_name: getAgentDisplayName('frontperson', input.name),
      content: frontpersonResponse,
      reacting_to: null,
    };
    messages.push(frontpersonMessage);
    writeSSE('message', frontpersonMessage);
  }

  // 8. Call Margaux with both prior messages
  const margauxSystemPrompt = getMargauxSystemPrompt();
  const margauxInstruction = "You've just witnessed a band's formation and their first creative disagreement. Review what you've seen so far. Score it.";

  const margauxResponse = await callAgent(margauxSystemPrompt, messages, margauxInstruction);

  if (margauxResponse) {
    anySuccess = true;

    // 9. Write Margaux's message SSE event
    const margauxMessage: AgentMessage = {
      agent: 'journalist' as AgentId,
      agent_display_name: getAgentDisplayName('journalist'),
      content: margauxResponse,
      reacting_to: null,
    };
    messages.push(margauxMessage);
    writeSSE('message', margauxMessage);
  }

  // 10. Call Ex-Member with all 3 prior messages
  const exMemberSystemPrompt = getExMemberSystemPrompt(input.name);
  const exMemberInstruction = "The band is forming without you. You've been watching from the sidelines. Drop your first leak about what really happened.";

  const exMemberResponse = await callAgent(exMemberSystemPrompt, messages, exMemberInstruction);

  if (exMemberResponse) {
    anySuccess = true;

    // 11. Write Ex-Member's message SSE event
    const exMemberMessage: AgentMessage = {
      agent: 'ex_member' as AgentId,
      agent_display_name: getAgentDisplayName('ex_member'),
      content: exMemberResponse,
      reacting_to: null,
    };
    messages.push(exMemberMessage);
    writeSSE('message', exMemberMessage);
  }

  // If ALL 4 agents failed, write a fallback message
  if (!anySuccess) {
    writeSSE('message', {
      agent: 'clive',
      agent_display_name: 'Clive',
      content: "The band's Wi-Fi went down during a heated argument about whether Wi-Fi is 'authentic.'",
      reacting_to: null,
    });
  }

  // 12. Always write done event at the end
  writeSSE('done', {});
}
