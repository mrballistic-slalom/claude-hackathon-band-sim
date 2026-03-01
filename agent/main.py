import json
import os
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models.bedrock import BedrockModel

app = BedrockAgentCoreApp()

MODEL_ID = os.environ.get("MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

MAX_SYSTEM_PROMPT_LEN = 10000
MAX_INSTRUCTION_LEN = 2000
MAX_MESSAGES = 20
MAX_MESSAGE_CONTENT_LEN = 2000
MAX_DISPLAY_NAME_LEN = 100
VALID_AGENTS = {"clive", "frontperson", "journalist", "ex_member"}


def validate_payload(payload):
    """Validate incoming payload structure and sizes."""
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a dict")
    system_prompt = payload.get("system_prompt", "")
    if not isinstance(system_prompt, str) or len(system_prompt) > MAX_SYSTEM_PROMPT_LEN:
        raise ValueError(f"system_prompt must be a string with max length {MAX_SYSTEM_PROMPT_LEN}")
    instruction = payload.get("instruction", "")
    if not isinstance(instruction, str) or len(instruction) > MAX_INSTRUCTION_LEN:
        raise ValueError(f"instruction must be a string with max length {MAX_INSTRUCTION_LEN}")
    messages = payload.get("messages", [])
    if not isinstance(messages, list) or len(messages) > MAX_MESSAGES:
        raise ValueError(f"messages must be a list with max {MAX_MESSAGES} items")
    for msg in messages:
        if not isinstance(msg, dict):
            raise ValueError("Each message must be a dict")
        agent_id = msg.get("agent", "")
        if agent_id not in VALID_AGENTS:
            raise ValueError(f"Invalid agent: {agent_id}")
        content = msg.get("content", "")
        if not isinstance(content, str) or len(content) > MAX_MESSAGE_CONTENT_LEN:
            raise ValueError(f"Message content must be a string with max length {MAX_MESSAGE_CONTENT_LEN}")
        name = msg.get("agent_display_name", "")
        if not isinstance(name, str) or len(name) > MAX_DISPLAY_NAME_LEN:
            raise ValueError(f"agent_display_name must be a string with max length {MAX_DISPLAY_NAME_LEN}")


@app.entrypoint
def invoke(payload):
    validate_payload(payload)

    system_prompt = payload.get("system_prompt", "You are a helpful assistant.")
    messages = payload.get("messages", [])
    instruction = payload.get("instruction", "")

    model = BedrockModel(
        model_id=MODEL_ID,
        region_name=REGION,
        temperature=0.9,
        max_tokens=400,
    )

    agent = Agent(
        model=model,
        system_prompt=system_prompt,
    )

    # Build conversation context from prior messages (capped to last 20)
    context_text = ""
    recent = messages[-MAX_MESSAGES:]
    if recent:
        context_text = "Previous conversation:\n"
        for msg in recent:
            name = msg.get("agent_display_name", "Unknown")[:MAX_DISPLAY_NAME_LEN]
            content = msg.get("content", "")[:MAX_MESSAGE_CONTENT_LEN]
            context_text += f"{name}: {content}\n"
        context_text += "\n"

    full_prompt = context_text + instruction
    result = agent(full_prompt)

    return {
        "content": str(result.message),
    }

if __name__ == "__main__":
    app.run()
