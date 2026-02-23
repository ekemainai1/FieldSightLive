# FieldSight Live

FieldSight Live is an AI-assisted field technician companion for real-time inspection,
voice guidance, safety detection, and report generation.

## Tech Stack

- Frontend: Next.js 16 + TypeScript + WebRTC + TailwindCSS
- Backend: Node.js + TypeScript + WebSocket + Express
- AI: Gemini Live API (+ direct Gemini fallback)
- Data: Firestore
- Storage: Google Cloud Storage signed uploads

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
- `GET /api/v1/inspections/:inspectionId/report`
- `GET /api/v1/inspections/:inspectionId/report.pdf`
- `POST /api/v1/inspections/:inspectionId/ocr`
- `POST /api/v1/inspections/:inspectionId/workflow-actions`

Voice-triggered workflow intents are also supported during live sessions when transcript includes phrases like:
- "create ticket"
- "notify my supervisor"
- "log this issue"
- "add this to history"

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
