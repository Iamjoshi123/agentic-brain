# Backend

## Purpose

The backend is the control plane and runtime for the product-demo system. It does five jobs:

1. stores products, knowledge, sessions, and admin state
2. plans how the agent should respond
3. drives the live browser
4. coordinates voice/video for live demos
5. produces session summaries, citations, and review artifacts for admins

The backend is deliberately additive. The newer admin console and V2 meeting flow were layered on top of the original workspace/session APIs so older public links and seeded demos keep working.

## Stack

- FastAPI for HTTP and WebSocket APIs
- SQLModel + SQLAlchemy for persistence
- SQLite by default for local development
- Qdrant for vector retrieval when available
- Playwright for browser automation
- Stagehand bridge as an optional higher-level browser action layer
- LiveKit for live room coordination and media publishing
- faster-whisper for local video transcription
- Ollama, OpenAI, Anthropic, OpenRouter, or Bedrock for text generation

Core entrypoint:

- `backend/app/main.py`

## High-Level Architecture

There are three overlapping backend surfaces:

### 1. Legacy workspace/session API

This is the original CRUD and demo engine surface:

- `/api/workspaces`
- `/api/sessions`
- `/api/documents`
- `/api/credentials`
- `/api/recipes`
- `/api/policies`
- `/api/analytics`
- `/api/retrieval`

This path still powers the classic `/demo/[token]` experience.

### 2. Admin platform API

This is the product-centric control plane:

- `/api/admin/auth/*`
- `/api/admin/dashboard`
- `/api/admin/products/*`
- `/api/admin/sessions/*`
- `/api/admin/embed-share`
- `/api/admin/branding`
- `/api/admin/settings/*`

Internally, "product" is still backed by the existing `Workspace` model. That was a conscious compatibility decision so public demo tokens and seeded data did not need to be rewritten.

### 3. V2 meeting API

This is the newer guided live-demo experience:

- `/api/v2/meetings/*`

It creates a meeting record, personalizes the demo, boots the live runtime, and streams runtime events to the frontend over WebSocket.

## Folder Map

The simplest way to think about the backend now is:

- `app/api`: the server surface
- `app/agent`: the smart demo layer
- everything else: the current implementation behind those boundaries

### `backend/app/api`

HTTP route handlers for:

- legacy workspace CRUD
- admin auth and admin console data
- sessions and live controls
- analytics and retrieval

This should be the stable entrypoint the frontend talks to.

### `backend/app/agent`

Phase-1 agent boundary:

- `browser.py`: agent-facing browser actions
- `events.py`: runtime event stream
- `orchestration.py`: meeting/demo orchestration
- `pipeline.py`: turn pipeline
- `planning.py`: answer/demo planning
- `runtime.py`: live runtime registry
- `types.py`: shared turn data
- `voice.py`: voice entrypoint

Today these files mainly re-export the current implementation. That is intentional: it creates one clean home for agent code before a later deeper refactor.

### `backend/app/models`

SQLModel tables for:

- core demo entities such as `Workspace`, `Document`, `Credential`, `DemoRecipe`, `PolicyRule`, `DemoSession`
- admin platform entities such as `Organization`, `AdminUser`, `Membership`, `ProductConfig`, `KnowledgeSource`, `SessionRecording`

### `backend/app/services`

Core service layer:

- `planner.py`: legacy answer/demo planner
- `llm.py`: provider selection and fallback logic
- `admin_auth.py`: bootstrap admin, password hashing, cookie session auth, RBAC
- `admin_platform.py`: share links, knowledge ingestion helpers, citations, uploads
- `encryption.py`: Fernet-based secret storage

### `backend/app/browser`

Browser execution layer:

- session start/stop
- recipe execution
- direct action execution
- driver lifecycle
- optional Stagehand bridge integration

### `backend/app/live`

Live runtime layer:

- room/token creation
- media publisher lifecycle
- event broker
- live runtime state machine
- browser telemetry publishing

### `backend/app/retrieval`

Knowledge ingestion and search:

- chunking
- embedding generation
- vector storage
- DB fallback retrieval

### `backend/app/v2`

Rebuilt meeting experience:

- V2 API
- meeting models
- language handling
- orchestrator
- runtime bridge between meeting records and the live session runtime

### `backend/app/runtime_v3`

The deeper inspection pipeline used by the V2 orchestrator. It is the newer reasoning layer that combines intent, observation, retrieval, and action planning.

## Main Data Model

### Core demo entities

- `Workspace`: canonical product/demo container
- `Document` and `DocumentChunk`: retrieval corpus and chunk index
- `Credential`: encrypted sandbox login material
- `DemoRecipe`: structured walkthrough steps
- `PolicyRule`: hard guardrails and escalation rules
- `DemoSession`: runtime session for classic demos and live browser sessions
- `SessionMessage`: transcript entries
- `BrowserAction`: executed browser telemetry/action audit
- `SessionSummary`: generated post-session insights

### Admin platform entities

- `Organization`, `AdminUser`, `Membership`, `AuthSession`
- `BillingAccount`, `BrandingSettings`, `ApiCredentialSet`
- `ProductConfig`: agent persona and response behavior
- `ProductSessionSettings`: welcome flow, time limit, recording toggle
- `ProductShareSettings`: share title and description
- `KnowledgeSource`: unified source registry for docs, files, videos, and custom entries
- `KnowledgeJob`: ingestion job tracking
- `SessionRecording`: replay artifact metadata

### V2 meeting entities

- `MeetingSessionV2`
- `MeetingMessageV2`

These are not a replacement for `DemoSession`. A V2 meeting eventually binds to a runtime `DemoSession` when live media starts.

## Request and Runtime Flow

### Admin product setup

1. Admin signs in through `/api/admin/auth/login`.
2. Admin creates or edits a product.
3. Backend ensures companion config rows exist:
   - `ProductConfig`
   - `ProductSessionSettings`
   - `ProductShareSettings`
4. Admin adds knowledge sources.
5. Each source becomes:
   - `KnowledgeSource`
   - `KnowledgeJob`
   - `Document`
   - `DocumentChunk[]`
   - optional Qdrant vectors

### Classic `/demo/[token]` flow

1. Frontend creates a `DemoSession` using the workspace public token.
2. Buyer sends text messages.
3. `plan_response()` in `backend/app/services/planner.py` decides:
   - `answer_only`
   - `answer_and_demo`
   - `clarify`
   - `escalate`
   - `refuse`
4. Planner uses:
   - policy engine
   - recipe matching
   - retrieval search
   - optional live page state from the active browser
5. If the session becomes live, the browser runtime publishes media and events through LiveKit and the event broker.

### V2 `/meet/[token]` flow

1. Frontend creates a `MeetingSessionV2`.
2. Backend stores buyer context and emits a localized welcome message.
3. Frontend prepares voice and browser plan, then calls `/live/start`.
4. Backend creates or reuses a runtime `DemoSession`.
5. `LiveDemoRuntime.start()` boots:
   - Playwright browser session
   - LiveKit buyer and agent participants
   - media publisher
   - browser event stream
6. Buyer turns are processed through `MeetingOrchestrator`, which uses the newer runtime pipeline.
7. Orchestrator returns:
   - reply text
   - citations
   - recipe fallback
   - direct browser instruction
   - action strategy
8. Live runtime speaks the answer and either:
   - executes a direct browser instruction
   - queues a structured recipe
   - does answer-only behavior

## Knowledge and Retrieval Flow

Unified source types:

- `help_doc_url`
- `video`
- `file`
- `custom_entry`

Ingestion path:

1. create `KnowledgeSource`
2. start `KnowledgeJob`
3. normalize content into a `Document`
4. chunk text
5. embed chunks
6. upsert vectors to Qdrant if available
7. save chunks in SQL regardless

Important implementation detail:

- Qdrant is optional
- if Qdrant is missing or fails, retrieval falls back to keyword matching over `DocumentChunk`

That fallback is intentional. It keeps local development usable even without standing up the vector store.

## Planning and LLM Strategy

The backend uses two planning layers.

### Legacy planner

`backend/app/services/planner.py`

Good for:

- classic demo sessions
- admin test-agent calls
- simple answer-or-demo decisions

Inputs:

- buyer message
- policy evaluation
- recipe trigger match
- retrieval context
- current browser state, if any

### V2 orchestrator

`backend/app/v2/orchestrator.py`

Good for:

- richer live meeting behavior
- personalized intros
- multilingual handling
- stagehand-first live action planning

It uses the newer runtime inspection pipeline and explicitly follows the "show while telling" policy when the strategy calls for live navigation.

### LLM provider priority

`backend/app/services/llm.py`

Current order:

1. AWS Bedrock if configured
2. OpenRouter if configured
3. OpenAI if configured
4. Anthropic if configured
5. Ollama local fallback

Technical decision:

- the service prefers "some answer" over "provider purity"
- hosted provider failures fall back to local Ollama where possible
- test mode short-circuits generation so backend tests stay deterministic

## Auth and RBAC

Admin auth is backend-owned, not delegated to an external auth provider.

Important files:

- `backend/app/api/admin_auth.py`
- `backend/app/services/admin_auth.py`

Implementation choices:

- password hashing uses PBKDF2-HMAC-SHA256
- session cookies are backed by `AuthSession` rows
- roles are ordered: `viewer < editor < admin < owner`
- the first org and owner are bootstrapped automatically from env vars

Why this shape:

- simple local setup
- no dependency on third-party identity during development
- enough structure to support a real admin console with org-scoped permissions

## Live Browser and Media Decisions

Live runtime is centered on `LiveDemoRuntime` in `backend/app/live/runtime.py`.

Key choices:

- browser execution and media startup are separate async concerns
- runtime publishes fine-grained events through an in-process event broker
- frontend consumes those events through WebSocket
- LiveKit is used for actual media tracks
- browser action telemetry is emitted separately from video so the UI can react even if media is slow

This split is the reason the frontend can detect:

- attaching
- live
- black frames
- errored

without guessing solely from the video element.

## Config and Environment

The backend reads one repo-root `.env` through `backend/app/config.py`.

Important env groups:

- database: `DATABASE_URL`
- retrieval: `QDRANT_URL`, `QDRANT_COLLECTION`
- live media: `LIVEKIT_*`
- LLM providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_*`, `AWS_BEDROCK_*`, `OLLAMA_BASE_URL`
- browser runtime: `PLAYWRIGHT_HEADLESS`, `ENABLE_STAGEHAND`, `STAGEHAND_*`
- voice runtime: `ENABLE_VOICE`, `VOICE_*`, `OPENAI_REALTIME_*`
- admin bootstrap: `ADMIN_BOOTSTRAP_*`
- URLs: `BACKEND_URL`, `FRONTEND_URL`

Important decision:

- `.env` lives at the repo root, not under `backend/`
- both backend and frontend local run conventions assume that shared root config

## Persistence Decisions

Default database is SQLite. This is a deliberate MVP choice.

Why SQLite still works here:

- fast local setup
- easy seeding
- enough for single-node development and acceptance demos

Special handling:

- `check_same_thread=False`
- `NullPool` for SQLite

Reason:

- short-lived concurrent DB sessions from live transcription and runtime work can starve under the default queue pool
- `NullPool` is the safer choice for this local-first workload

Also note:

- `_ensure_sqlite_schema()` applies lightweight schema backfills on startup
- that is a convenience migration layer, not a replacement for a real migration system

## Running Locally

### Minimal backend-only boot

```powershell
cd backend
C:/Python313/python.exe -m pip install -r requirements.txt
C:/Python313/python.exe -m app.seed
C:/Python313/python.exe run.py
```

Backend health:

- `http://127.0.0.1:8000/health`
- docs: `http://127.0.0.1:8000/docs`

### Full local stack

From repo root:

```powershell
npm install
npm run seed:acceptance
```

Then start:

- backend: `cd backend && C:/Python313/python.exe run.py`
- frontend: `cd frontend && npm run dev`

Optional services:

- LiveKit local: `npm run livekit:up`
- Stagehand bridge: `npm run stagehand:bridge`

## Tests

Repo-level scripts:

- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run coverage`
- `npm run sanity`

Backend test categories currently cover:

- API validation and CRUD
- planner and policy behavior
- retrieval behavior
- browser executor integration
- live session API
- voice contract expectations
- admin API behavior

## Recommended Build Order If Rebuilding

If someone had to rebuild this backend from zero, the lowest-risk order is:

1. define the core SQLModel entities around workspace, document, recipe, policy, and session
2. ship plain CRUD APIs for workspaces and documents
3. add ingestion and retrieval
4. add the planner and policy engine
5. add browser execution and recipe playback
6. add live runtime and LiveKit integration
7. add summaries/analytics
8. add the org/admin platform on top
9. add the V2 meeting layer and runtime bridge last

That order matches the actual layering in the repo and explains why some names still say "workspace" even though the admin UI says "product".

## Technical Decisions and Tradeoffs

### Keep `Workspace` as the canonical product record

Pros:

- preserves public tokens and seeded demos
- avoids a risky data-model rewrite
- lets the admin console ship faster

Tradeoff:

- some internals still use "workspace" while the UI says "product"

### Use optional infrastructure, not mandatory infrastructure

Examples:

- Qdrant is optional
- Stagehand is optional
- hosted LLMs are optional
- LiveKit can run local or cloud

Pros:

- easier local development
- fewer blockers in CI and test environments

Tradeoff:

- more fallback code paths to maintain

### Favor event streaming over polling for live state

The live runtime publishes session events directly to a broker and WebSocket subscribers.

Pros:

- frontend gets immediate state changes
- easier to coordinate live demo controls

Tradeoff:

- more async concurrency to reason about

### Keep admin auth inside FastAPI

Pros:

- one deployment unit
- easier local onboarding
- direct control over org-scoped permissions

Tradeoff:

- auth lifecycle, cookie policy, and hardening remain an application responsibility

## Current Constraints

- SQLite is fine for local and small hosted deployments, but not the long-term multi-tenant answer
- there is no full migration framework yet; startup backfills help but are not enough forever
- media recording is modeled in the schema and admin detail API, but full mixed export quality depends on the live media pipeline implementation
- knowledge ingestion is synchronous in the request path today; `KnowledgeJob` tracks progress, but the job runner is still in-process rather than external

## Where To Extend Safely

Add new behavior in these layers:

- new admin product settings: `backend/app/models/admin.py` and `backend/app/api/admin.py`
- new retrieval behavior: `backend/app/retrieval/*`
- new live runtime events: `backend/app/live/runtime.py`
- new meeting reasoning policies: `backend/app/v2/orchestrator.py` and `backend/app/runtime_v3/*`
- new provider integrations: `backend/app/services/llm.py`

Avoid rewriting these boundaries unless necessary:

- public token semantics
- `Workspace` to product mapping
- `DemoSession` as the runtime anchor for live browser sessions
