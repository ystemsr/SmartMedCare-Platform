# SmartMedCare Platform

> Intelligence Medical & Elderly Care Big Data Public Service Platform

## Project Overview

A unified smart medical-elderly care data service platform that integrates medical and elderly care resources for efficient coordination and management. It provides data collection, analysis, health assessment, and early warning intervention services for government agencies, medical institutions, and elderly care facilities.

## Tech Stack

| Layer           | Technology                           |
| --------------- | ------------------------------------ |
| Backend         | Python 3.12+ / FastAPI               |
| Frontend        | React 18 + TypeScript + Vite         |
| Database        | MySQL 8.0 (primary), Redis (cache)   |
| Big Data        | Hadoop / HDFS / Spark / Flink / Hive |
| Data Processing | NumPy, Pandas, PySpark               |
| Object Storage  | MinIO (S3-compatible OSS)            |
| Nginx           | For frontend static file serving     |
| Deployment      | K3s on Linux                         |

## Core Modules

1. Doctor Service System
   - Login & authentication
   - Doctor workbench
   - Health assessment
   - Risk alerts
   - Follow-up management
   - Intervention records

2. Elderly Health Management System
   - Elderly basic information management
   - Elderly account management
   - Health records management
   - Medical and care records management
   - Health data collection

3. Data Processing & Analysis System
   - Data cleaning and preprocessing
   - Data integration and storage
   - Multi-dimensional statistical analysis
   - Risk analysis / simple modeling
   - Data visualization and reporting

4. System Administration & Operations
   - User / role / permission management
   - System configuration management
   - Logging and audit
   - Monitoring and maintenance

## Code Structure

```
SmartMedCare-Platform/
├─ README.md
├─ .env.example
├─ .gitignore
├─ docker-compose.yml
├─ docs/
│  ├─ architecture.md
│  ├─ api-design.md
│  ├─ db-design.md
│  ├─ deployment.md
│  └─ modules/
│     ├─ auth.md
│     ├─ elder-health-archive.md
│     ├─ health-warning.md
│     ├─ followup.md
│     ├─ intervention.md
│     ├─ assessment.md
│     └─ account.md
├─ scripts/
│  ├─ dev-up.sh
│  ├─ dev-down.sh
│  ├─ logs.sh
│  └─ backup-minio.sh
├─ deploy/
│  └─ mysql/
│     └─ init/
│        └─ 001_init.sql
├─ backend/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ migration.py
│  ├─ alembic.ini
│  ├─ alembic/
│  │  ├─ env.py
│  │  ├─ script.py.mako
│  │  └─ versions/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ database.py
│  │  │  ├─ redis_client.py
│  │  │  ├─ minio_client.py
│  │  │  ├─ security.py
│  │  │  ├─ logger.py
│  │  │  └─ deps.py
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     ├─ router.py
│  │  │     └─ endpoints/
│  │  │        ├─ auth.py
│  │  │        ├─ users.py
│  │  │        ├─ roles.py
│  │  │        ├─ elders.py
│  │  │        ├─ health_archives.py
│  │  │        ├─ alerts.py
│  │  │        ├─ followups.py
│  │  │        ├─ interventions.py
│  │  │        ├─ assessments.py
│  │  │        ├─ files.py
│  │  │        ├─ dashboard.py
│  │  │        └─ health.py
│  │  ├─ models/
│  │  │  ├─ __init__.py
│  │  │  ├─ base.py
│  │  │  ├─ user.py
│  │  │  ├─ role.py
│  │  │  ├─ elder.py
│  │  │  ├─ health_archive.py
│  │  │  ├─ alert.py
│  │  │  ├─ followup.py
│  │  │  ├─ intervention.py
│  │  │  ├─ assessment.py
│  │  │  ├─ file_record.py
│  │  │  └─ audit_log.py
│  │  ├─ schemas/
│  │  ├─ repositories/
│  │  ├─ services/
│  │  ├─ tasks/
│  │  └─ utils/
│  └─ tests/
│     ├─ test_auth.py
│     ├─ test_elders.py
│     └─ test_alerts.py
├─ frontend/
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ tsconfig.json
│  ├─ vite.config.ts
│  ├─ nginx/
│  │  └─ default.conf
│  ├─ public/
│  │  └─ favicon.ico
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ router/
│     │  └─ index.tsx
│     ├─ api/
│     │  ├─ http.ts
│     │  ├─ auth.ts
│     │  ├─ elders.ts
│     │  ├─ alerts.ts
│     │  ├─ followups.ts
│     │  ├─ interventions.ts
│     │  ├─ assessments.ts
│     │  └─ files.ts
│     ├─ store/
│     │  ├─ auth.ts
│     │  └─ app.ts
│     ├─ layouts/
│     │  ├─ BasicLayout.tsx
│     │  └─ BlankLayout.tsx
│     ├─ components/
│     │  ├─ AppTable.tsx
│     │  ├─ AppForm.tsx
│     │  ├─ UploadFile.tsx
│     │  └─ StatCard.tsx
│     ├─ pages/
│     │  ├─ login/
│     │  │  └─ LoginPage.tsx
│     │  ├─ dashboard/
│     │  │  └─ DashboardPage.tsx
│     │  ├─ elders/
│     │  │  ├─ ElderListPage.tsx
│     │  │  ├─ ElderDetailPage.tsx
│     │  │  └─ ElderArchivePage.tsx
│     │  ├─ alerts/
│     │  │  ├─ AlertListPage.tsx
│     │  │  └─ AlertDetailPage.tsx
│     │  ├─ followups/
│     │  │  ├─ FollowupPlanPage.tsx
│     │  │  └─ FollowupRecordPage.tsx
│     │  ├─ interventions/
│     │  │  └─ InterventionPage.tsx
│     │  ├─ assessments/
│     │  │  └─ AssessmentPage.tsx
│     │  ├─ accounts/
│     │  │  ├─ ElderAccountPage.tsx
│     │  │  └─ PersonalAccountPage.tsx
│     │  └─ system/
│     │     ├─ UserPage.tsx
│     │     └─ RolePage.tsx
│     ├─ hooks/
│     │  ├─ useTable.ts
│     │  └─ usePermission.ts
│     ├─ utils/
│     │  ├─ storage.ts
│     │  ├─ formatter.ts
│     │  └─ constants.ts
│     ├─ styles/
│     │  ├─ index.css
│     │  └─ reset.css
│     └─ types/
│        ├─ auth.ts
│        ├─ elder.ts
│        └─ alert.ts
├─ data-jobs/
│  ├─ pandas/
│  ├─ spark/
│  ├─ hive/
│  ├─ flink/
│  └─ rules/
└─ tests/
   └─ e2e/
      └─ smoke.http
```

**API documentation is in `docs/api-design.md`, must be followed strictly. All API routes must be defined in `backend/app/api/v1/endpoints/` with a clear separation of concerns.**

---

## Principles

**TALK IS CHEAP, SHOW ME YOUR CODE.**

- Read the docs carefully — never guess APIs in the dark.
- Clarify critical ambiguities before acting; for minor uncertainties, make a reasonable assumption based on existing conventions and note it.
- Reuse what already exists — never invent new APIs for no reason.
- Follow standards and conventions — never break the architecture.
- Say "I don't know" honestly — never pretend to understand.
- Refactor carefully — never make blind edits.
- When confused about UI design or interaction, study how Telegram solves it.

---

## Code Organization & Planning (MANDATORY)

### Plan Before You Code

- Start implementation on a dedicated feature/fix branch.
- Check the current branch first. If you are not already on a feature/fix branch, run:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/xxx
# or
git checkout -b fix/xxx
```

- Branch naming must follow `feat/xxx` for new features and `fix/xxx` for bug fixes.
- Before implementing any non-trivial feature (more than a simple one-file fix), **you MUST create a plan/TODO first**.
- The plan must include:
  1. **Goal** — what the feature/fix achieves.
  2. **Files to create or modify** — list every file path with a one-line description of its responsibility.
  3. **Data flow** — how data moves between layers (API → service → model → DB, or component → hook → API).
  4. **Dependencies** — any new packages or services required.
- When the scope changes mid-implementation, stop and update the plan before continuing.

### No God Files

- **NEVER put all logic into a single file.** Every module, route, service, or component must have a clear single responsibility.
- Backend: separate files for routes, services (business logic), models, schemas, and utils. One router per resource domain (e.g., `doctors.py`, `elderly.py`, `health_records.py`).
- Frontend: one component per file. Separate pages, reusable components, hooks, services, types, and utils into their own directories.
- Shared constants, enums, and type definitions go in dedicated files — not scattered inline.

### Frontend Component Reuse

- **Reuse is mandatory.** Before creating a new component, check if an existing one in `*/components/` already covers the need.
- Extract common UI patterns (tables, forms, modals, cards, search bars, etc.) into reusable components.
- Never duplicate the same UI logic across pages — if two pages share similar structure, abstract it into a shared component or hook.

---

## Development Guidelines

### General

- Use `uv` for all Python virtual environment and package management. **Never use pip directly.**
- Use Conventional Commits specification for all commit messages, written in English only.
- All code comments and documentation should be in English.
- User-facing UI text must be in Simplified Chinese (zh-CN).
- **After every code change, rebuild the affected service image(s) and restart via docker compose** (e.g., `docker compose up -d --build <service>`). A plain `docker compose restart` does not pick up code changes because images are not rebuilt.

### Backend (Python / FastAPI)

- Target Python 3.12+.
- Use Pydantic v2 for request/response schemas and validation.
- Use SQLAlchemy 2.0+ async style for database ORM.
- Use `async def` for all API route handlers.
- API routes follow RESTful conventions with `/api/v1/` prefix.
- Use dependency injection for database sessions, auth, and shared services.
- Environment config via `.env` files loaded through `pydantic-settings`.
- Write type hints for all function signatures.

### Frontend (React + TypeScript)

- Use functional components with hooks only. No class components.
- Strict TypeScript — no `any` types unless absolutely necessary.
- API calls go through a centralized service layer (e.g., axios instance with interceptors).
- Use React Router for routing.
- Keep components small and focused; extract reusable logic into custom hooks.
- **Design style:** All frontend UI or visual design work must use `.agents/anthropic-style/` as the primary design tone and visual language. Additionally, reference other design skills (`.agents/banner-design/`, `.agents/brand/`, `.agents/design/`, `.agents/design-system/`, `.agents/frontend-design/`, `.agents/slides/`, `.agents/ui-styling/`, `.agents/ui-ux-pro-max/`) for supplementary patterns such as layout, spacing, color refinement, and interaction details. When in doubt, `anthropic-style` takes precedence.

### Database

- MySQL 8.0 as the primary relational database.
- Redis for caching, session management, and rate limiting.
- All table and column names use `snake_case`.
- **Required columns for business entity tables:** All business entity tables (users, doctors, health records, etc.) must have `id` (primary key), `created_at`, and `updated_at`. Auxiliary tables (join tables, cache mappings, import staging tables) may omit these when they serve no business purpose.
- **Soft delete for business data:** Business entity tables must use a `deleted_at` timestamp column for deletion. Queries should filter `deleted_at IS NULL` by default. Temporary data, cache mappings, and import staging tables may use physical deletion when soft delete adds no value.
- **Migrations (Alembic):**
  - All schema changes must be introduced through a new Alembic migration. Never modify the database schema manually.
  - One-off or destructive "recreate everything" migrations are forbidden. Each migration should be incremental and focused.
  - Each migration must implement both `upgrade()` and `downgrade()` where feasible.

### API Design

- **Idempotency:** PUT and DELETE APIs must be naturally idempotent. For POST APIs that create resources, design for idempotency where practical (e.g., idempotency keys, unique constraints, or upsert logic) — especially for payment, order submission, and other operations where duplicate requests cause real harm.
- **Pagination:** Any API that returns a collection of records must support pagination (e.g., `page` + `page_size` or cursor-based). Never return unbounded result sets.
- **Timestamps:** Backend stores all timestamps in UTC. Frontend converts and displays them according to the user's device time zone.

### Logging

- **`logging` only — `print()` is strictly forbidden** in all backend code.
- **Language:** Backend logs must be in English. Frontend user-facing messages must be in Simplified Chinese (zh-CN).
- **Be concise:** Only log at key decision points, error boundaries, and critical state transitions. Do not scatter logs throughout every function — excessive logging is noise, not observability.

### Docker & Deployment

- All services are defined in `docker-compose.yml`.
- Base images:
  - `python:3.12-slim` — backend (FastAPI)
  - `node:20-alpine` — frontend build stage
  - `nginx:alpine` — frontend static file serving
  - `mysql:8.0` — primary database
  - `redis:7-alpine` — cache
  - `minio/minio` — S3-compatible object storage
- Use multi-stage Docker builds to minimize image size.
- Sensitive config (DB passwords, secret keys, MinIO credentials) must be in `.env` and never committed.
- Frontend is built as static files and served via Nginx.
