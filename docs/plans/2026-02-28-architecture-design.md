# Architecture Design: Make My Enemy a Band

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent orchestration | AgentCore | PRD specifies it; proper multi-agent orchestration |
| Streaming | Lambda Function URL + SSE | Simplest path to real-time streaming, no API Gateway needed |
| Frontend hosting | S3 + CloudFront via CDK | Single CDK stack deploys everything, one domain |
| Frontend framework | Vue 3 + Vuetify 3 + TypeScript | Vuetify provides dark theme, slider, text fields, cards out of the box |
| Package manager | npm | Standard, no extra setup |

## Project Structure

```
band-sim/
├── frontend/              # Vue 3 + Vuetify 3 + TypeScript (Vite)
│   └── src/
│       ├── components/    # InputScreen, LoadingScreen, ChatScreen, ChatBubble, TypingIndicator
│       ├── composables/   # useSSEStream, useDrama
│       ├── plugins/       # vuetify.ts (theme config)
│       └── App.vue        # Screen router (input -> loading -> chat)
├── backend/               # Lambda handler (TypeScript)
│   └── src/
│       ├── handler.ts     # Route dispatcher + SSE response formatting
│       ├── agents.ts      # AgentCore client, agent definitions, system prompts
│       ├── generate.ts    # Round 1 sequential flow
│       ├── escalate.ts    # Escalation flow (random agent selection, message targeting)
│       └── prompts.ts     # System prompt templates for all 4 agents
└── infra/                 # AWS CDK (TypeScript)
    └── lib/
        └── band-sim-stack.ts  # Single stack: Lambda + Function URL + S3 + CloudFront + IAM
```

## Infra (CDK Stack)

Single stack deploying:

- **Lambda function** (Node.js 20 runtime, TypeScript bundled with esbuild)
  - Function URL with streaming enabled (`InvokeMode.RESPONSE_STREAM`)
  - 30s timeout (enough for sequential 4-agent calls at 10s each)
  - 256MB memory
  - IAM policy granting `bedrock:InvokeModel` and AgentCore permissions
- **S3 bucket** for built frontend assets
- **CloudFront distribution** with two origins:
  - Default: S3 bucket (frontend)
  - `/api/*` behavior: Lambda Function URL origin (backend)
  - This means one domain, no CORS issues
- **BucketDeployment** to auto-upload `frontend/dist/` on `cdk deploy`

## Backend (Lambda)

One Lambda function handling two routes internally:

### POST /api/generate
1. Parse input: `{ name, traits, petty_level }`
2. Inject input into system prompt templates (Frontperson gets name/traits/petty_level)
3. Call agents sequentially via AgentCore, each seeing prior responses:
   - Clive -> Frontperson -> Margaux -> Ex-Member
4. Stream each agent's response as an SSE event as it completes
5. First event includes `band_metadata` extracted from Clive's response

### POST /api/escalate
1. Parse input: `{ session_id, history, drama_level, band_metadata }`
2. Pick 2-3 agents randomly
3. For each: pick a random message from a different agent, construct prompt with drama modifier
4. Stream each response as SSE event

### SSE Event Format
```
event: message
data: {"agent":"clive","agent_display_name":"Clive","content":"...","reacting_to":null}

event: message
data: {"agent":"frontperson","agent_display_name":"[NAME]","content":"...","reacting_to":{"agent":"clive","excerpt":"..."}}

event: metadata
data: {"band_name":"...","genre":"...","pitch":"...","influences":["..."]}

event: done
data: {}
```

### Error Handling
- Per-agent 10s timeout; if one fails, skip and continue
- If all fail, return canned in-character message
- Lambda-level 30s timeout as backstop

## Frontend (Vue 3 + Vuetify 3)

### Vuetify Theme
Dark theme base with custom colors:
- Background: `#0a0a0a`
- Surface: `#1a1a1a`
- Primary (highlights): `#39ff14` (neon green)
- Secondary (escalation): `#ff1493` (hot pink)
- Agent colors defined as custom theme variables

### Screens

**InputScreen** — `v-text-field` for name, 3x `v-text-field` for traits, `v-slider` for petty level (1-10), `v-btn` to submit. Random rotating microcopy below the button.

**LoadingScreen** — Fake status messages fading in/out on timers (1-2s each). Transitions to chat when first SSE event arrives.

**ChatScreen** — Scrollable chat area with `ChatBubble` components. Each bubble has left border in agent color, agent name in monospace, message content. `TypingIndicator` (three animated dots in agent color) shown before each message. Header bar shows band name + genre + pitch. Bottom bar has pulsing "Escalate Drama" button + drama level counter.

### Composables

**useSSEStream** — Connects to Lambda Function URL via `fetch` + `ReadableStream`, parses SSE events, emits messages one at a time. Handles reconnection and errors.

**useDrama** — Manages chat state: message history, drama level, band metadata. Provides `generate()` and `escalate()` methods that call the API and feed results through `useSSEStream`.

### Typography
- Playfair Display (Google Fonts) for headlines/band name
- Vuetify default (Roboto) for body/chat
- Monospace for agent names
