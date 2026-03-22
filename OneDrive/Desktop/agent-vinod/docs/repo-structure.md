# Recommended Repo Structure

Keep one monorepo and split it into three simple parts:

- `frontend/`: the website users open
- `backend/app/api`: the main server API
- `backend/app/agent`: the smart demo/automation layer

## Phase 1

This repo now uses a safe first step:

- `backend/app/agent/browser.py`
- `backend/app/agent/events.py`
- `backend/app/agent/orchestration.py`
- `backend/app/agent/pipeline.py`
- `backend/app/agent/planning.py`
- `backend/app/agent/runtime.py`
- `backend/app/agent/types.py`
- `backend/app/agent/voice.py`

These files give the agent one clear home without forcing a risky full rewrite.

## Simple Folder Map

```text
frontend/
  src/
    app/
    components/
    lib/
backend/
  app/
    api/
    agent/
    browser/
    live/
    models/
    policies/
    retrieval/
    runtime_v3/
    services/
    voice/
stagehand-bridge/
infra/
fixtures/
docs/
```

## What To Do Later

When the product flow is more stable:

1. move more live-demo code behind `app.agent.*`
2. stop using in-memory runtime/event state
3. only then consider a separate deployable `agent` service
