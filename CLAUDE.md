# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Make My Enemy a Band" — a hackathon web app that turns a person into an absurdly over-serious indie band. Four AI agents (Clive the A&R exec, the Frontperson, Margaux the journalist, the Ex-Member) argue in a group chat. Users click "Escalate Drama" to trigger more rounds of chaos.

The PRD is in `make-my-enemy-a-band-PRD.md` — it contains the full agent system prompts, API contracts, and UI spec.

## Tech Stack

- **Frontend:** Vite + Vue 3 (Composition API) + TypeScript + Vuetify 3
- **Backend:** AWS Lambda (Function URL with response streaming, no API Gateway)
- **Infra:** AWS CDK (TypeScript) in `infra/`
- **AI:** Amazon Bedrock (Claude Sonnet) via AgentCore for multi-agent orchestration
- **Model config:** Temperature 0.9, max 200 tokens per agent response, 10s timeout per agent

## Commands

```bash
# AWS Auth (required before any deploy/cdk commands)
aws-azure-login

# Frontend
cd frontend
npm install
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # Lint

# Backend (Lambda)
cd backend
npm install
npm run build

# Infra (CDK)
cd infra
npm install
npx cdk synth        # Synthesize CloudFormation template
npx cdk diff         # Preview changes
npx cdk deploy       # Deploy stack to AWS
```

## Architecture

### Frontend
Three screens: Input -> Loading (fake status messages) -> Group Chat.

The group chat is the core UI. Messages render as chat bubbles with per-agent colors:
- Clive: Steel blue (#4682b4)
- Frontperson: Deep purple (#8b5cf6)
- Margaux: Amber/gold (#f59e0b)
- Ex-Member: Red (#ef4444)

Background: #0a0a0a. Accent: neon green (#39ff14) for highlights, hot pink (#ff1493) for escalation.

Typography: Playfair Display (Google Fonts, serif) for headlines, Roboto (Vuetify default) for chat, monospace for agent names.

Vuetify dark theme as base, customized with above colors. Components: `v-text-field`, `v-slider`, `v-btn`, `v-card` for chat bubbles, `v-app-bar` for header.

Vue composables: `useSSEStream` (fetch + ReadableStream SSE parsing), `useDrama` (chat state, message history, drama level, generate/escalate methods).

### Backend
Two endpoints, both return SSE streams:

**POST /api/generate** — Initial band creation. Agents called sequentially via AgentCore: Clive (establishes band name/genre) -> Frontperson (reacts) -> Margaux (reviews + scores) -> Ex-Member (leaks). Each agent sees all prior messages.

**POST /api/escalate** — Picks 2-3 random agents, each reacts to a random message from a *different* agent. Full chat history + escalation flavor text passed as context. Drama levels 1-6+ modify agent intensity.

Both endpoints stream responses as SSE via Lambda Function URL (response streaming). CloudFront proxies `/api/*` to the function URL, frontend assets served from S3 — one domain, no CORS.

### Agent Orchestration
- Round 1 is sequential (each agent builds on previous responses)
- Escalation rounds are also sequential within the round (each agent in the round sees the current round's responses too)
- If an agent call fails, skip it and continue
- If all fail, return an in-character "technical difficulties" message

## Key Design Decisions

- No auth, no database, no persistence — everything is session-based
- Desktop-first but must not break on mobile
- Tone is deadpan serious, comically overproduced, slightly unhinged
- Agent responses must be 2-4 sentences, specific (never generic), and reference actual conversation details
- The Frontperson's name, traits, and petty level come from user input and get injected into the system prompt template
