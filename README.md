# Make My Enemy a Band

Turn unresolved personal tension into indie rock.

You know that one person — the coworker who reply-alls, the ex who "just wants to talk," the roommate who microwaves fish at 11pm? They don't need a conversation. They need a record deal.

**Make My Enemy a Band** takes any person and transforms them into an absurdly over-serious indie band — then lets you watch, in real-time, as the band's inner circle tears itself apart in a group chat powered by four AI agents who take everything way too seriously.

## Live Demo

**https://d3e8x2z1agn282.cloudfront.net**

---

## How It Works

**Step 1:** Enter a name, three personality traits, and a petty level (1–10).

**Step 2:** Watch fake loading messages while we "sign their record deal" and "fabricate a mysterious backstory."

**Step 3:** Four AI agents start arguing about the band in a live group chat. Each one has a different agenda. None of them are okay.

**Step 4:** Hit the Escalate Drama button. Things get worse. Hit it again. They get much worse.

---

## The Cast

Every band needs dysfunction. Ours is automated.

### Clive — The A&R Executive
Corporate. Desperate. Keeps saying "circle back on the sonic identity." Signed this band and deeply regrets it. Would give anything for one radio-friendly single. Will not get one.

### [Your Enemy's Name] — The Frontperson
Unhinged visionary. Refers to all music as "the work." Weaponizes therapy language incorrectly. Once cancelled an album because a barista spelled their name wrong. Oscillates between "this album will save humanity" and "nobody has ever suffered like I have suffered at a Whole Foods."

### Margaux — The Music Journalist
Writes for a fictional publication called The Dissolve. Reviews the drama, not just the music. Gives everything a decimal score. Has described a drum fill as "a meditation on impermanence." Declared a contract dispute "the most important cultural moment of the year." It was not.

### The One Who Left — The Ex-Member
Former bassist. Or keyboardist. Changes the story. Says they "left for creative differences." They were kicked out. Has receipts. Still has access to the band's shared Google Drive. Constantly promotes their side project, Parking Lot Requiem. Nobody has asked about Parking Lot Requiem.

---

## The Escalation Engine

Each tap of the Escalate button picks 2–3 agents at random. Each one reacts to a specific previous message from a different agent. The full chat history travels with every call, so the arguments build on themselves and spiral in directions nobody — including us — can predict.

At Drama Level 1, it's light shade.
By Drama Level 5, someone has announced a vinyl apology tour, NPR Tiny Desk has rescinded their invitation, and there are lawsuits.

---

## How We Built It

**Frontend:** Vite + Vue 3 + Vuetify 3 — dark mode, agent-colored chat bubbles, Playfair Display headlines because fake music magazines deserve real typography. SSE streaming so messages appear one at a time with typing indicators between them. The wait is part of the comedy.

**Backend:** A single AWS Lambda (Node.js 20) with a Function URL that streams responses as Server-Sent Events. Two endpoints: `/generate` for initial band creation, `/escalate` for making everything worse. No API Gateway needed — Lambda Function URLs handle streaming natively.

**AI:** Four distinct system prompts running Claude Sonnet 4.5 through Amazon Bedrock. Each agent has a unique personality, reaction style, and set of grievances. Temperature set to 0.9 because we want creative chaos, not corporate safety.

**Infra:** Single AWS CDK stack (TypeScript). S3 for the frontend, CloudFront for distribution, Lambda for compute. Deploys in one command. Destroys in one command. As all hackathon projects should.

---

## What Makes It Interesting (Beyond the Jokes)

This isn't just "call an LLM and display the result." The multi-agent architecture creates emergent behavior — agents responding to agents responding to agents, with each round producing conversations we didn't script and couldn't predict. The randomized reaction targeting means every session plays out differently, even with the same input.

It's also a surprisingly effective demo of what agentic AI looks like when the agents have personalities and competing agendas — which, if we're being honest, is what enterprise multi-agent systems will look like too. We just made ours funnier.

---

## Try It

Enter "Greg from Accounting." Traits: reply-all, microwaves fish, says "per my last email." Petty level: 8.

Then hit Escalate three times and try not to read Margaux's review out loud.

> *"We don't make music. We make confrontations."*
> — The Frontperson, probably

---

## Getting Started

### Prerequisites
- Node.js (20+)
- AWS CLI configured (with Bedrock + Lambda permissions)
- Claude Sonnet 4.5 model access enabled in Amazon Bedrock console

### Setup

```bash
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

## Project Structure

```
band-sim/
├── frontend/    # Vue 3 + Vuetify 3 + TypeScript
│   └── src/
│       ├── components/   # InputScreen, LoadingScreen, ChatScreen, etc.
│       ├── composables/  # useSSEStream, useDrama
│       ├── config/       # Agent config (colors, avatars, roles)
│       └── styles/       # Liquid glass CSS, animations
├── backend/     # Lambda handler (TypeScript)
│   └── src/
│       ├── handler.ts    # Route dispatcher + SSE
│       ├── agents.ts     # Bedrock client, agent definitions
│       ├── generate.ts   # Round 1 flow
│       ├── escalate.ts   # Escalation logic
│       └── prompts.ts    # System prompt templates
└── infra/       # AWS CDK (TypeScript)
    └── lib/
        └── infra-stack.ts
```

---

## License

MIT
