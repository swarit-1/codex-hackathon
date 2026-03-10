# LonghorNet — Product Requirements Document

**Autonomous Browser Agents for UT Austin Students**

OpenAI x UT Austin — Codex Hackathon | Theme: Build it Forward | March 10–11, 2026

---

## 1. Executive Summary

LonghorNet is an AI-powered platform that deploys autonomous browser agents to handle tedious, time-sensitive tasks that every UT Austin student faces: finding and applying to scholarships, snagging open course seats during registration, and automating any repetitive web workflow. The platform runs persistent agents in the background using Browser Use Cloud, surfaces action items on a clean dashboard built with Next.js and Convex, and lets students stay focused on what actually matters.

This project directly addresses the hackathon's "Build it Forward" theme: these are problems every future Longhorn will face, and the platform is designed to outlive any single cohort.

---

## 2. Problem Statement

### 2.1 Scholarship Discovery and Application

UT students miss thousands of dollars in scholarship money every year. Scholarships are scattered across dozens of portals, each with different deadlines, eligibility criteria, and application forms. Students either don't find relevant opportunities in time or abandon applications that require repetitive data entry.

### 2.2 Course Registration

Getting into high-demand courses is a frustrating lottery. Students resort to manually refreshing the registration page every few minutes, sometimes for days. A single missed opening can derail an entire semester's schedule.

### 2.3 Repetitive Web Workflows

Beyond scholarships and registration, students constantly deal with repetitive browser tasks — checking reimbursement statuses, monitoring org applications, filling recurring forms. There's no easy way to automate these without writing code.

---

## 3. Solution Overview

LonghorNet provides three core capabilities through a unified dashboard:

| Feature | What It Does | How It Works |
|---------|-------------|--------------|
| **ScholarBot** | Continuously monitors scholarship portals, matches opportunities to your profile, auto-fills applications, and pauses for missing info (essays, specific details) — resuming once you provide it. | Browser Use Cloud agent runs on a schedule, scrapes scholarship sites, matches against user profile stored in Convex, fills forms autonomously, creates dashboard prompts for human-required inputs. |
| **RegBot** | Monitors UT's real registration system every 10 minutes for specified courses. When a seat opens, it auto-registers you instantly. | Browser Use Cloud agent authenticates via stored UT EID credentials, polls the registration page on interval, detects open seats, and executes the registration flow including Duo 2FA handling. |
| **FlowForge** | Describe any repetitive browser task in natural language and the platform generates, deploys, and runs a custom agent for you. | User describes workflow in plain English. An LLM generates a Browser Use agent script. The system validates, deploys, and schedules it — with monitoring and retry logic built in. |

---

## 4. Target Users

**Primary:** UT Austin undergraduate and graduate students who deal with scholarship applications, course registration bottlenecks, and repetitive campus web tasks.

**Secondary:** Student organization leaders managing forms, applications, and administrative web workflows on behalf of their groups.

---

## 5. Technical Architecture

### 5.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend / DB | Convex (real-time database, serverless functions, cron jobs, file storage) |
| Agent Runtime | Browser Use Cloud API (hosted headless browser agents) |
| Auth | Convex Auth with UT SSO (SAML/OAuth) + email/password fallback |
| AI / LLM | OpenAI GPT-4o via Codex for agent script generation, profile matching, and essay assistance |
| Scheduling | Convex cron jobs for polling intervals; Browser Use Cloud task scheduling |
| Deployment | Vercel (frontend), Convex Cloud (backend) |

### 5.2 System Architecture

The platform follows a three-layer architecture:

1. **Presentation Layer (Next.js):** Dashboard UI with real-time updates via Convex subscriptions. Displays agent statuses, pending actions, scholarship matches, and registration monitors. Includes the FlowForge natural language workflow builder.

2. **Orchestration Layer (Convex):** Serverless functions manage agent lifecycle — creation, scheduling, state persistence, and user notification. Cron jobs trigger polling agents (RegBot every 10 min, ScholarBot hourly). Convex mutations handle user responses to prompts and resume paused agents.

3. **Agent Execution Layer (Browser Use Cloud):** Headless browser instances execute autonomous web interactions. Each agent receives a task definition, runs against live websites, reports results back to Convex via webhooks, and handles errors with retry logic.

### 5.3 Data Model (Convex Schema)

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `users` | name, email, eid, authMethod, profileData (GPA, major, demographics, interests), createdAt | User identity and profile for scholarship matching and agent personalization. |
| `agents` | userId, type (scholar\|reg\|custom), status (active\|paused\|completed\|error), config, lastRunAt, nextRunAt, browserUseTaskId | Tracks every deployed agent instance, its schedule, and current state. |
| `scholarships` | title, source, deadline, eligibility, matchScore, status (found\|applying\|paused\|submitted), agentId, missingFields[] | Discovered scholarships with match scoring and application progress. |
| `registrationMonitors` | userId, courseNumber, uniqueId, semester, status (watching\|registered\|failed), pollInterval, agentId | Courses the user wants to watch, linked to a polling RegBot agent. |
| `pendingActions` | userId, agentId, type (essay\|detail\|confirmation), prompt, response, resolvedAt | Human-in-the-loop items: essays, missing details, confirmations the agent needs before resuming. |
| `customWorkflows` | userId, description (natural language), generatedScript, schedule, agentId, status | User-defined workflows from FlowForge, with the generated agent code and deployment state. |
| `agentLogs` | agentId, timestamp, event, details, screenshots[] | Audit trail of every agent action for debugging, transparency, and demo. |

---

## 6. Feature Specifications

### 6.1 ScholarBot — Autonomous Scholarship Agent

#### User Flow

1. User completes onboarding profile: GPA, major, classification, demographics, interests, financial need indicators.
2. User enables ScholarBot from the dashboard. Selects scholarship sources to monitor (UT scholarship portal, external databases, departmental pages).
3. Agent runs on an hourly cron schedule. For each source, it opens the page, scrapes new listings, and compares eligibility criteria against the user's profile using GPT-4o.
4. Matching scholarships appear on the dashboard with a match score (0–100%) and auto-populated application fields.
5. Agent begins filling out the application form on the actual scholarship site. When it encounters a field it can't fill (essay prompt, letter of rec, specific question), it pauses and creates a pendingAction.
6. User sees the pending action on their dashboard, provides the missing content (e.g., writes the essay, answers the question), and hits "Resume."
7. Agent picks back up from where it left off, completes and submits the application.

#### Technical Details

- Browser Use Cloud agent initialized with user's profile context and scholarship source URLs.
- Scholarship matching uses GPT-4o function calling: input is eligibility text + user profile, output is a match score and list of required fields.
- Agent state (current page, filled fields, pending questions) persisted in Convex so it can resume after user input.
- Screenshots captured at key steps and stored in Convex file storage for transparency and debugging.
- Rate limiting and polite scraping: randomized delays between page loads, respect for robots.txt.

#### Edge Cases

- Scholarship site changes layout → agent retries with updated selectors; if it fails, flags for manual review.
- Duplicate scholarship detection via URL + title hashing to prevent re-applying.
- Deadline passed before user responds to pending action → mark as expired, notify user.

### 6.2 RegBot — Course Registration Monitor

#### User Flow

1. User searches for a course by department, number, or unique ID.
2. User adds the course to their watchlist and confirms their UT EID credentials are stored (encrypted in Convex).
3. RegBot agent activates: every 10 minutes, it opens UT's registration system, authenticates with the user's EID, navigates to the course, and checks seat availability.
4. If a seat is open, the agent immediately executes the registration flow (add course, confirm, handle Duo 2FA push).
5. User receives a real-time dashboard notification and email confirmation. Agent deactivates for that course.
6. If registration fails (seat taken between check and register), agent logs the attempt and continues polling.

#### Technical Details

- UT EID credentials encrypted at rest in Convex using AES-256. Decrypted only at agent runtime in Browser Use Cloud's sandboxed environment.
- Duo 2FA handling: agent triggers push notification to user's phone. A 60-second timeout window is provided. If no response, retry on next poll cycle.
- Convex cron job triggers the Browser Use Cloud task every 10 minutes. Agent runs are stateless — each run is a fresh browser session.
- Anti-detection: randomized timing jitter (±2 minutes), standard browser fingerprint via Browser Use Cloud.
- Multiple courses can be watched simultaneously with independent agent instances.

#### Edge Cases

- User's schedule has a time conflict → agent detects the registration system's conflict warning, pauses, and creates a pendingAction asking user to confirm or cancel.
- Registration system is down → agent logs the error, backs off with exponential delay, resumes on next cron cycle.
- User already registered (e.g., manually) → agent detects enrolled status and deactivates.

### 6.3 FlowForge — Custom Workflow Builder

#### User Flow

1. User navigates to FlowForge and describes a task in natural language. Example: "Every Monday, check my Handshake account for new internship postings in cybersecurity and save the titles and links to a list on my dashboard."
2. GPT-4o parses the description and generates a structured workflow definition: target URL, actions (navigate, click, extract, fill), schedule, and output format.
3. The system displays a preview of the interpreted workflow: "Every Monday at 9am, open Handshake → filter by Cybersecurity → extract job titles and URLs → save to your dashboard." User confirms or edits.
4. System generates a Browser Use Cloud agent script from the workflow definition.
5. Agent is deployed and scheduled. Results appear on the dashboard. User can pause, edit, or delete at any time.

#### Technical Details

- Two-phase LLM pipeline: (1) GPT-4o with function calling converts natural language to a structured JSON workflow spec, (2) a code generation prompt converts the spec into a Browser Use Cloud-compatible agent script.
- Workflow spec schema includes: trigger (cron expression), steps[] (action type, selector hints, data extraction rules), output (dashboard list, notification, file export).
- Generated scripts are sandboxed in Browser Use Cloud — no access to local filesystem or other users' data.
- Convex stores the workflow definition, generated script, execution history, and extracted data.
- Validation layer: before deployment, the system runs the agent once in a dry-run mode to catch obvious failures (404s, selector mismatches).

#### Edge Cases

- Ambiguous description → LLM asks clarifying questions before generating the workflow.
- Target site requires authentication → system prompts user to securely provide credentials, stored encrypted.
- Generated script fails repeatedly → after 3 consecutive failures, agent pauses and notifies user with error context.

---

## 7. Dashboard UI

### 7.1 Pages and Components

**Landing / Auth Page**
- UT SSO login button (primary) and email/password option (secondary).
- Onboarding wizard for first-time users: collect profile data (name, major, GPA, classification, interests, demographics) for ScholarBot matching.

**Dashboard Home**
- Overview cards: active agents count, pending actions requiring attention, recent agent activity feed.
- Real-time updates via Convex subscriptions — no manual refresh needed.
- Quick-action buttons: "Add Scholarship Monitor," "Watch a Course," "Create Workflow."

**ScholarBot Panel**
- List of discovered scholarships with match scores, deadlines, and statuses (new, applying, paused, submitted, expired).
- Click into a scholarship to see agent progress, filled fields, and any pending action prompts.
- Inline essay editor for pending actions — write your essay right in the dashboard and hit resume.

**RegBot Panel**
- Course watchlist with real-time status indicators (watching, seat detected, registering, registered, failed).
- Add course form: search by department + number or paste unique ID.
- Agent log viewer showing timestamped poll results.

**FlowForge Panel**
- Natural language input area with example prompts.
- Workflow preview and confirmation step.
- List of deployed custom workflows with status, last run, and output data.

**Settings**
- Profile editor (update GPA, major, etc.).
- Credential vault for stored logins (UT EID, Handshake, etc.) with encryption indicators.
- Notification preferences (email, in-app, push).

---

## 8. Security and Privacy

- All stored credentials (UT EID, third-party logins) encrypted with AES-256 at rest in Convex.
- Credentials decrypted only in Browser Use Cloud's sandboxed runtime environment; never exposed to the frontend.
- Browser Use Cloud sessions are ephemeral — no persistent browser state between runs.
- User data isolation: Convex row-level security ensures users can only access their own agents, scholarships, and workflows.
- FlowForge-generated scripts are validated and sandboxed; they cannot access other users' data or make requests outside the defined workflow scope.
- Duo 2FA for registration is always user-initiated (push to phone) — the agent cannot bypass 2FA.
- All agent actions are logged with timestamps and screenshots for full auditability.
- HTTPS everywhere. Convex's built-in transport encryption for all data in transit.

---

## 9. Codex Development Strategy

This section outlines how the team will leverage OpenAI Codex with parallel agents and worktrees to maximize development velocity — directly addressing the "Codex App" judging criteria (25%).

### 9.1 Parallel Agent Architecture

Three Codex agents run simultaneously in separate worktrees:

| Agent | Scope | Worktree Branch |
|-------|-------|----------------|
| Frontend Agent | Next.js pages, React components, Tailwind styling, dashboard UI, FlowForge input interface. | `feature/frontend` |
| Backend Agent | Convex schema, mutations, queries, cron jobs, auth setup, credential encryption utilities. | `feature/backend` |
| Agent Orchestration | Browser Use Cloud integration, ScholarBot/RegBot/FlowForge agent scripts, LLM pipeline for workflow generation. | `feature/agents` |

### 9.2 Codex Skills Utilized

- **Code generation:** Scaffold entire Convex schema, Next.js page structure, and Browser Use agent templates from natural language specs.
- **Debugging and iteration:** Each agent iterates independently — fixing TypeScript errors, adjusting Convex queries, refining agent scripts — without blocking others.
- **Non-technical tasks:** Codex generates this PRD, pitch deck content, demo script, and README documentation in parallel with code development.
- **Testing:** Dedicated Codex tasks for writing unit tests for Convex functions and integration tests for agent workflows.

---

## 10. MVP Scope and Hackathon Timeline

Given the submission deadline of 10:00 AM on March 11 (approximately 16.5 hours from event start), the following prioritization applies:

### 10.1 Must-Have (MVP)

- User auth (email/password minimum; UT SSO stretch).
- Profile onboarding flow with core fields for scholarship matching.
- ScholarBot: at least one scholarship source monitored, matching logic, auto-fill with pause/resume for missing fields.
- RegBot: real UT registration system polling and auto-registration for at least one course.
- Dashboard with real-time agent status, pending actions, and basic agent logs.
- Working live demo of both ScholarBot and RegBot end-to-end.

### 10.2 Should-Have

- FlowForge MVP: natural language input → generated agent script → one successful deployment.
- UT SSO integration.
- Email notifications for key events (registered, scholarship submitted).
- Agent log viewer with screenshots.

### 10.3 Nice-to-Have

- Multiple scholarship sources.
- Workflow template library in FlowForge.
- Mobile-responsive dashboard.
- Agent analytics (success rates, average time to register).

### 10.4 Timeline

| Time Block | Focus |
|-----------|-------|
| 5:30 – 6:00 PM | Team formation, Codex setup, repo init, worktree branches created. |
| 6:00 – 8:30 PM | Parallel Codex agents: Frontend scaffolding, Convex schema + auth, Browser Use Cloud integration. Core ScholarBot and RegBot agent scripts. |
| 8:30 PM – 12:00 AM | Feature integration. ScholarBot end-to-end flow. RegBot polling and registration flow. Dashboard real-time updates. |
| 12:00 – 4:00 AM | FlowForge MVP. Edge case handling. Bug fixes. Agent logging and screenshots. |
| 4:00 – 8:00 AM | Polish UI. End-to-end testing. Demo rehearsal. Pitch deck and demo script. |
| 8:00 – 10:00 AM | Final testing, submission prep, and submit by 10:00 AM deadline. |

---

## 11. Demo and Pitch Strategy

The presentation (Wednesday 12:00–1:00 PM) should follow this structure:

1. **Problem hook (1 min):** "How many of you have lost a scholarship because you didn't find it in time? How many have spam-refreshed registration for hours?"
2. **Live demo (4–5 min):** Show ScholarBot discovering and starting an application, pausing for an essay, then resuming. Show RegBot detecting an open seat and registering. If FlowForge is ready, show a custom workflow being created from natural language.
3. **Codex story (2 min):** Walk through how three parallel Codex agents built different layers simultaneously. Show the worktree structure and how it enabled velocity.
4. **Architecture and impact (1–2 min):** Quick architecture slide. Explain how this outlives the hackathon — every new student class faces these problems. Convex real-time backend means it scales naturally.
5. **Q&A (1–2 min)**

---

## 12. Success Metrics

- ScholarBot successfully discovers, matches, and begins filling at least one real scholarship application.
- RegBot successfully detects an open seat and auto-registers on the real UT system.
- FlowForge generates and deploys at least one custom workflow from natural language.
- Dashboard shows real-time agent updates with sub-second latency (Convex subscriptions).
- All three features demonstrated live during the pitch with a working implementation.
- Codex parallel development story is clearly documented and demonstrated.

---

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| UT registration system blocks automated access | RegBot demo fails. | Use standard Browser Use Cloud fingerprint. Implement polite polling (10 min intervals). Have a recorded backup demo as fallback. |
| Duo 2FA push times out during demo | Registration can't complete live. | Have phone ready with Duo app open. Practice the timing. Show successful log from a prior run if live fails. |
| Browser Use Cloud rate limits or downtime | All agents fail. | Cache successful agent run results in Convex. Show cached results as fallback. Contact Browser Use support pre-event. |
| Scholarship site layout changes | ScholarBot can't parse listings. | Target stable, well-structured sources first (UT's official portal). Agent uses LLM-based element detection, not brittle CSS selectors. |
| Scope creep — FlowForge too ambitious | MVP incomplete. | FlowForge is Should-Have, not Must-Have. Cut to a single hardcoded workflow demo if needed. ScholarBot + RegBot are the priority. |

---

*Hook 'em. Build it forward.*
