import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { AgentMessage } from './types';

/** Bedrock runtime client, configured from AWS_REGION env var (defaults to us-east-1). */
const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/** Model ID for the Claude model to invoke, configurable via MODEL_ID env var. */
const MODEL_ID = process.env.MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';

/**
 * Invokes a Claude model via AWS Bedrock to generate a response for one agent.
 * Formats conversation history as context, appends the current instruction,
 * and returns the model's text response.
 * @param systemPrompt - The agent's system prompt defining its persona.
 * @param messages - Prior conversation messages for context.
 * @param instruction - The current turn instruction for the agent.
 * @returns The generated text content, or null if the call fails.
 */
export async function callAgent(
  systemPrompt: string,
  messages: AgentMessage[],
  instruction: string
): Promise<string | null> {
  try {
    // Build conversation context
    const conversationMessages: Array<{role: string; content: string}> = [];

    if (messages.length > 0) {
      // Combine all prior messages into a single user context message
      const contextText = messages
        .map(m => `${m.agent_display_name}: ${m.content}`)
        .join('\n');
      conversationMessages.push({
        role: 'user',
        content: `Previous conversation:\n${contextText}`,
      });
      conversationMessages.push({
        role: 'assistant',
        content: 'I understand the conversation context. What would you like me to respond to?',
      });
    }

    // Add the current instruction
    conversationMessages.push({
      role: 'user',
      content: instruction,
    });

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 200,
      temperature: 0.9,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    });

    const response = await client.send(command, { abortSignal: controller.signal });
    clearTimeout(timeout);

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content[0]?.text || null;
  } catch (err: any) {
    console.error(`Agent call failed: ${err.message}`);
    return null;
  }
}
