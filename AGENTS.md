# Baited Workflow Builder POC - Agent Manifest

Read this file first when working on this repository. It is the project knowledge base: it summarizes the goal, architecture, commands, data model, implemented features, constraints, and known tradeoffs.

## Project Goal

This repository is a fullstack POC for Baited.io's workflow feature.

The requested product idea is a visual workflow builder for advanced campaign automation:

- users can move predefined blocks on a canvas;
- users can connect blocks into a directed acyclic graph;
- users can configure internal block variables;
- users can create branching paths such as `if`, `else if`, `else`;
- the application sends a mock API payload to persist the workflow structure.

The POC focuses on interaction, UX/UI, workflow modeling, validation, and persistence. It does not implement real campaign execution.

## Current Stack

Frontend:

- Next.js 15
- React 19
- TypeScript
- React Flow / `@xyflow/react`
- Tailwind CSS
- Lucide React

Backend:

- FastAPI
- Pydantic
- SQLModel
- SQLAlchemy
- Psycopg 3
- PostgreSQL
- Uvicorn

Infra/dev:

- Docker Compose file is present.
- Manual local setup is supported.
- PostgreSQL is expected at `localhost:5432` unless overridden.
- Public POC deployment uses Vercel for the frontend, Render for the backend, and Supabase PostgreSQL via Shared Pooler.

## Important URLs

Frontend:

```txt
http://127.0.0.1:3000/workflows/demo
https://baited-workflows.vercel.app/workflows/demo
```

Backend docs:

```txt
http://127.0.0.1:8000/docs
https://baited-workflows-backend.onrender.com/docs
```

Backend health:

```txt
http://127.0.0.1:8000/api/health
https://baited-workflows-backend.onrender.com/api/health
```

GitHub:

```txt
https://github.com/Mieti/Baited-Workflows
```

## Run Commands

From repository root:

```powershell
cd C:\Users\Riccardo\Documents\Projects\Baited-POC
```

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend, in another terminal:

```powershell
cd frontend
npm run dev -- --port 3000
```

If backend environment must be recreated:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If backend dev tools are needed:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Frontend install:

```powershell
cd frontend
npm install
npm run dev -- --port 3000
```

## PostgreSQL Requirements

Manual setup expects:

```txt
database: baited_workflows
user: baited
password: baited
```

Default connection string:

```txt
postgresql+psycopg://baited:baited@localhost:5432/baited_workflows
```

The `.env.example` file documents:

```env
DATABASE_URL=postgresql+psycopg://baited:baited@localhost:5432/baited_workflows
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CORS_ORIGIN_REGEX=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Production deployment uses:

```txt
NEXT_PUBLIC_API_URL=https://baited-workflows-backend.onrender.com
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
```

## Docker

Docker Compose exists but Docker may not be installed locally.

```bash
docker compose up --build
```

Compose services:

- `postgres`
- `backend`
- `frontend`

## Repository Structure

```txt
Baited-POC/
  backend/
    app/
      api/routes.py
      core/config.py
      db/session.py
      models/workflow.py
      schemas/workflow.py
      services/blocks.py
      services/demo.py
      services/validation.py
    tests/
      test_validation.py
    Dockerfile
    pyproject.toml

  frontend/
    src/
      app/
      components/workflow/
        useWorkflowHistory.ts
      lib/api/
      lib/workflow/
    Dockerfile
    eslint.config.mjs
    package.json

  docker-compose.yml
  README.md
  POC_REPORT.md
  AGENTS.md
```

## Frontend Architecture

Core screen:

```txt
TopBar
NodePalette | WorkflowCanvas | NodeInspector
BottomPanel
```

Key files:

- `frontend/src/components/workflow/WorkflowBuilder.tsx`
- `frontend/src/components/workflow/NodePalette.tsx`
- `frontend/src/components/workflow/NodeInspector.tsx`
- `frontend/src/components/workflow/BottomPanel.tsx`
- `frontend/src/components/workflow/TopBar.tsx`
- `frontend/src/components/workflow/useWorkflowHistory.ts`
- `frontend/src/components/workflow/useWorkflowToasts.ts`
- `frontend/src/components/workflow/nodes/WorkflowNode.tsx`

Workflow utilities:

- `frontend/src/lib/workflow/types.ts`
- `frontend/src/lib/workflow/catalog.ts`
- `frontend/src/lib/workflow/demo.ts`
- `frontend/src/lib/workflow/transform.ts`
- `frontend/src/lib/workflow/validation.ts`

API client:

- `frontend/src/lib/api/client.ts`

## Frontend Behavior

Implemented:

- visual canvas with React Flow;
- dark n8n-inspired interface;
- node palette grouped by category;
- drag/drop block creation;
- click-to-add block creation;
- node selection and inspector editing;
- rectangle multi-selection on the canvas;
- group movement for selected nodes;
- bulk deletion of selected nodes/branches;
- undo with `Ctrl+Z` and toolbar button for canvas/workflow edits;
- edge selection and branch editing;
- node deletion;
- edge deletion;
- automatic cleanup of connected edges when a node is deleted;
- cycle prevention when connecting nodes;
- validation tab;
- payload preview tab;
- submission log tab;
- loading overlays plus production-style toast notifications for significant async results and errors;
- saved viewport in `layout.viewport`;
- CORS support for both `localhost` and `127.0.0.1`.

Important notes:

- Semantic edits invalidate previous validation.
- Node position edits are undoable layout edits.
- Viewport edits, such as pan/zoom, mark the workflow as unsaved and are persisted in `layout.viewport`, but are not tracked by undo.

## Backend Architecture

Key files:

- `backend/app/main.py`
- `backend/app/api/routes.py`
- `backend/app/core/config.py`
- `backend/app/db/session.py`
- `backend/app/models/workflow.py`
- `backend/app/schemas/workflow.py`
- `backend/app/services/blocks.py`
- `backend/app/services/demo.py`
- `backend/app/services/validation.py`

Responsibilities:

- FastAPI exposes REST endpoints.
- Pydantic validates API payload shapes.
- Custom validator checks workflow logic.
- SQLModel/SQLAlchemy persist workflow metadata and JSONB payloads.
- Psycopg 3 is the PostgreSQL driver.

## Data Model

Persistence separates semantic workflow data from UI layout.

Workflow payload:

```json
{
  "definition": {
    "schemaVersion": 1,
    "nodes": [],
    "edges": []
  },
  "layout": {
    "nodes": {},
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

Tables:

- `workflows`
- `workflow_versions`
- `workflow_submissions`

JSONB fields:

- `workflow_versions.definition`
- `workflow_versions.layout`
- `workflow_versions.validation_result`
- `workflow_submissions.payload`

## Available Workflow Blocks

Entry:

- `campaign_entrypoint`

Campaign Actions:

- `create_campaign`
- `send_message`
- `start_awareness_campaign`

Target Management:

- `add_target_to_group`
- `start_osint_on_targets`

Logic:

- `wait_for_event`
- `condition`

End States:

- `mark_low_risk`
- `mark_medium_risk`
- `mark_high_risk`

## Demo Workflow

The demo scenario is:

```txt
Campaign Start
  -> Create Email Campaign
  -> Wait 48h For Event
  -> Condition: Email opened?
      opened -> Mark Low Risk
      not_opened -> Send SMS
        -> Wait 24h For Credentials
        -> Condition: Credentials submitted?
            credentials_submitted -> Add To High Risk Group
              -> Start Awareness Campaign
              -> Mark High Risk
            not_submitted -> Mark Medium Risk
```

## API Endpoints

```txt
GET  /api/health
GET  /api/workflow-blocks
GET  /api/workflows/demo
GET  /api/workflows
POST /api/workflows
GET  /api/workflows/{workflow_id}
PUT  /api/workflows/{workflow_id}
POST /api/workflows/validate
POST /api/workflows/{workflow_id}/validate
POST /api/workflows/{workflow_id}/submit
GET  /api/workflows/{workflow_id}/submissions
```

## Validation Rules

Backend validation is authoritative.

Rules:

- workflow must not be empty;
- node ids must be unique;
- exactly one `campaign_entrypoint`;
- at least one risk end-state node;
- known node types only;
- edges must reference existing source and target nodes;
- edge branches must be allowed by source node type;
- terminal nodes cannot have outgoing edges;
- required params must be present;
- `select` params must match catalog options;
- `number` params must be finite numbers;
- `text` params must be strings;
- branch labels cannot be duplicated from the same source;
- `condition` nodes need at least two outgoing branches;
- non-condition action nodes with multiple outputs emit warnings;
- nodes without incoming edges emit warnings, except the entrypoint;
- nodes unreachable from entrypoint emit warnings;
- graph must be acyclic.

Frontend fallback validation mirrors the main backend rules, but backend remains the source of truth.

## Verification Commands

Frontend:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m compileall app tests
.\.venv\Scripts\python.exe -m pip check
```

API smoke:

```powershell
curl.exe -s http://127.0.0.1:8000/api/health
curl.exe -s http://127.0.0.1:8000/api/workflows/demo
```

CORS smoke:

```powershell
curl.exe -s -D - -o NUL -X OPTIONS -H "Origin: http://127.0.0.1:3000" -H "Access-Control-Request-Method: POST" http://127.0.0.1:8000/api/workflows/validate
```

## Known Limits

Accepted POC limits:

- no authentication;
- no authorization;
- no multi-tenancy;
- no scheduler;
- no real campaign execution;
- no real email/SMS/IM dispatch;
- no real OSINT integration;
- no redo;
- no confirmation before deleting nodes or edges;
- backend versioning creates a new version on each `PUT`, even if payload is identical;
- no Alembic migrations yet, so model constraints are applied automatically only on fresh tables;
- no automated browser end-to-end test suite yet.

## Recently Fixed Review Items

Fixed:

- stale frontend validation after edits;
- incomplete CORS for `127.0.0.1`;
- non-persisted viewport;
- missing edge branch inspector;
- mismatch between frontend fallback validation and backend validation.
- weak block parameter validation for `select`, `number`, and `text`;
- silent API fallback on backend HTTP errors;
- demo workflow lookup keyed only by mutable name;
- submissions endpoint returning an empty list for missing workflow ids;
- undo/history logic extracted from the main builder component;
- frontend lint tooling updated for ESLint flat config;
- unused `zod` dependency removed;
- backend package discovery fixed for dev installs;
- backend validator unit tests added.
- async toast state extracted from the main builder component;
- initial workflow load keeps controls disabled until viewport restore and history readiness are complete;
- optional saved-workflow validation payload check made explicit with `is not None`.

## Guidance For Future Changes

When modifying the workflow model:

- update both frontend and backend catalogs if block shape changes;
- update `frontend/src/lib/workflow/types.ts`;
- update `backend/app/schemas/workflow.py`;
- update frontend and backend validation rules;
- update `POC_REPORT.md` and this file.

When modifying UI interactions:

- keep the builder canvas-first;
- avoid adding marketing or landing-page UI;
- keep blocks domain-specific to Baited workflows;
- preserve separation between `definition` and `layout`;
- keep backend validation authoritative.

When running builds:

- stop `next dev` before `npm run build` to avoid `.next/trace` lock issues on Windows.
