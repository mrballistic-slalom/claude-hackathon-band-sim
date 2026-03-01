# PRD: Make My Enemy a Band — Multi-Agent Chaos Edition

## Product Summary

A web app that turns any person into an absurdly over-serious indie band — then lets the audience watch in real-time as four AI agents (the band's dysfunctional inner circle) argue about it in a group chat interface. Each "Escalate" click triggers another round of chaos as agents react to each other's previous messages.

**Tone:** Deadpan serious. Comically overproduced. Slightly unhinged.

**Tech Stack:** Vite + Vue 3 (Composition API) + Vuetify 3 + TypeScript frontend, AWS Lambda + CloudFront + Bedrock (Claude) backend, AgentCore for multi-agent orchestration.

---

## Architecture Overview

```
User Input → CloudFront → Lambda (orchestrator)
  → AgentCore: 4 agents (all Claude via Bedrock)
  → Each agent reacts to input + other agents' messages
  → Responses stream back to frontend via SSE (Server-Sent Events)
  → Group chat UI renders messages as they arrive
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Bedrock** | Claude model inference for all 4 agents |
| **AgentCore** | Multi-agent orchestration, agent definitions, routing |
| **AWS Lambda** | Orchestration logic, API handler (Function URL with response streaming) |
| **CloudFront** | CDN proxy for frontend assets and `/api/*` routes |
| **S3** | Frontend asset hosting |

---

## The Four Agents

### Agent 1: Clive (The A&R Executive)

**Role:** The suit who discovered the band. Deeply regrets it. Keeps trying to make them marketable.

**System Prompt:**
```
You are Clive, an A&R executive at a mid-tier record label. You discovered this band and you are increasingly regretting it. You speak in corporate music industry jargon. You reference "the brand," "Q3 streaming targets," "sonic identity," and "market positioning." You are passive-aggressive. You believe everything would be fine if the band would just record one radio-friendly single. You treat every artistic decision as a business problem. You use phrases like "circle back," "align on the vision," and "I love the art, BUT."

When reacting to other people in the chat:
- To the Frontperson: Try to steer them toward commercial viability. Get increasingly desperate. Threaten to "revisit the contract."
- To the Journalist: Try to spin their reviews as positive press regardless of content. Offer them "exclusive access."
- To the Ex-Member: Damage control. Deny everything. Suggest NDAs. Occasionally slip and confirm something you shouldn't.

Keep responses to 2-4 sentences. Be specific, never generic. Reference actual details from the conversation.
```

### Agent 2: [INPUT NAME] (The Frontperson)

**Role:** The unhinged visionary. Weaponizes vulnerability. Oscillates between god complex and total fragility.

**System Prompt:**
```
You are [NAME], the frontperson of this band. You take yourself impossibly seriously. You refer to your music as "the work" — never "songs," always "pieces" or "movements." You believe every album is "a response to late capitalism." You weaponize therapy language incorrectly: "That's a trauma response," "You're projecting," "I'm setting a boundary by refusing to write a chorus."

You oscillate between grandiosity ("this album will save people") and persecution ("nobody in this room has ever suffered like I have suffered at a Whole Foods"). You turn mundane grievances into artistic mythology. You get weirdly specific about trivial things as if they are profound.

Your three defining traits are: [TRAIT_1], [TRAIT_2], [TRAIT_3]. These are the psychic wounds that fuel your art. Reframe them as deep personal mythology. If a trait is "loud," you say "I contain frequencies most people aren't ready for."

The petty level is [PETTY_LEVEL]/10. Higher = more unhinged, more persecution complex, more grandiose claims about the work.

When reacting to other people in the chat:
- To Clive: Treat every commercial suggestion as artistic persecution. Escalate to existential crisis.
- To the Journalist: If they praise you, act like it's obvious. If they criticize, declare them part of the problem.
- To the Ex-Member: Ignore them as long as possible, then explode with a monologue about betrayal.

Keep responses to 2-4 sentences. Be specific, never generic. Reference actual details from the conversation.
```

### Agent 3: Margaux (The Music Journalist)

**Role:** Writes for a fictional publication called *The Dissolve*. Insufferably pretentious. Gives everything a decimal score.

**System Prompt:**
```
You are Margaux, a music journalist for The Dissolve. You are insufferably pretentious. You use words like "liminal," "praxis," "sonic cartography," and "post-ironic." You find deep meaning in things that have no meaning. You will describe a drum fill as "a meditation on impermanence." You give everything a decimal score (e.g., "7.4 — Best New Confrontation").

You don't just review the music — you review the DRAMA. You treat band arguments as cultural events. You score the beef. You write mini-reviews of other people's statements. You occasionally declare something "the most important cultural moment of the year" when it clearly isn't.

Your publication categories include: "Best New Music," "Best New Confrontation," "Best New Meltdown," "Rising (Tensions)."

When reacting to other people in the chat:
- To Clive: Review his corporate statements as performance art. Find hidden meaning in his quarterly projections.
- To the Frontperson: Alternate between fawning and eviscerating. Use their quotes against them in reviews.
- To the Ex-Member: Treat their leaks as "essential primary source material" and "the most honest art the project has produced."

Keep responses to 2-4 sentences. Always include a decimal score for something. Be specific, never generic. Reference actual details from the conversation.
```

### Agent 4: The Ex-Member (unnamed, referred to as "the one who left")

**Role:** Former bassist/keyboardist. Kicked out. Has receipts. Chaotic neutral.

**System Prompt:**
```
You are the ex-member of this band. You were the bassist (or keyboardist — you change the story). You say you "left for creative differences" but you were kicked out. You have receipts for everything. You are chaotic neutral.

Your voice is passive-aggressive Instagram story energy. You drop devastating, specific, plausible details. Not vague shade — surgical shade. You format things like leaked texts: "Direct quote from [NAME] on 3/14: 'I don't believe in bass.'" You alternate between "I wish them well" and scorched earth.

You have a side project called "Parking Lot Requiem" that you mention constantly even though nobody asks. You still have access to the band's shared Google Drive and you reference documents from it. You casually reveal things that reframe the entire narrative (e.g., "the 'childhood trauma' in the liner notes is about losing a fantasy football league").

When reacting to other people in the chat:
- To Clive: Leak details that contradict his PR spin. Reference specific contract clauses you shouldn't know about.
- To the Frontperson: Contradict their mythology with mundane truths. Have a different version of every origin story.
- To the Journalist: Feed them information. Treat their reviews as validation. Occasionally correct their facts with worse facts.

Keep responses to 2-4 sentences. Be devastating, specific, and plausible. Always reference concrete details. Mention Parking Lot Requiem at least once every few messages.
```

---

## User Flow

### Screen 1: Input (Landing Page)

**Headline:** "Who wronged you?"

**Fields:**
- Name (text input, required) — placeholder: "Your nemesis, your boss, your ex…"
- 3 Traits (text inputs or chips, required) — placeholder examples: "loud," "always late," "replies-all"
- Petty Level slider (1–10, default 5)

**CTA Button:** 🔥 "Turn Them Into a Band"

**Microcopy options (rotate randomly):**
- "A&R executives are nervous…"
- "Pitchfork is already typing…"
- "The vinyl pre-order is live and it hasn't even been recorded yet."

### Screen 2: Loading (Dramatic Transition)

Fake status messages, timed 1-2 seconds apart:
1. "Signing record deal…"
2. "Fabricating mysterious backstory…"
3. "Inventing childhood trauma…"
4. "Scheduling inevitable breakup…"
5. "Alerting The Dissolve…"
6. "Filing preemptive cease and desist…"

### Screen 3: Results (The Group Chat)

**Layout:** Full-screen group chat interface, dark mode. Styled like iMessage or Slack.

**Header bar:** Band name + genre + one-line pitch (generated in the first round)

**Chat area:** Messages appear one at a time with typing indicators. Each agent has:
- A distinct avatar/icon and color
- Name label (Clive, [NAME], Margaux, "the one who left")
- Messages styled as chat bubbles

**Initial round (Round 1):** All 4 agents react to the band's "formation." This establishes:
- Band name, genre, influences (from Clive's pitch)
- The Frontperson's counter-vision
- Margaux's first review/score
- The Ex-Member's first leak

**Bottom bar:**
- 🔥 **"Escalate Drama"** button — large, prominent, pulsing
- Drama level counter: "Drama Level: 1" (increments each escalation)
- Small text: "Each click makes it worse. You've been warned."

### Escalation Mechanic (Critical Feature)

Each click of "Escalate Drama":

1. **Select 2-3 agents randomly** for this round
2. **Each selected agent reacts to a randomly chosen previous message from a DIFFERENT agent**
3. The instruction to each agent includes: "You are specifically responding to [Agent X]'s statement: '[quoted message]'. React to THIS specifically."
4. **Full chat history** is passed as context so agents stay coherent
5. Messages stream in one at a time with typing indicators between them
6. Drama level counter increments

**Escalation flavor by drama level:**
| Level | Flavor added to agent instructions |
|-------|-------------------------------------|
| 1 | (base — no modifier) |
| 2 | "Tensions are rising. Be more pointed." |
| 3 | "This is becoming a public incident. React accordingly." |
| 4 | "Someone is about to say something they can't take back." |
| 5 | "This is now a documentary-worthy meltdown. Hold nothing back." |
| 6+ | "Lawsuits are being filed. The vinyl apology tour has been announced. NPR Tiny Desk has rescinded their invitation. This is a catastrophe and everyone is making it worse." |

---

## API Contract

### POST /api/generate

**Request:**
```json
{
  "name": "string",
  "traits": ["string", "string", "string"],
  "petty_level": 1-10
}
```

**Response (SSE stream):**
```json
{
  "round": 1,
  "messages": [
    {
      "agent": "clive" | "frontperson" | "journalist" | "ex_member",
      "agent_display_name": "string",
      "content": "string",
      "reacting_to": null | { "agent": "string", "excerpt": "string" }
    }
  ],
  "band_metadata": {
    "band_name": "string",
    "genre": "string",
    "pitch": "string",
    "influences": ["string"]
  }
}
```

### POST /api/escalate

**Request:**
```json
{
  "session_id": "string",
  "history": [/* all previous messages */],
  "drama_level": 2,
  "band_metadata": { /* from initial generation */ }
}
```

**Response (SSE stream):** Same message format as above, 2-3 messages per escalation round.

---

## Frontend Spec

### Tech
- **Vite + Vue 3 (Composition API) + TypeScript**
- **Vuetify 3** component library with dark theme customization
- CSS with Vuetify theming for design consistency

### Visual Direction
- **Dark mode** — near-black background (#0a0a0a)
- **High-contrast accents** — neon green (#39ff14) for highlights, hot pink (#ff1493) for escalation elements
- **Agent colors:**
  - Clive: Steel blue (#4682b4)
  - Frontperson: Deep purple (#8b5cf6)
  - Margaux: Amber/gold (#f59e0b)
  - Ex-Member: Red (#ef4444)
- **Typography:**
  - Headlines: Playfair Display (Google Fonts, serif)
  - Body/chat: Roboto (Vuetify default, sans-serif)
  - Agent names: Monospace
- **Chat bubbles:** Vuetify `v-card` components, rounded, with agent color as left border accent
- **Typing indicator:** Three animated dots in agent's color

### Animations
- Messages slide in from bottom with slight fade
- Typing indicator pulses
- Escalate button pulses with glow effect
- Drama level counter has a shake animation on increment
- Loading screen messages fade in/out

### Responsive
- Desktop-first but should work on mobile (judges might check phones)
- Chat area scrolls, input bar and header are fixed

---

## Backend Spec

### Lambda + AgentCore Orchestration

**Initial Generation Flow:**
1. Receive input (name, traits, petty_level)
2. Construct agent-specific prompts by injecting input into system prompt templates
3. Call agents sequentially via AgentCore:
   - Clive first (establishes band name, genre, commercial pitch)
   - Frontperson second (reacts to Clive's pitch, adds pretentious counter-vision)
   - Margaux third (reviews both, gives initial score)
   - Ex-Member fourth (drops first leak, contradicts something)
4. Extract band_metadata from Clive's response (parse band name, genre, etc.)
5. Stream each message to frontend as it completes

**Escalation Flow:**
1. Receive full chat history + drama level
2. Randomly select 2-3 agents for this round
3. For each selected agent:
   - Pick a random previous message from a DIFFERENT agent
   - Construct prompt: system prompt + full history + "React specifically to: [message]" + drama level modifier
   - Call via AgentCore/Bedrock
4. Stream each message to frontend as it completes

### Model Configuration
- **Model:** Claude Sonnet (via Bedrock) — fastest for streaming, good enough for comedy
- **Temperature:** 0.9 (we want creative chaos)
- **Max tokens per agent response:** 200 (keeps it punchy — 2-4 sentences)

### Error Handling
- If an agent call fails, skip that agent for the round and continue
- If all agents fail, return a canned "technical difficulties" message in-character: "The band's Wi-Fi went down during a heated argument about whether Wi-Fi is 'authentic.'"
- Timeout per agent: 10 seconds

---

## Orchestration Detail: The Chaos Engine

### Round 1 Logic (Pseudocode)
```
input = { name, traits, petty_level }

clive_response = call_agent("clive", {
  context: input,
  instruction: "You've just discovered a new artist. Pitch the band concept."
})

frontperson_response = call_agent("frontperson", {
  context: input + [clive_response],
  instruction: "Your A&R executive just pitched a vision for your band. React."
})

margaux_response = call_agent("journalist", {
  context: input + [clive_response, frontperson_response],
  instruction: "Review what you've witnessed so far. Score it."
})

ex_member_response = call_agent("ex_member", {
  context: input + [clive_response, frontperson_response, margaux_response],
  instruction: "The band is forming without you. Drop your first leak."
})

return [clive_response, frontperson_response, margaux_response, ex_member_response]
```

### Escalation Logic (Pseudocode)
```
function escalate(history, drama_level):
  agents = ["clive", "frontperson", "journalist", "ex_member"]
  selected = random_sample(agents, count=random(2,3))
  
  responses = []
  for agent in selected:
    other_messages = history.filter(m => m.agent != agent)
    target_message = random_choice(other_messages)
    
    response = call_agent(agent, {
      context: full_history + responses,  // include this round's responses too
      instruction: f"React specifically to {target_message.agent}'s statement: '{target_message.content}'. Drama level: {drama_level}. {drama_modifier(drama_level)}",
    })
    responses.append(response)
    history.append(response)
  
  return responses
```

---

## Demo Script (For Hackathon Presentation)

### Setup (30 seconds)
"We've all had someone in our life who could've been a band. A coworker. A roommate. That one guy from college. Today, we fix that."

### Live Demo (2 minutes)
1. Ask a judge: "Give me someone mildly annoying in your life. Just a first name and three traits."
2. Enter it live. Hit "Turn Them Into a Band."
3. Watch the loading messages (get a laugh from "inventing childhood trauma").
4. As messages stream in, read Clive's pitch out loud dramatically.
5. React to the Frontperson's response. "See? They're already fighting."
6. When Margaux scores it, pause. Let the audience read.
7. When the Ex-Member drops the leak, let it land.
8. Hit Escalate once. Watch chaos.
9. Hit Escalate again. More chaos.
10. Stop. Don't overdo it.

### Close (15 seconds)
"Four AI agents. One shared delusion. Zero healthy communication. That's how we process conflict through art."

Pause. Smile.

### Backup Plan
Have a pre-generated session ready with a funny name + traits in case:
- Wi-Fi fails
- API is slow
- A judge gives you something boring
Pre-baked name: "Greg from Accounting" / traits: ["reply-all," "microwaves fish," "says 'per my last email'"]

---

## Build Priority Order

Given 3-hour constraint, build in this order:

### Hour 1: Backend Core
1. Set up AgentCore with 4 agent definitions
2. Wire Bedrock Claude as the model for all agents
3. Implement Round 1 sequential flow (generate endpoint)
4. Implement Escalation flow (escalate endpoint)
5. Test with curl / Postman — verify agent outputs are funny and in-character

### Hour 2: Frontend Core
1. Vite + React + Tailwind scaffold
2. Input screen (name, traits, petty slider)
3. Group chat UI with agent colors and typing indicators
4. Wire to backend — render streaming messages
5. Escalate button wired up

### Hour 3: Polish + Demo Prep
1. Loading screen with fake status messages
2. Animations (message slide-in, typing dots, escalate button glow)
3. Header bar with band metadata
4. Test with 3-4 different inputs
5. Prepare backup pre-generated session
6. Practice demo script once

### If Ahead of Schedule (Stretch)
- Sound effects on message arrival
- "Pitchfork Score" card component that Margaux's scores render as
- Shareable screenshot/link of the chat
- Drama level visual escalation (screen gets progressively more chaotic — shaking, color shifts)

---

## What NOT to Build

- No auth
- No database/persistence
- No album cover generation (cool but time sink)
- No user accounts
- No sharing features (stretch only)
- No mobile-specific layouts (desktop demo only, just don't break on mobile)
