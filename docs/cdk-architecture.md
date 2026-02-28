# CDK Architecture: Make My Enemy a Band

## Overview

This document defines the AWS infrastructure for deploying the multi-agent band drama engine using TypeScript CDK with `@aws-cdk/aws-bedrock-agentcore-alpha`. It is designed to be consumed by Claude Code alongside the main PRD.

**Stack:** Single CDK stack, single region deployment.
**CDK Language:** TypeScript (matches React frontend stack)
**Key Package:** `@aws-cdk/aws-bedrock-agentcore-alpha` (v2.240.0-alpha.0)

> ⚠️ The AgentCore CDK construct is alpha. APIs may have rough edges. If an L2 construct fights you, drop to `CfnResource` as an escape hatch.

---

## Architecture Diagram

```
                    ┌─────────────────┐
                    │   CloudFront     │
                    │   Distribution   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │   S3 Bucket      │          │  API Gateway     │
     │   (React SPA)    │          │  (REST API)      │
     └─────────────────┘          └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  Lambda          │
                                  │  (Orchestrator)  │
                                  └────────┬────────┘
                                           │
                              ┌────────────┴────────────┐
                              │  AgentCore Runtime       │
                              │  (Containerized Agent)   │
                              │                          │
                              │  4 Agent Personas via    │
                              │  Claude on Bedrock       │
                              └──────────────────────────┘
```

---

## Design Decision: Runtime vs. Direct Bedrock Calls

You have two architectural options:

### Option A: AgentCore Runtime (Recommended for demo narrative)
Deploy a single containerized agent runtime that handles multi-persona orchestration internally. The container receives requests, manages agent state, and calls Bedrock for each persona.

**Pros:**
- "I deployed on AgentCore Runtime" is a strong demo talking point
- Runtime handles session isolation, scaling, lifecycle
- 8-hour execution windows for long sessions
- Built-in observability

**Cons:**
- Requires containerizing your agent code
- Slightly more setup than raw Lambda + Bedrock

### Option B: Lambda + Direct Bedrock Calls (Faster to build)
Skip AgentCore Runtime entirely. Use a Lambda function that calls Bedrock directly for each agent persona, managing the orchestration in the Lambda handler.

**Pros:**
- Simpler — no container needed
- Faster initial setup
- You already know Lambda

**Cons:**
- Less impressive for demo ("it's just a Lambda")
- No AgentCore-specific talking points
- Manual session management

### Recommendation
**Start with Option B (Lambda + Bedrock) for Hour 1**, get it working end-to-end. Then if time allows in Hour 3, wrap it in an AgentCore Runtime container for the demo narrative. The orchestration logic is identical either way — it's just a deployment difference.

---

## Stack Definition

### Dependencies

```bash
npm install @aws-cdk/aws-bedrock-agentcore-alpha @aws-cdk/aws-bedrock-alpha aws-cdk-lib constructs
```

### Stack Structure

```
infra/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── band-drama-stack.ts       # Main stack
│   ├── constructs/
│   │   ├── api.ts                # API Gateway + Lambda
│   │   ├── frontend.ts           # S3 + CloudFront
│   │   └── agent-runtime.ts      # AgentCore Runtime (stretch goal)
│   └── agent-code/
│       ├── Dockerfile             # For AgentCore Runtime option
│       ├── main.py                # Agent orchestration logic
│       └── prompts/
│           ├── clive.txt
│           ├── frontperson.txt
│           ├── journalist.txt
│           └── ex_member.txt
├── cdk.json
├── tsconfig.json
└── package.json
```

---

## Core Infrastructure (Option B — Lambda + Bedrock)

This is what you build first. It's the MVP path.

### API Gateway + Lambda Orchestrator

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class BandDramaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // Lambda Orchestrator
    // ========================================
    const orchestrator = new lambda.Function(this, 'Orchestrator', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'main.handler',
      code: lambda.Code.fromAsset('../agent-code'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        MODEL_ID: 'anthropic.claude-sonnet-4-20250514-v1:0',
        // Use Claude Sonnet on Bedrock — fast enough for comedy, cheap enough for demos
        TEMPERATURE: '0.9',
        MAX_TOKENS: '300',
      },
    });

    // Grant Bedrock invoke permissions
    orchestrator.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['arn:aws:bedrock:*::foundation-model/anthropic.*'],
    }));

    // ========================================
    // API Gateway
    // ========================================
    const api = new apigateway.RestApi(this, 'BandDramaApi', {
      restApiName: 'band-drama-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },
    });

    // POST /generate — initial band creation
    const generate = api.root.addResource('generate');
    generate.addMethod('POST', new apigateway.LambdaIntegration(orchestrator));

    // POST /escalate — drama escalation
    const escalate = api.root.addResource('escalate');
    escalate.addMethod('POST', new apigateway.LambdaIntegration(orchestrator));

    // ========================================
    // Frontend Hosting (S3 + CloudFront)
    // ========================================
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
        },
      ],
    });

    // Deploy frontend build output
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset('../frontend/dist')],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Frontend URL',
    });
  }
}
```

---

## Lambda Orchestrator Code (Python)

The Lambda handler manages the multi-agent orchestration. This is the core logic.

### File: `agent-code/main.py`

```python
import json
import os
import random
import boto3

bedrock = boto3.client('bedrock-runtime')

MODEL_ID = os.environ.get('MODEL_ID', 'anthropic.claude-sonnet-4-20250514-v1:0')
TEMPERATURE = float(os.environ.get('TEMPERATURE', '0.9'))
MAX_TOKENS = int(os.environ.get('MAX_TOKENS', '300'))

# System prompts loaded from environment or files
# (In production, load from prompts/ directory)
AGENT_CONFIGS = {
    'clive': {
        'display_name': 'Clive',
        'system_prompt': '''You are Clive, an A&R executive at a mid-tier record label. You discovered this band and you are increasingly regretting it. You speak in corporate music industry jargon. You reference "the brand," "Q3 streaming targets," "sonic identity," and "market positioning." You are passive-aggressive. You believe everything would be fine if the band would just record one radio-friendly single. Keep responses to 2-4 sentences. Be specific, never generic.'''
    },
    'frontperson': {
        'display_name': None,  # Set dynamically from input name
        'system_prompt': '''You are {name}, the frontperson of this band. You take yourself impossibly seriously. You refer to your music as "the work" — never "songs," always "pieces" or "movements." You weaponize therapy language incorrectly: "That's a trauma response," "You're projecting," "I'm setting a boundary by refusing to write a chorus." You oscillate between grandiosity and persecution. Your three defining traits are: {traits}. Petty level: {petty_level}/10. Keep responses to 2-4 sentences. Be specific, never generic.'''
    },
    'journalist': {
        'display_name': 'Margaux',
        'system_prompt': '''You are Margaux, a music journalist for The Dissolve. You are insufferably pretentious. You use words like "liminal," "praxis," "sonic cartography." You review the DRAMA, not just the music. You score everything with a decimal score (e.g., "7.4 — Best New Confrontation"). Keep responses to 2-4 sentences. Always include a decimal score. Be specific, never generic.'''
    },
    'ex_member': {
        'display_name': 'the one who left',
        'system_prompt': '''You are the ex-member of this band. You were kicked out but say you left. You have receipts for everything. You drop devastating, specific, plausible details. You format things like leaked texts. You have a side project called "Parking Lot Requiem" you mention constantly. You still have access to the band's shared Google Drive. Keep responses to 2-4 sentences. Be devastating and specific.'''
    }
}

DRAMA_MODIFIERS = {
    1: '',
    2: 'Tensions are rising. Be more pointed.',
    3: 'This is becoming a public incident. React accordingly.',
    4: 'Someone is about to say something they can not take back.',
    5: 'This is now a documentary-worthy meltdown. Hold nothing back.',
}


def call_agent(agent_id, system_prompt, user_message):
    """Call Claude via Bedrock for a single agent."""
    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType='application/json',
            accept='application/json',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'system': system_prompt,
                'messages': [{'role': 'user', 'content': user_message}],
                'max_tokens': MAX_TOKENS,
                'temperature': TEMPERATURE,
            })
        )
        result = json.loads(response['body'].read())
        return result['content'][0]['text']
    except Exception as e:
        return f"[{agent_id} is having technical difficulties — their Wi-Fi went down during a heated argument about whether Wi-Fi is 'authentic.']"


def generate_round_1(name, traits, petty_level):
    """Initial band formation — all 4 agents react sequentially."""
    messages = []
    trait_str = ', '.join(traits)

    # Clive discovers the band
    clive_prompt = AGENT_CONFIGS['clive']['system_prompt']
    clive_msg = call_agent('clive', clive_prompt,
        f"You've just discovered a new artist named {name} with traits: {trait_str}. "
        f"Petty level: {petty_level}/10. Pitch the band concept — give them a band name, genre, and your commercial vision.")
    messages.append({'agent': 'clive', 'agent_display_name': 'Clive', 'content': clive_msg, 'reacting_to': None})

    # Frontperson reacts
    fp_prompt = AGENT_CONFIGS['frontperson']['system_prompt'].format(
        name=name, traits=trait_str, petty_level=petty_level)
    fp_msg = call_agent('frontperson', fp_prompt,
        f"Your A&R executive Clive just said: '{clive_msg}' — React to this vision for your band.")
    messages.append({'agent': 'frontperson', 'agent_display_name': name, 'content': fp_msg, 'reacting_to': {'agent': 'Clive', 'excerpt': clive_msg[:100]}})

    # Journalist reviews
    journalist_prompt = AGENT_CONFIGS['journalist']['system_prompt']
    journalist_msg = call_agent('journalist', journalist_prompt,
        f"You're witnessing a band formation. Clive (A&R) said: '{clive_msg}'. "
        f"The frontperson {name} responded: '{fp_msg}'. Review what you've witnessed. Score it.")
    messages.append({'agent': 'journalist', 'agent_display_name': 'Margaux', 'content': journalist_msg, 'reacting_to': None})

    # Ex-member drops first leak
    ex_prompt = AGENT_CONFIGS['ex_member']['system_prompt']
    ex_msg = call_agent('ex_member', ex_prompt,
        f"A band is forming around {name} (traits: {trait_str}) without you. "
        f"Clive pitched: '{clive_msg}'. {name} said: '{fp_msg}'. Margaux reviewed: '{journalist_msg}'. "
        f"Drop your first leak. Contradict something.")
    messages.append({'agent': 'ex_member', 'agent_display_name': 'the one who left', 'content': ex_msg, 'reacting_to': None})

    return messages


def escalate(history, drama_level, name, traits, petty_level):
    """Pick 2-3 random agents, each reacts to a random message from a different agent."""
    agents = ['clive', 'frontperson', 'journalist', 'ex_member']
    selected = random.sample(agents, k=random.randint(2, 3))
    trait_str = ', '.join(traits)

    modifier = DRAMA_MODIFIERS.get(drama_level, DRAMA_MODIFIERS[5])
    history_text = '\n'.join([f"{m['agent_display_name']}: {m['content']}" for m in history])

    new_messages = []
    for agent_id in selected:
        # Pick a random message from a DIFFERENT agent
        other_messages = [m for m in history if m['agent'] != agent_id]
        if not other_messages:
            continue
        target = random.choice(other_messages)

        # Build agent-specific system prompt
        if agent_id == 'frontperson':
            system = AGENT_CONFIGS[agent_id]['system_prompt'].format(
                name=name, traits=trait_str, petty_level=petty_level)
        else:
            system = AGENT_CONFIGS[agent_id]['system_prompt']

        display_name = name if agent_id == 'frontperson' else AGENT_CONFIGS[agent_id]['display_name']

        user_msg = (
            f"Full conversation so far:\n{history_text}\n\n"
            f"React specifically to {target['agent_display_name']}'s statement: "
            f"'{target['content']}'\n\n"
            f"{modifier}"
        )

        content = call_agent(agent_id, system, user_msg)
        msg = {
            'agent': agent_id,
            'agent_display_name': display_name,
            'content': content,
            'reacting_to': {'agent': target['agent_display_name'], 'excerpt': target['content'][:100]}
        }
        new_messages.append(msg)
        # Add to history so subsequent agents in this round see it
        history.append(msg)

    return new_messages


def handler(event, context):
    """Lambda handler — routes to generate or escalate."""
    path = event.get('resource', event.get('path', ''))
    body = json.loads(event.get('body', '{}'))

    if '/generate' in path:
        name = body.get('name', 'Someone')
        traits = body.get('traits', ['annoying', 'loud', 'always late'])
        petty_level = body.get('petty_level', 5)

        messages = generate_round_1(name, traits, petty_level)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'round': 1,
                'messages': messages,
                'drama_level': 1,
                'input': {'name': name, 'traits': traits, 'petty_level': petty_level},
            })
        }

    elif '/escalate' in path:
        history = body.get('history', [])
        drama_level = body.get('drama_level', 2)
        input_data = body.get('input', {})
        name = input_data.get('name', 'Someone')
        traits = input_data.get('traits', ['annoying', 'loud', 'always late'])
        petty_level = input_data.get('petty_level', 5)

        new_messages = escalate(history, drama_level, name, traits, petty_level)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'round': drama_level,
                'messages': new_messages,
                'drama_level': drama_level,
            })
        }

    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }
```

---

## Stretch Goal: AgentCore Runtime Deployment

If you finish the MVP early and want to wrap this in AgentCore Runtime for the demo narrative, here's how.

### Why Bother
The Lambda approach works fine. But saying "I deployed 4 AI agents on AgentCore Runtime with session isolation and built-in observability" sounds a lot better than "I made a Lambda."

### Approach: Direct Code Deployment (Fastest)

AgentCore Runtime supports direct code deployment via S3 — no Docker container needed. This is the fastest path.

```typescript
import { Runtime, AgentRuntimeArtifact, AgentCoreRuntime } from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { BedrockFoundationModel } from '@aws-cdk/aws-bedrock-alpha';

// Deploy agent code directly from local directory
const agentArtifact = AgentRuntimeArtifact.fromCodeAsset({
  path: path.join(__dirname, '../agent-code'),
  runtime: AgentCoreRuntime.PYTHON_3_12,
  entrypoint: ['python', 'main.py'],
});

const agentRuntime = new Runtime(this, 'BandDramaRuntime', {
  runtimeName: 'band_drama_engine',
  agentRuntimeArtifact: agentArtifact,
  description: 'Multi-agent band drama generator',
  environmentVariables: {
    MODEL_ID: 'anthropic.claude-sonnet-4-20250514-v1:0',
    TEMPERATURE: '0.9',
    MAX_TOKENS: '300',
  },
  lifecycleConfiguration: {
    idleRuntimeSessionTimeout: cdk.Duration.minutes(5),
    maxLifetime: cdk.Duration.hours(1),
  },
});

// Grant Bedrock model invocation permissions
const model = BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_4_0_V1;
model.grantInvoke(agentRuntime);

// Grant the API Lambda permission to invoke the runtime
agentRuntime.grantInvoke(orchestratorLambda);
```

### Modified Lambda (Proxy to Runtime)

If using AgentCore Runtime, the Lambda becomes a thin proxy:

```python
import boto3
import json

agentcore = boto3.client('bedrock-agentcore')

def handler(event, context):
    body = json.loads(event.get('body', '{}'))

    response = agentcore.invoke_agent_runtime(
        agentRuntimeId='your-runtime-id',
        endpointName='DEFAULT',
        payload=json.dumps(body),
    )

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': response['body'].read().decode('utf-8'),
    }
```

---

## Deployment Commands

### First-time Setup
```bash
cd infra
npm install
npx cdk bootstrap  # Only needed once per account/region
```

### Deploy
```bash
# Build frontend first
cd ../frontend && npm run build && cd ../infra

# Deploy everything
npx cdk deploy --require-approval never
```

### Useful During Hackathon
```bash
# Deploy just the Lambda code (faster iteration)
npx cdk deploy --hotswap

# Check what will change before deploying
npx cdk diff

# Destroy everything when done
npx cdk destroy
```

---

## Cost Estimate (Hackathon Day)

| Service | Estimated Cost |
|---------|---------------|
| Lambda | ~$0.00 (free tier) |
| API Gateway | ~$0.00 (free tier) |
| Bedrock Claude Sonnet | ~$0.50–2.00 for a day of demos |
| S3 + CloudFront | ~$0.00 (free tier) |
| AgentCore Runtime (if used) | Pay-per-use, minimal for demo |
| **Total** | **< $5 for the day** |

---

## Known Alpha Construct Gotchas

Based on the current state of `@aws-cdk/aws-bedrock-agentcore-alpha`:

1. **Import separately from `aws-cdk-lib`** — it's a separate package, not part of core CDK
2. **Requires `@aws-cdk/aws-bedrock-alpha`** for model references (e.g., `BedrockFoundationModel`)
3. **Runtime requires IAM ServiceLinkedRole permission** — make sure your CDK deployment role has `iam:CreateServiceLinkedRole`
4. **Code deploy option needs Python 3.10+** — use `AgentCoreRuntime.PYTHON_3_12`
5. **Breaking changes possible** — pin your package version in `package.json`
6. **If the L2 construct fails**, drop to `CfnResource`:
   ```typescript
   new cdk.CfnResource(this, 'AgentRuntime', {
     type: 'AWS::BedrockAgentCore::AgentRuntime',
     properties: { /* raw CloudFormation properties */ }
   });
   ```

---

## Build Order (Mapped to PRD Timeline)

### Hour 1: Backend
1. `cdk init app --language typescript`
2. Add Lambda + API Gateway (copy from this doc)
3. Write `agent-code/main.py` (copy orchestration logic from this doc)
4. `cdk deploy` — verify API works with curl
5. Test agent outputs — **are they funny?** If not, tune prompts now

### Hour 2: Frontend
6. `npm create vite@latest frontend -- --template react-ts`
7. Build UI (from PRD spec)
8. Wire to API Gateway URL (from CDK output)
9. `npm run build` → `cdk deploy` to push frontend

### Hour 3: Polish
10. If ahead: wrap in AgentCore Runtime (from stretch section above)
11. If behind: skip AgentCore Runtime, polish UI and prompts
12. Pre-generate backup session
13. Practice demo

---

## Environment Variables Reference

| Variable | Value | Where |
|----------|-------|-------|
| `MODEL_ID` | `anthropic.claude-sonnet-4-20250514-v1:0` | Lambda env |
| `TEMPERATURE` | `0.9` | Lambda env |
| `MAX_TOKENS` | `300` | Lambda env |
| `VITE_API_URL` | CDK output `ApiUrl` | Frontend `.env` |
