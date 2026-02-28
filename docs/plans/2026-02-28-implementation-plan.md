# Make My Enemy a Band — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack hackathon app that turns a person into an indie band with 4 AI agents arguing in a group chat, deployed via CDK.

**Architecture:** Vue 3 + Vuetify 3 frontend on S3/CloudFront, Lambda Function URL (SSE streaming) as orchestrator, Python agent container on AgentCore (Strands SDK) calling Bedrock Claude Sonnet. Single CDK stack deploys everything.

**Tech Stack:** Vue 3, Vuetify 3, TypeScript, Vite, AWS CDK, Lambda (Node.js 20), AgentCore, Strands SDK (Python), Bedrock Claude Sonnet

---

## Task 1: Scaffold All Projects

**Files:**
- Create: `frontend/` (via `npm create vuetify`)
- Create: `backend/package.json`, `backend/tsconfig.json`
- Create: `agent/main.py`, `agent/requirements.txt`
- Create: `infra/` (via `cdk init`)

**Step 1: Scaffold frontend with Vuetify**

```bash
cd /Users/todd.greco/current_work/claude-hackathon-band-sim
npm create vuetify@latest frontend -- --typescript --package-manager npm
```

Select: Vite, TypeScript, Vuetify 3

**Step 2: Install frontend dependencies**

```bash
cd frontend
npm install
npm run dev
```

Expected: Vite dev server starts, Vuetify default page at localhost:3000 (or 5173).
Kill the dev server after confirming.

**Step 3: Scaffold backend**

```bash
cd /Users/todd.greco/current_work/claude-hackathon-band-sim
mkdir -p backend/src
```

Create `backend/package.json`:
```json
{
  "name": "band-sim-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "esbuild src/handler.ts --bundle --platform=node --target=node20 --outdir=dist --format=esm --external:@aws-sdk/*",
    "build:cjs": "esbuild src/handler.ts --bundle --platform=node --target=node20 --outdir=dist --format=cjs --out-extension:.js=.cjs --external:@aws-sdk/*"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "dependencies": {
    "@aws-sdk/client-bedrock-agent-core": "^3.800.0"
  }
}
```

Create `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

```bash
cd backend && npm install
```

**Step 4: Scaffold agent container**

```bash
cd /Users/todd.greco/current_work/claude-hackathon-band-sim
mkdir -p agent
```

Create `agent/requirements.txt`:
```
strands-agents
strands-agents-bedrock
bedrock-agentcore
```

Create `agent/main.py` (placeholder — fleshed out in Task 3):
```python
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    return {"result": "placeholder"}

if __name__ == "__main__":
    app.run()
```

**Step 5: Scaffold CDK infra**

```bash
cd /Users/todd.greco/current_work/claude-hackathon-band-sim
mkdir infra && cd infra
npx cdk init app --language=typescript
npm install @aws-cdk/aws-bedrock-agentcore-alpha
```

**Step 6: Commit scaffold**

```bash
cd /Users/todd.greco/current_work/claude-hackathon-band-sim
git add frontend/ backend/ agent/ infra/
git commit -m "feat: scaffold all projects (frontend, backend, agent, infra)"
```

---

## Task 2: System Prompts Module

**Files:**
- Create: `backend/src/prompts.ts`

**Step 1: Write the prompts module**

Create `backend/src/prompts.ts` with all 4 agent system prompts as template functions. The frontperson prompt accepts `name`, `traits`, and `petty_level` as parameters. All other prompts are static.

Include the drama level modifiers as a function that maps drama level (1-6+) to flavor text.

Each prompt template is copied verbatim from the PRD (see `make-my-enemy-a-band-PRD.md` lines 42-111 for the exact text).

Key exports:
- `getCliveSystemPrompt(): string`
- `getFrontpersonSystemPrompt(name: string, traits: string[], pettyLevel: number): string`
- `getMargauxSystemPrompt(): string`
- `getExMemberSystemPrompt(frontpersonName: string): string`
- `getDramaModifier(level: number): string`
- `AGENT_DISPLAY_NAMES: Record<AgentId, string>` — maps agent IDs to display names
- `type AgentId = 'clive' | 'frontperson' | 'journalist' | 'ex_member'`

The frontperson prompt replaces `[NAME]` with the input name, `[TRAIT_1]`, `[TRAIT_2]`, `[TRAIT_3]` with traits, and `[PETTY_LEVEL]` with the number.

The ex-member prompt replaces `[NAME]` with the frontperson's name (so leaked quotes reference the right person).

**Step 2: Commit**

```bash
git add backend/src/prompts.ts
git commit -m "feat: add system prompt templates for all 4 agents"
```

---

## Task 3: Agent Container (Python + Strands SDK)

**Files:**
- Modify: `agent/main.py`

**Step 1: Implement the agent entry point**

The agent container is generic — it accepts `system_prompt` and `messages` in the payload and calls Bedrock Claude Sonnet. This way ONE AgentCore runtime serves all 4 agent personalities.

`agent/main.py`:
```python
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
```

**Step 2: Commit**

```bash
git add agent/
git commit -m "feat: implement generic agent container with Strands SDK"
```

---

## Task 4: CDK Stack

**Files:**
- Modify: `infra/lib/infra-stack.ts` (rename to `band-sim-stack.ts`)
- Modify: `infra/bin/infra.ts`

**Step 1: Implement the CDK stack**

The stack creates:

1. **AgentCore Runtime** using `fromCodeAsset` pointing to `../agent/` directory with Python 3.12 runtime. Environment variable `MODEL_ID` set to Claude Sonnet's Bedrock model ID.

2. **Lambda Function** (Node.js 20) bundled from `../backend/src/handler.ts` using NodejsFunction construct with esbuild. 30s timeout, 256MB memory. Function URL with `RESPONSE_STREAM` invoke mode. Environment variable `AGENT_RUNTIME_ARN` pointing to the AgentCore runtime ARN.

3. **IAM grants:**
   - Lambda role gets `runtime.grantInvokeRuntime(lambdaFunction)` for AgentCore calls
   - AgentCore runtime role gets `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on Claude Sonnet

4. **S3 Bucket** with `RemovalPolicy.DESTROY` and `autoDeleteObjects: true` (hackathon — no persistence needed).

5. **CloudFront Distribution** with:
   - Default behavior: S3 origin (OAI) serving `frontend/dist/`
   - Additional behavior `/api/*`: Lambda Function URL as custom HTTP origin
   - `BucketDeployment` to upload `../frontend/dist/` to S3

6. **CfnOutput** for the CloudFront distribution URL.

Key CDK imports:
```typescript
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
```

For the Lambda Function URL origin in CloudFront, extract the hostname from the function URL (strip `https://` and trailing `/`), then use `HttpOrigin`.

For the `/api/*` CloudFront behavior, set:
- `allowedMethods: AllowedMethods.ALLOW_ALL`
- `cachePolicy: CachePolicy.CACHING_DISABLED`
- `originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER`

**Step 2: Update bin/infra.ts**

Update the app entry point to instantiate `BandSimStack` with appropriate stack name.

**Step 3: Verify CDK synth compiles**

```bash
cd infra && npx cdk synth
```

Expected: CloudFormation template output to stdout with all resources.

**Step 4: Commit**

```bash
git add infra/
git commit -m "feat: CDK stack with AgentCore, Lambda, S3, CloudFront"
```

---

## Task 5: Backend — SSE Helpers and Handler Shell

**Files:**
- Create: `backend/src/handler.ts`
- Create: `backend/src/types.ts`

**Step 1: Define shared types**

`backend/src/types.ts`:
```typescript
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
```

**Step 2: Create handler with SSE streaming**

`backend/src/handler.ts`:

Use `awslambda.streamifyResponse` for Lambda Function URL response streaming. The handler:
1. Reads the HTTP method and path from the event
2. Routes `POST /api/generate` to the generate flow
3. Routes `POST /api/escalate` to the escalate flow
4. Sets SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
5. Writes SSE events as `event: <type>\ndata: <json>\n\n`

Helper function `writeSSE(stream, eventType, data)` encapsulates the SSE format.

Note: The `awslambda` global is available at runtime in Lambda but not in TypeScript types. Declare it:
```typescript
declare const awslambda: {
  streamifyResponse: (handler: any) => any;
  HttpResponseStream: {
    from: (stream: any, metadata: any) => any;
  };
};
```

**Step 3: Commit**

```bash
git add backend/src/
git commit -m "feat: Lambda handler shell with SSE streaming helpers"
```

---

## Task 6: Backend — AgentCore Client

**Files:**
- Create: `backend/src/agents.ts`

**Step 1: Create the AgentCore invocation wrapper**

`backend/src/agents.ts`:

Creates a function `callAgent(agentId, systemPrompt, messages, instruction)` that:
1. Creates a `BedrockAgentCoreClient` (or uses the appropriate AWS SDK v3 client)
2. Calls `invoke_agent_runtime` with the AgentCore runtime ARN (from `process.env.AGENT_RUNTIME_ARN`)
3. Sends payload: `{ system_prompt, messages, instruction }`
4. Reads the response body and parses JSON
5. Returns the `content` string
6. Wraps in a 10-second timeout using `AbortController`
7. On failure, returns `null` (caller decides how to handle)

If the `@aws-sdk/client-bedrock-agent-core` package doesn't exist or has a different name, fall back to using `@aws-sdk/client-bedrock-runtime` to call Bedrock Claude directly via `InvokeModelCommand`. Structure the code so swapping is a one-line change.

**Fallback direct Bedrock approach** (if AgentCore SDK unavailable):
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export async function callAgent(
  systemPrompt: string,
  messages: AgentMessage[],
  instruction: string
): Promise<string | null> {
  const conversationHistory = messages.map(m => ({
    role: 'user' as const,
    content: `${m.agent_display_name}: ${m.content}`,
  }));

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 200,
    temperature: 0.9,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: instruction },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text;
}
```

Include BOTH implementations (AgentCore and direct Bedrock) behind an environment variable `USE_AGENTCORE=true|false` so we can toggle during development.

**Step 2: Commit**

```bash
git add backend/src/agents.ts
git commit -m "feat: agent invocation client with AgentCore + Bedrock fallback"
```

---

## Task 7: Backend — Generate Flow

**Files:**
- Create: `backend/src/generate.ts`

**Step 1: Implement the generate flow**

`backend/src/generate.ts`:

Export an async function `handleGenerate(input: GenerateRequest, writeSSE: Function)` that:

1. Build system prompts using the prompts module (Task 2)
2. Call Clive with instruction: "You've just discovered a new artist named [NAME]. Their defining traits are: [TRAITS]. Pitch the band concept. You MUST include: a band name (format it as BAND NAME: <name>), a genre (format as GENRE: <genre>), a one-line pitch (format as PITCH: <pitch>), and 2-3 influences (format as INFLUENCES: <comma-separated>)."
3. Parse `band_metadata` from Clive's response using regex to extract BAND NAME, GENRE, PITCH, INFLUENCES
4. `writeSSE('metadata', bandMetadata)`
5. `writeSSE('message', { agent: 'clive', agent_display_name: 'Clive', content: cliveResponse, reacting_to: null })`
6. Call Frontperson with messages=[clive], instruction: "Your A&R executive just pitched a vision for your band. React."
7. `writeSSE('message', { ... frontperson ... })`
8. Call Margaux with messages=[clive, frontperson], instruction: "Review what you've witnessed so far. Score it."
9. `writeSSE('message', { ... journalist ... })`
10. Call Ex-Member with messages=[clive, frontperson, margaux], instruction: "The band is forming without you. Drop your first leak."
11. `writeSSE('message', { ... ex_member ... })`
12. `writeSSE('done', {})`

Error handling: if an agent call returns null, skip its SSE event and continue. If ALL fail, write a single message event with the canned error: "The band's Wi-Fi went down during a heated argument about whether Wi-Fi is 'authentic.'"

**Step 2: Commit**

```bash
git add backend/src/generate.ts
git commit -m "feat: generate flow with sequential agent calls"
```

---

## Task 8: Backend — Escalate Flow

**Files:**
- Create: `backend/src/escalate.ts`

**Step 1: Implement the escalation flow**

`backend/src/escalate.ts`:

Export an async function `handleEscalate(input: EscalateRequest, writeSSE: Function)` that:

1. Define agent list: `['clive', 'frontperson', 'journalist', 'ex_member']`
2. Randomly select 2-3 agents: `count = Math.random() < 0.5 ? 2 : 3`, then `shuffle(agents).slice(0, count)`
3. Get drama modifier from `getDramaModifier(input.drama_level)`
4. For each selected agent (sequentially):
   a. Filter history for messages NOT from this agent
   b. Pick a random message from the filtered list
   c. Build instruction: `"React specifically to ${targetMessage.agent_display_name}'s statement: '${targetMessage.content}'. ${dramaModifier}"`
   d. Build system prompt (using prompts module, with band metadata for name injection)
   e. Call agent with full history (original + this round's responses so far)
   f. Write SSE event with `reacting_to: { agent: targetMessage.agent, excerpt: targetMessage.content.substring(0, 100) }`
   g. Append response to local round history
5. `writeSSE('done', {})`

Same error handling as generate: skip failed agents, canned message if all fail.

**Step 2: Wire generate and escalate into handler.ts**

Update `backend/src/handler.ts` to import and call `handleGenerate` and `handleEscalate` based on the request path.

**Step 3: Commit**

```bash
git add backend/src/
git commit -m "feat: escalation flow with random agent selection and drama modifiers"
```

---

## Task 9: Frontend — Vuetify Theme Configuration

**Files:**
- Modify: `frontend/src/plugins/vuetify.ts` (or wherever Vuetify plugin is configured)

**Step 1: Configure the dark theme with PRD colors**

Update the Vuetify plugin to set:
```typescript
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'bandSimDark',
    themes: {
      bandSimDark: {
        dark: true,
        colors: {
          background: '#0a0a0a',
          surface: '#1a1a1a',
          'surface-variant': '#2a2a2a',
          primary: '#39ff14',       // neon green
          secondary: '#ff1493',     // hot pink
          'agent-clive': '#4682b4',
          'agent-frontperson': '#8b5cf6',
          'agent-journalist': '#f59e0b',
          'agent-ex-member': '#ef4444',
        },
      },
    },
  },
});
```

**Step 2: Add Google Fonts**

Add to `frontend/index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
```

Add global CSS (in `frontend/src/styles/main.css` or equivalent):
```css
.font-headline {
  font-family: 'Playfair Display', serif;
}
.font-agent-name {
  font-family: 'Roboto Mono', monospace;
}
```

**Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: Vuetify dark theme with PRD color palette"
```

---

## Task 10: Frontend — Input Screen

**Files:**
- Create: `frontend/src/components/InputScreen.vue`

**Step 1: Build the input form**

Component with:
- Headline: "Who wronged you?" in Playfair Display, large
- `v-text-field` for name — placeholder: "Your nemesis, your boss, your ex..."
- 3x `v-text-field` for traits — placeholders: "loud", "always late", "replies-all"
- `v-slider` for petty level (1-10, default 5) with labels, thumb-label, color secondary
- `v-btn` with fire emoji + "Turn Them Into a Band" — large, color secondary, block width
- Random rotating microcopy below button (pick from PRD list, change every 3s with `setInterval`)
- All fields required — button disabled until name + all 3 traits filled

Emits: `submit` event with `{ name, traits, petty_level }` payload.

**Step 2: Commit**

```bash
git add frontend/src/components/InputScreen.vue
git commit -m "feat: input screen with name, traits, petty slider"
```

---

## Task 11: Frontend — Loading Screen

**Files:**
- Create: `frontend/src/components/LoadingScreen.vue`

**Step 1: Build the loading screen**

Component that:
- Shows fake status messages one at a time, cycling every 1.5 seconds
- Messages from PRD: "Signing record deal...", "Fabricating mysterious backstory...", "Inventing childhood trauma...", "Scheduling inevitable breakup...", "Alerting The Dissolve...", "Filing preemptive cease and desist..."
- Each message fades in, stays briefly, fades out — use Vue `<Transition>` with CSS
- Centered on screen, Playfair Display font, subtle neon green glow
- `v-progress-circular` indeterminate spinner below the text

Props: none. The parent controls when to show/hide this screen.

**Step 2: Commit**

```bash
git add frontend/src/components/LoadingScreen.vue
git commit -m "feat: loading screen with fake status messages"
```

---

## Task 12: Frontend — useSSEStream Composable

**Files:**
- Create: `frontend/src/composables/useSSEStream.ts`

**Step 1: Implement SSE stream parsing**

Composable that exports a function `useSSEStream()` returning:
- `connect(url: string, body: object): void` — starts a POST fetch with ReadableStream
- `messages: Ref<AgentMessage[]>` — reactive array of received messages
- `metadata: Ref<BandMetadata | null>` — band metadata when received
- `isStreaming: Ref<boolean>` — true while connected
- `isDone: Ref<boolean>` — true when `event: done` received
- `error: Ref<string | null>`

Implementation:
```typescript
async function connect(url: string, body: object) {
  isStreaming.value = true;
  isDone.value = false;
  error.value = null;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = parseSSEBuffer(buffer);
    buffer = events.remaining;

    for (const event of events.parsed) {
      if (event.type === 'message') {
        messages.value.push(JSON.parse(event.data));
      } else if (event.type === 'metadata') {
        metadata.value = JSON.parse(event.data);
      } else if (event.type === 'done') {
        isDone.value = true;
      }
    }
  }

  isStreaming.value = false;
}
```

The `parseSSEBuffer` function splits on `\n\n`, extracts `event:` and `data:` lines, and returns parsed events plus any remaining incomplete buffer.

**Step 2: Commit**

```bash
git add frontend/src/composables/useSSEStream.ts
git commit -m "feat: SSE stream composable for consuming Lambda responses"
```

---

## Task 13: Frontend — useDrama Composable

**Files:**
- Create: `frontend/src/composables/useDrama.ts`

**Step 1: Implement the drama state manager**

Composable that exports `useDrama()` returning:
- `messages: Ref<AgentMessage[]>` — all messages across all rounds
- `metadata: Ref<BandMetadata | null>`
- `dramaLevel: Ref<number>` — starts at 1
- `screen: Ref<'input' | 'loading' | 'chat'>` — current screen state
- `isLoading: Ref<boolean>` — true while waiting for agent responses
- `generate(input: GenerateRequest): Promise<void>` — calls `/api/generate`, transitions screens
- `escalate(): Promise<void>` — calls `/api/escalate`, increments drama level
- `frontpersonName: Ref<string>` — for display in chat

The `generate` function:
1. Sets screen to `'loading'`
2. Creates SSE connection to `/api/generate` with the input body
3. When first message arrives, transitions screen to `'chat'`
4. Appends all messages to the shared messages array

The `escalate` function:
1. Sets `isLoading` true
2. Increments `dramaLevel`
3. Creates SSE connection to `/api/escalate` with `{ session_id: uuid, history: messages, drama_level, band_metadata }`
4. Appends new messages to the shared array
5. Sets `isLoading` false when done

Uses `useSSEStream` internally via `watch` on the stream's messages array.

**Step 2: Commit**

```bash
git add frontend/src/composables/useDrama.ts
git commit -m "feat: drama state composable managing screens and API calls"
```

---

## Task 14: Frontend — Chat Screen Components

**Files:**
- Create: `frontend/src/components/ChatScreen.vue`
- Create: `frontend/src/components/ChatBubble.vue`
- Create: `frontend/src/components/TypingIndicator.vue`

**Step 1: Create TypingIndicator**

Three animated dots. Props: `color: string`. CSS animation: each dot scales up/down with staggered `animation-delay`. Use the agent's color for the dots.

```vue
<template>
  <div class="typing-indicator">
    <span :style="{ backgroundColor: color }" />
    <span :style="{ backgroundColor: color }" />
    <span :style="{ backgroundColor: color }" />
  </div>
</template>
```

**Step 2: Create ChatBubble**

Props: `message: AgentMessage`. Displays:
- Agent name in monospace, colored by agent ID (map agent ID to theme color)
- If `reacting_to` exists, show small italic "replying to [agent]" with excerpt
- Message content in a `v-card` with left border in agent color
- Subtle slide-in animation via Vue `<Transition>`

Agent color mapping:
```typescript
const agentColors: Record<string, string> = {
  clive: '#4682b4',
  frontperson: '#8b5cf6',
  journalist: '#f59e0b',
  ex_member: '#ef4444',
};
```

**Step 3: Create ChatScreen**

Layout:
- **Header** (`v-app-bar`): Band name (Playfair Display), genre chip, one-line pitch — all from `metadata`
- **Chat area** (scrollable `v-container`): Loop over `messages`, render `ChatBubble` for each. Show `TypingIndicator` at bottom when `isLoading`.
- **Bottom bar** (fixed): "Escalate Drama" `v-btn` (color secondary, pulsing glow animation), drama level counter with shake animation on change, subtext "Each click makes it worse. You've been warned."

Auto-scroll: use a `ref` on the chat container, scroll to bottom whenever `messages` array changes (via `watch` with `nextTick`).

The escalate button is disabled while `isLoading` is true.

**Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: chat screen with bubbles, typing indicator, escalate button"
```

---

## Task 15: Frontend — App.vue Screen Router

**Files:**
- Modify: `frontend/src/App.vue`

**Step 1: Wire up the three screens**

`App.vue` uses `useDrama` composable and renders:
- `<InputScreen>` when `screen === 'input'` — on submit, calls `drama.generate(input)`
- `<LoadingScreen>` when `screen === 'loading'`
- `<ChatScreen>` when `screen === 'chat'` — passes messages, metadata, dramaLevel, isLoading, escalate function

Use Vue `<Transition>` with `mode="out-in"` for smooth screen transitions.

Wrap in `<v-app>` as Vuetify requires.

**Step 2: Run the frontend dev server and verify all screens render**

```bash
cd frontend && npm run dev
```

Navigate through screens manually (temporarily hardcode screen transitions for testing). Verify:
- Input screen renders with all fields
- Loading screen shows cycling messages
- Chat screen renders (with empty state)

**Step 3: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: wire up screen router in App.vue"
```

---

## Task 16: Frontend — Animations and Polish

**Files:**
- Create: `frontend/src/styles/animations.css`
- Modify: various components

**Step 1: Add CSS animations**

`frontend/src/styles/animations.css`:

```css
/* Escalate button pulse glow */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(255, 20, 147, 0.4); }
  50% { box-shadow: 0 0 20px rgba(255, 20, 147, 0.8), 0 0 40px rgba(255, 20, 147, 0.4); }
}
.escalate-btn { animation: pulse-glow 2s ease-in-out infinite; }

/* Drama counter shake */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px) rotate(-2deg); }
  75% { transform: translateX(4px) rotate(2deg); }
}
.drama-shake { animation: shake 0.4s ease-in-out; }

/* Message slide-in */
.message-enter-active { transition: all 0.3s ease-out; }
.message-enter-from { transform: translateY(20px); opacity: 0; }
.message-enter-to { transform: translateY(0); opacity: 1; }

/* Loading text fade */
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
```

**Step 2: Import in main entry point and apply classes to relevant components**

**Step 3: Commit**

```bash
git add frontend/src/styles/ frontend/src/components/
git commit -m "feat: animations for escalate button, messages, loading screen"
```

---

## Task 17: First Deploy and Integration Test

**Step 1: Build frontend**

```bash
cd frontend && npm run build
```

Expected: `dist/` directory created with production assets.

**Step 2: Build backend**

```bash
cd backend && npm run build
```

Expected: `dist/handler.js` (or `.cjs`) created.

**Step 3: Authenticate and deploy**

```bash
aws-azure-login
cd infra && npx cdk deploy --require-approval never
```

Expected: Stack deploys successfully. Output includes CloudFront distribution URL.

**Step 4: Test the full flow**

1. Open CloudFront URL in browser
2. Enter name: "Greg from Accounting", traits: "reply-all", "microwaves fish", "says 'per my last email'", petty level: 7
3. Click "Turn Them Into a Band"
4. Verify loading screen appears with cycling messages
5. Verify chat messages stream in one at a time
6. Verify band metadata appears in header
7. Click "Escalate Drama"
8. Verify new messages appear with `reacting_to` context

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test adjustments"
```

---

## Task 18: Final Polish and Demo Prep

**Step 1: Test with 3-4 different inputs**

Try varied names and trait combinations to verify agent responses are funny and in-character. Verify escalation at different drama levels.

**Step 2: Prepare backup pre-generated session**

If time allows, create a static JSON file with a pre-baked conversation for "Greg from Accounting" that can be loaded directly into the chat UI as a fallback.

**Step 3: Final deploy**

```bash
cd frontend && npm run build
cd ../infra && npx cdk deploy --require-approval never
```

**Step 4: Commit and tag**

```bash
git add -A
git commit -m "feat: final polish and demo prep"
git tag v1.0.0-hackathon
```
