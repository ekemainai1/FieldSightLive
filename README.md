# FieldSight Live

FieldSight Live is an AI-assisted field technician companion for real-time inspection,
voice guidance, safety detection, and report generation.

## Tech Stack

- Frontend: Next.js 16 + TypeScript + WebRTC + TailwindCSS
- Backend: Node.js + TypeScript + WebSocket + Express
- AI: Gemini Live API (+ direct Gemini fallback)
- Data: Firestore (prod) or PostgreSQL (dev/local)
- Storage: GCS signed uploads (prod) or MinIO signed uploads (dev/local)

## Monorepo Structure

- `frontend/` - Next.js app (camera UI, transcript, setup/report/history panels)
- `backend/` - Cloud Run-ready API/WebSocket service
- `.github/workflows/ci.yml` - CI pipeline (quality + tests + optional emulator profile)

## Quick Start

### 1) Install dependencies

```bash
npm --prefix frontend install
npm --prefix backend install
```

### 2) Configure environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Update values in `backend/.env` and `frontend/.env.local`.

For local development without GCP services, set in `backend/.env`:

```bash
DATA_PROVIDER="postgres"
STORAGE_PROVIDER="minio"
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/fieldsightlive"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_USE_SSL="false"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_NAME="fieldsightlive-dev"
MINIO_PUBLIC_BASE_URL="http://localhost:9000"
```

For production, use:

```bash
DATA_PROVIDER="firestore"
STORAGE_PROVIDER="gcs"
GCS_BUCKET_NAME="your-prod-bucket"
```

### 3) Run locally

Use two terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Open `http://localhost:3000`.

## Core Runtime Endpoints

- Health: `GET /health`
- Live AI health: `GET /healthz/live`
- API status: `GET /api/v1/status`
- WebSocket: `ws://localhost:8080` (and `/ws`)

## Data API (selected)

- `POST /api/v1/technicians`
- `GET /api/v1/technicians`
- `POST /api/v1/sites`
- `GET /api/v1/sites`
- `POST /api/v1/inspections`
- `GET /api/v1/inspections`
- `GET /api/v1/inspections/:inspectionId`
- `PATCH /api/v1/inspections/:inspectionId/status`
- `POST /api/v1/inspections/:inspectionId/snapshots/signed-url`
- `POST /api/v1/inspections/:inspectionId/snapshots/attach`
- `POST /api/v1/inspections/:inspectionId/report`
- `POST /api/v1/inspections/:inspectionId/report?mode=sync`
- `GET /api/v1/inspections/:inspectionId/report`
- `GET /api/v1/inspections/:inspectionId/report.pdf`
- `GET /api/v1/inspections/:inspectionId/report/jobs/latest`
- `GET /api/v1/inspections/:inspectionId/report/jobs/:jobId`
- `POST /api/v1/inspections/:inspectionId/ocr`
- `POST /api/v1/inspections/:inspectionId/workflow-actions`
  - Optional idempotency support: send `X-Idempotency-Key` header (or `idempotencyKey` in body)
  - External webhook actions (`create_ticket`, `notify_supervisor`) use retry with backoff
  - Provider adapters available via env: `generic` (default), `jira`, `servicenow`
  - Jira adapter defaults to `/rest/api/3/issue` when only base host is configured
  - ServiceNow adapter supports `/api/now/table/{table}` and proxy webhook payload mode

Report generation endpoint behavior:
- default `POST /report`: async queue (returns `202` with job metadata)
- `POST /report?mode=sync`: synchronous generation (returns generated report)
- Pub/Sub worker target for Cloud Functions: `backend/src/functions/report-generation.function.ts`
  (`generateInspectionReportFromPubSub`)

Voice-triggered workflow intents are also supported during live sessions when transcript includes phrases like:
- "create ticket"
- "notify my supervisor"
- "log this issue"
- "add this to history"

External actions (`create ticket`, `notify my supervisor`) require an explicit follow-up
confirmation phrase (`confirm`) and can be aborted with `cancel`.

## Testing and Quality

From repo root:

```bash
npm run quality:ci
npm run test:ci
```

### Optional Firestore emulator profile

```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8081
export GOOGLE_CLOUD_PROJECT=fieldsightlive-test
npm run test:ci:emulator
```

## CI Workflow

GitHub Actions workflow: `.github/workflows/ci.yml`

- Push/PR: install -> quality gates -> tests
- Manual dispatch with `run_emulator=true`: includes Firestore emulator profile

## Notes

- Live Gemini WebSocket mode requires ADC credentials (`gcloud auth application-default login`).
- Without ADC, backend automatically falls back to direct Gemini API mode.
- Setup panel in UI can create/select technician/site, so default IDs are optional.
