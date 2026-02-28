import json
import os
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models.bedrock import BedrockModel

app = BedrockAgentCoreApp()

MODEL_ID = os.environ.get("MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

@app.entrypoint
def invoke(payload):
    system_prompt = payload.get("system_prompt", "You are a helpful assistant.")
    messages = payload.get("messages", [])
    instruction = payload.get("instruction", "")

    model = BedrockModel(
        model_id=MODEL_ID,
        region_name=REGION,
        temperature=0.9,
        max_tokens=200,
    )

    agent = Agent(
        model=model,
        system_prompt=system_prompt,
    )

    # Build conversation context from prior messages
    context_text = ""
    if messages:
        context_text = "Previous conversation:\n"
        for msg in messages:
            name = msg.get("agent_display_name", "Unknown")
            content = msg.get("content", "")
            context_text += f"{name}: {content}\n"
        context_text += "\n"

    full_prompt = context_text + instruction
    result = agent(full_prompt)

    return {
        "content": str(result.message),
    }

if __name__ == "__main__":
    app.run()
