
# Make My Enemy a Band

Turn anyone into an absurdly over-serious indie band, then watch the chaos unfold as four AI agents (the band's dysfunctional inner circle) argue in a real-time group chat. Each "Escalate Drama" click triggers another round of unhinged, deadpan-serious banter. Built for hackathons, demos, and anyone who loves overproduced AI absurdity.

---

## 🥁 What is This?

**Make My Enemy a Band** is a web app that transforms a person into a fictional indie band, then simulates the band's inner drama through a group chat of four AI agents:

- **Clive (A&R Exec):** Corporate, desperate, always pushing for a radio single.
- **Frontperson:** Unhinged visionary, oscillates between god complex and total fragility.
- **Margaux (Journalist):** Jaded critic, obsessed with obscure references and scoring.
- **Ex-Member:** Bitter, leaking secrets, always stirring the pot.

Each agent is powered by Claude Sonnet (via Amazon Bedrock) and orchestrated by AgentCore. The user can escalate the drama, causing agents to react to each other's messages in increasingly chaotic ways.

---

## 🎸 Features

- **Real-time group chat** with four distinct AI personalities
- **Escalate Drama** button triggers new rounds of agent chaos
- **Deadpan, overproduced tone** with comically serious banter
- **No auth, no persistence** — everything is session-based
- **Desktop-first, mobile-friendly**

---

## 🛠️ Tech Stack

- **Frontend:** Vite + Vue 3 (Composition API) + TypeScript + Vuetify 3
- **Backend:** AWS Lambda (Function URL, response streaming)
- **Infra:** AWS CDK (TypeScript)
- **AI:** Amazon Bedrock (Claude Sonnet) via AgentCore

---

## 🖥️ Architecture

**Frontend:**
- Three screens: Input → Loading (fake status) → Group Chat
- Chat bubbles styled per agent (steel blue, deep purple, gold, red)
- Vuetify dark theme, Playfair Display for headlines, Roboto for chat
- Vue composables: `useSSEStream` (SSE parsing), `useDrama` (chat state, escalation)

**Backend:**
- Lambda handles two endpoints:
	- `POST /api/generate`: Initial band creation (sequential agent calls)
	- `POST /api/escalate`: Escalation rounds (random agent selection, drama level)
- Both endpoints stream responses as SSE
- Agent orchestration via AgentCore (each agent sees prior messages)

**Infra:**
- Single CDK stack: Lambda (Node.js 20), S3 (frontend), CloudFront (API + assets)
- No API Gateway needed (uses Lambda Function URL for streaming)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (18+)
- AWS CLI configured (with Bedrock + Lambda permissions)
- [aws-azure-login](https://github.com/aws-azure-login/aws-azure-login) for SSO

### Setup

```bash
# Authenticate with AWS
aws-azure-login

# Frontend
cd frontend
npm install
npm run dev         # Start dev server

# Backend
cd ../backend
npm install
npm run build

# Infra (CDK)
cd ../infra
npm install
npx cdk synth       # Synthesize CloudFormation
npx cdk deploy      # Deploy stack to AWS
```

---

## 📝 Project Structure

```
band-sim/
├── frontend/    # Vue 3 + Vuetify 3 + TypeScript
│   └── src/
│       ├── components/   # InputScreen, LoadingScreen, ChatScreen, etc.
│       ├── composables/  # useSSEStream, useDrama
│       └── plugins/      # vuetify.ts (theme config)
├── backend/     # Lambda handler (TypeScript)
│   └── src/
│       ├── handler.ts    # Route dispatcher + SSE
│       ├── agents.ts     # AgentCore client, agent definitions
│       ├── generate.ts   # Round 1 flow
│       ├── escalate.ts   # Escalation logic
│       └── prompts.ts    # System prompt templates
└── infra/       # AWS CDK (TypeScript)
		└── lib/
				└── band-sim-stack.ts
```

---

## 🤖 Agent Personalities

See `make-my-enemy-a-band-PRD.md` for full system prompts and agent details.

---

## 📄 License

MIT — see [LICENSE](LICENSE)
