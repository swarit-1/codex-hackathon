# LonghorNet

**Marketplace and Autonomous Agent Platform for UT Austin Students**

Built at the OpenAI x UT Austin Codex Hackathon 2026 (March 10–11) | Theme: *Build it Forward*

LonghorNet lets UT students discover, install, and run browser-automation agents that handle tedious campus workflows — from scholarship hunting and course registration to lab outreach and intramural signups. Students can also build their own agents in plain English and publish them to the marketplace.

---

## Agents

| Agent | What it does | Key features |
|-------|-------------|--------------|
| **ScholarBot** | Discovers scholarships, scores fit against your profile, and fills application forms | Multi-source scan, checkpoint pause for essays, deadline tracking |
| **RegBot** | Monitors course seats and registers the instant one opens | Configurable polling, Duo MFA retry with exponential backoff, seat-watch dashboard |
| **EurekaBot** | Scans UT Eureka for research lab openings and drafts outreach emails to professors | Profile matching, personalized email drafts, contact tracking |
| **IMBot** | Finds open intramural sports on IMLeagues matching your schedule and signs you up | Sport/division/day/time matching, captain or free-agent mode, confirmation before payment |
| **Custom (Studio)** | Describe any workflow in plain English and deploy it as a running agent | NL → workflow spec → executable script, dry-run validation, marketplace publishing |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Convex (real-time DB, serverless functions, cron scheduling) |
| Agent Runtime | Browser Use Cloud API v3, local Python runner fallback |
| AI / LLM | OpenAI GPT-4o (matching, workflow generation, email drafting) |
| Auth | Email/password with salted hashing, session tokens (30-day TTL), Duo MFA session caching |
| Deployment | Vercel (frontend), Convex Cloud (backend) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- A Convex account ([convex.dev](https://www.convex.dev))
- An OpenAI API key
- A Browser Use API key (optional — mock mode works without one)

### Installation

```bash
git clone https://github.com/swarit-1/codex-hackathon.git
cd codex-hackathon
npm install
```

### Environment Variables

Create a `.env.local` in the project root:

```env
# App
NODE_ENV=development
APP_ENV=local
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Convex
CONVEX_DEPLOYMENT=<your-convex-deployment>
CONVEX_URL=<your-convex-url>
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>

# OpenAI
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o

# Browser Use (optional — runs in mock mode without these)
BROWSER_USE_API_KEY=<your-browser-use-key>
BROWSER_USE_BASE_URL=https://api.browser-use.com
BROWSER_USE_MODE=local_v1
BROWSER_USE_FALLBACK_ENABLED=true

# Logging
LOG_LEVEL=info
```

### Running Locally

```bash
# Terminal 1 — Convex backend
npx convex dev

# Terminal 2 — Next.js frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed Demo Data

Once Convex is running, the demo bootstrapper seeds a sample user, marketplace templates, agents, scholarships, and logs automatically. You can also trigger it manually from the Convex dashboard by calling `demo.bootstrapWorkspace`.

---

## Project Structure

```
codex-hackathon/
├── apps/web/                      # Next.js frontend
│   ├── app/                       # App Router pages
│   │   ├── dashboard/             # Landing / overview
│   │   ├── marketplace/           # Browse & install templates
│   │   ├── my-agents/             # Agent control center
│   │   ├── studio/                # Model-to-Agent Studio
│   │   ├── scholarbot/            # ScholarBot detail view
│   │   ├── regbot/                # RegBot detail view
│   │   ├── eureka/                # EurekaBot detail view
│   │   ├── login/                 # Authentication
│   │   ├── onboarding/            # First-run setup
│   │   └── settings/              # Profile & credentials
│   ├── components/                # React components by feature
│   ├── lib/                       # Hooks, mappers, contracts, utils
│   └── styles/                    # Global CSS
│
├── convex/                        # Backend (Convex serverless)
│   ├── schema.ts                  # Data model (12 tables)
│   ├── agents.ts                  # Agent CRUD & lifecycle
│   ├── marketplace.ts             # Template catalog & install
│   ├── orchestrator.ts            # Run triggering & webhooks
│   ├── auth.ts                    # Sign up / sign in / sessions
│   ├── demo.ts                    # Seed data & fixtures
│   ├── types/contracts.ts         # Canonical type definitions
│   ├── lib/validators.ts          # Input validation schemas
│   └── security/                  # Password hashing, encryption
│
├── services/agents/               # Agent runtime implementations
│   ├── scholarbot/                # ScholarBot runner & matcher
│   ├── regbot/                    # RegBot runner & Duo handler
│   ├── eurekabot/                 # EurekaBot runner & email drafter
│   ├── imbot/                     # IMBot runner & sport matcher
│   ├── shared/                    # Runtime adapters, retry, logging
│   ├── orchestrator.ts            # Execution dispatcher
│   └── browserUseClient.ts        # Browser Use API wrapper
│
└── docs/                          # Additional documentation
```

---

## How It Works

### Marketplace → Install → Run

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Marketplace │────>│ Install with  │────>│  Agent Instance  │
│  (templates) │     │  your config  │     │  (my-agents)     │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                          ┌────────────────────────┘
                          ▼
                 ┌─────────────────┐
                 │  Trigger Run     │  manual / scheduled / resume
                 └────────┬────────┘
                          ▼
                 ┌─────────────────┐
                 │  Browser Use     │  navigates real websites
                 │  Cloud / Local   │  fills forms, checks status
                 └────────┬────────┘
                          ▼
                 ┌─────────────────┐
                 │  Checkpoint?     │──── yes ──> Pause for human input
                 └────────┬────────┘              (essay, confirmation)
                          │ no                           │
                          ▼                              ▼
                 ┌─────────────────┐          ┌──────────────────┐
                 │  Complete / Log  │          │  User resolves   │
                 └─────────────────┘          │  → Resume agent  │
                                              └──────────────────┘
```

### Model-to-Agent Studio

1. Describe your workflow in plain English
2. GPT-4o generates a structured workflow spec
3. Validate with a dry run
4. Deploy as a private agent or submit to the marketplace

### Agent Lifecycle

Every agent follows: **active** → **paused** → **completed** / **error**

- **Active**: Running on schedule or waiting for next trigger
- **Paused**: Waiting for human input (pending action) or manually paused
- **Completed**: Task finished successfully
- **Error**: Failed with logged error details and category

---

## Data Model

| Table | Purpose |
|-------|---------|
| `users` | Student profiles (name, email, EID, auth method) |
| `userCredentials` | Salted password hashes |
| `authSessions` | Session tokens with 30-day TTL |
| `duoSessions` | Cached Duo MFA sessions with Chrome profiles |
| `marketplaceTemplates` | Agent template catalog (dev + student sources) |
| `templateSubmissions` | Student template moderation pipeline |
| `agents` | Installed agent instances with config, schedule, status |
| `agentRuns` | Individual run records with phase tracking and error categories |
| `agentLogs` | Timestamped event logs with screenshots and scenario IDs |
| `scholarships` | ScholarBot discovery results and application state |
| `labOpenings` | EurekaBot lab opportunities and email drafts |
| `registrationMonitors` | RegBot course seat watchers |
| `intramuralSignups` | IMBot sport signup state |
| `pendingActions` | Human-in-the-loop checkpoints (essays, confirmations, Duo re-auth) |
| `customWorkflows` | Studio-generated workflow specs and scripts |

---

## API Overview

### Marketplace
- `marketplace.listTemplates(filters)` — Browse with pagination
- `marketplace.installTemplate(templateId, config)` — Install as agent
- `marketplace.submitTemplate(payload)` — Student submission
- `marketplace.reviewSubmission(id, decision)` — Approve/reject

### Agents
- `agents.create / listByUser / updateStatus / runNow / updateSchedule / delete`

### Orchestration
- `orchestrator.triggerAgentRun(agentId, runType)` — Manual, scheduled, or resume
- `orchestrator.handleWebhook(payload)` — Browser Use completion callbacks
- `orchestrator.resumeFromPendingAction(actionId)` — Continue after human input

### Auth
- `auth.signUp / signIn / signOut / getCurrentUser`

### Studio
- `flowforge.generateWorkflowSpec(description)` — NL → workflow spec
- `flowforge.generateAgentScript(spec)` — Spec → executable script

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Marketplace-first** | All agents are templates — install, configure, run. Unifies first-party and student-built agents. |
| **Browser Use Cloud** | Real browser automation with profile persistence and Duo session caching. |
| **Convex real-time** | One platform for DB, serverless functions, cron, and file storage. Live updates to the UI. |
| **Human-in-the-loop** | Agents pause at checkpoints for required input — never auto-submits payments or essays. |
| **Config envelopes** | Versioned schema (`v1`) with input schema, defaults, and user overrides. Forwards-compatible. |
| **Scenario IDs** | Every log entry tagged with a scenario for deterministic testing and tracing. |
| **Dual-mode runtime** | Mock mode for development/testing, Browser Use Cloud for production. |

---

## Team

Built by the LonghorNet team at UT Austin for the OpenAI Codex Hackathon 2026.

---

## License

This project was created for the OpenAI x UT Austin Codex Hackathon 2026.
