# FieldSight Live

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Stack-Next.js%2016%20%2B%20Gemini%20Live-orange" alt="Tech Stack">
</p>

**FieldSight Live** is an AI-assisted field technician companion powered by Google Gemini Live API. It provides real-time vision and audio AI to help technicians diagnose equipment faults, receive step-by-step repair guidance via speech, detect safety risks automatically, and generate inspection reports.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Running the Application](#running-the-application)
7. [User Guide](#user-guide)
8. [API Reference](#api-reference)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)
12. [Security](#security)
13. [License](#license)

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Real-Time Visual Fault Detection** | Identifies components (valves, gauges, connectors), reads levels, detects abnormalities (leaks, corrosion, burnt marks) |
| **Hands-Free Voice Troubleshooting** | Talk naturally to the AI agent and receive real-time audio guidance |
| **Step-by-Step Repair Guidance** | Get actionable instructions like "Turn the valve clockwise by 20 degrees" |
| **Intelligent Angle Requests** | Agent asks for better angles: "Move camera closer", "Rotate to the left" |
| **Safety Violation Detection** | Live monitoring for missing PPE, dangerous proximity, leaks, sparks, exposed wires |
| **Auto-Generated Inspection Notes** | Key findings, detected faults, safety warnings captured automatically |
| **Full Report Generation** | PDF reports with images, descriptions, and actionable recommendations |
| **Equipment Label Reading (OCR)** | Extract serial numbers, part codes, warning labels, meter readings |
| **Technician History & Asset Tracking** | Track past inspections, fault patterns, frequently failing components |
| **Multi-Site Support** | Works across Oil & Gas, Power, Telecom, Manufacturing, Solar industries |
| **Offline-Friendly Mode** | Capture images and sync when back online |
| **Workflow Automation** | Voice commands to create tickets, notify supervisors, log issues |

### Top 5 Features for Demo/Pitch

1. **Real-Time Visual Fault & Safety Detection**
2. **Hands-Free Voice Interaction (Gemini Live)**
3. **Step-by-Step Repair Guidance**
4. **Automatic Inspection Logs & Reports**
5. **Industry-Agnostic Field Support**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FieldSight Live                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌────────────────────────────────────┐  │
│  │   Frontend   │     │             Backend                │  │
│  │  (Next.js)   │◄───►│      (Node.js + Express)          │  │
│  │              │     │                                    │  │
│  │  - Camera    │     │  - REST API                       │  │
│  │  - Audio     │     │  - WebSocket Gateway              │  │
│  │  - UI        │     │  - Gemini Live Integration        │  │
│  └──────────────┘     │  - Data Services                  │  │
│                        └──────────────┬───────────────────┘  │
│                                         │                       │
│                    ┌────────────────────┼────────────────────┐ │
│                    │                    │                    │ │
│              ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐ │
│              │ Firestore │        │ PostgreSQL│        │    GCS    │ │
│              │ (Prod)    │        │  (Dev)    │        │ (Prod)    │ │
│              └───────────┘        └───────────┘        └───────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, WebRTC, TailwindCSS |
| Backend | Node.js + TypeScript, Express, WebSocket |
| AI Agent | Google Gemini Live API (+ fallback) |
| Database | Firestore (production) or PostgreSQL (development) |
| Storage | Cloud Storage GCS (production) or MinIO (development) |

### Monorepo Structure

```
FieldSightLive/
├── frontend/                  # Next.js web application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API clients
│   │   └── lib/             # Utilities
│   └── Dockerfile
│
├── backend/                  # Node.js API service
│   ├── src/
│   │   ├── agents/          # ADK agent definitions
│   │   ├── routes/          # Express routes
│   │   ├── services/        # Business logic
│   │   ├── functions/       # Cloud Functions
│   │   └── utils/           # Utilities
│   └── Dockerfile
│
├── scripts/                  # Deployment scripts
├── monitoring/              # Cloud Monitoring configs
└── .github/workflows/       # CI/CD pipelines
```

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker** (optional, for containerized deployment)
- **Google Cloud Account** (for production with Gemini API)

### 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/fieldsightlive.git
cd fieldsightlive

# 2. Install dependencies
npm --prefix frontend install
npm --prefix backend install

# 3. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 4. Start backend (terminal 1)
npm run dev:backend

# 5. Start frontend (terminal 2)
npm run dev:frontend

# 6. Open browser
# Visit http://localhost:3000
```

---

## Installation

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x |
| RAM | 4 GB | 8 GB |
| Disk | 2 GB | 10 GB |
| Browser | Chrome 90+ | Chrome 120+ |

### Environment Setup

#### Development (Free - No GCP Required)

For local development without Google Cloud services:

```bash
# backend/.env
DATA_PROVIDER=postgres
STORAGE_PROVIDER=minio
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/fieldsightlive
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=fieldsightlive-dev
MINIO_PUBLIC_BASE_URL=http://localhost:9000
```

#### Production (with GCP)

```bash
# backend/.env
DATA_PROVIDER=firestore
STORAGE_PROVIDER=gcs
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_LIVE_MODEL=gemini-live-2.5-flash-native-audio
GCS_BUCKET_NAME=fieldsightlive-prod
```

---

## Running the Application

### Development Mode

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

Access the application at **http://localhost:3000**

### Production Mode

```bash
# Build both applications
npm run build

# Run backend
cd backend && npm start

# Run frontend (production)
cd frontend && npm start
```

### Docker Deployment

```bash
# Build Docker images
docker build -t fieldsightlive-backend ./backend
docker build -t fieldsightlive-frontend ./frontend

# Run containers
docker run -p 8080:8080 fieldsightlive-backend
docker run -p 3000:3000 fieldsightlive-frontend
```

---

## User Guide

### Getting Started

#### 1. Setup Panel

When you first open FieldSight Live:

1. **Create a Technician** - Enter your name and email
2. **Create or Select a Site** - Choose industry type (Power, Oil & Gas, Telecom, Manufacturing, Solar)
3. **Start Inspection** - Begin your field inspection

#### 2. Live Inspection Page (`/live`)

The main inspection interface with:

- **Live Camera Feed** - Real-time video from your device camera
- **Push-to-Talk Button** - Hold to speak with the AI agent
- **Transcript Panel** - See conversation history
- **Safety Alerts** - Real-time safety violation warnings
- **Snapshot Capture** - Take photos of equipment

#### 3. Using Voice Commands

**Basic Commands:**
- "What is wrong with this panel?"
- "What step should I take next?"
- "Does this look safe?"

**Workflow Commands:**
- "Log this issue"
- "Create a ticket"
- "Notify my supervisor"
- "Add this to inspection history"

**Clarification Requests:**
- "Move the camera closer"
- "Rotate to the left"
- "Please zoom in on the label"
- "Turn your flashlight on"

#### 4. OCR Page (`/ocr`)

Extract text from equipment images:

1. Upload or capture an image
2. Click "Extract Text"
3. View extracted: Serial numbers, Part codes, Meter readings, Warning labels

#### 5. History Page (`/history`)

View past inspections:
- Filter by date, site, status
- View inspection details
- Download PDF reports
- Review workflow actions

#### 6. Reports Page (`/reports`)

Access generated inspection reports:
- View all reports
- Download PDF versions
- Share with supervisors

---

## API Reference

### Health Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/healthz/live` | Gemini Live API health |
| GET | `/api/v1/status` | API status |

### Technicians

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/technicians` | Create technician |
| GET | `/api/v1/technicians` | List technicians |
| GET | `/api/v1/technicians/:id` | Get technician |

### Sites

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sites` | Create site |
| GET | `/api/v1/sites` | List sites |
| GET | `/api/v1/sites/:id` | Get site |
| GET | `/api/v1/sites/:id/assets` | List site assets |
| POST | `/api/v1/sites/:id/assets` | Create site asset |

### Inspections

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/inspections` | Create inspection |
| GET | `/api/v1/inspections` | List inspections |
| GET | `/api/v1/inspections/:id` | Get inspection |
| PATCH | `/api/v1/inspections/:id/status` | Update status |

### Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/inspections/:id/snapshots/signed-url` | Get upload URL |
| POST | `/api/v1/inspections/:id/snapshots/attach` | Attach image |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/inspections/:id/report` | Generate report (async) |
| POST | `/api/v1/inspections/:id/report?mode=sync` | Generate report (sync) |
| GET | `/api/v1/inspections/:id/report` | Get report |
| GET | `/api/v1/inspections/:id/report.pdf` | Download PDF |

### OCR

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/inspections/:id/ocr` | Extract text from image |

### Workflow Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/inspections/:id/workflow-actions` | Trigger workflow |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `ws://host:8080/ws` | Real-time Gemini Live streaming |

---

## Deployment

### Quick Deploy to Cloud Run

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy to Cloud Run
./scripts/deploy.sh deploy --project YOUR_PROJECT_ID --region us-central1
```

### Manual Deployment

```bash
# Deploy backend
gcloud run deploy fieldsightlive-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated

# Deploy frontend
gcloud run deploy fieldsightlive-frontend \
  --source ./frontend \
  --region us-central1 \
  --allow-unauthenticated
```

### Infrastructure Setup

```bash
# Create storage bucket
gsutil mb -l us-central1 gs://fieldsightlive-prod
gsutil iam ch allUsers:objectViewer gs://fieldsightlive-prod

# Create Firestore database
gcloud firestore databases create --location=us-central1
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

---

## Testing

### Run All Tests

```bash
# Quality gates (lint, typecheck, build)
npm run quality:ci

# Unit and integration tests
npm run test:ci
```

### Run Tests Separately

```bash
# Frontend tests
npm --prefix frontend test

# Backend tests
npm --prefix backend test

# With coverage
npm test -- --coverage
```

### Firestore Emulator Tests

```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8081
export GOOGLE_CLOUD_PROJECT=fieldsightlive-test
npm run test:ci:emulator
```

---

## Troubleshooting

### Common Issues

#### "Camera not accessible"
- **Solution**: Ensure you're using HTTPS or localhost
- **Solution**: Grant camera permissions in browser

#### "No audio was captured"
- **Solution**: Check microphone permissions
- **Solution**: Hold push-to-talk button while speaking
- **Solution**: Ensure WebSocket connection is established

#### "Gemini API unavailable"
- **Solution**: Verify `GEMINI_API_KEY` is set correctly
- **Solution**: Check Google Cloud project has Gemini API enabled

#### "Report not found"
- **Solution**: Complete an inspection first
- **Solution**: Check report generation completed (check history page)

#### "OCR - No image found"
- **Solution**: Ensure MinIO/GCS bucket has proper read permissions
- **Solution**: Use signed URLs for image access

### Logs

```bash
# Backend logs (local)
npm run dev:backend  # Check terminal output

# Backend logs (Cloud Run)
gcloud logs read --service=fieldsightlive-backend
```

---

## Security

### Best Practices

1. **Authentication**: Set `AUTH_REQUIRED=true` in production
2. **CORS**: Restrict `CORS_ORIGIN` to your domain
3. **Secrets**: Use Secret Manager for sensitive environment variables

```bash
# Create secret in Google Cloud Secret Manager
echo $GEMINI_API_KEY | gcloud secrets create gemini-api-key --data-file=-
```

4. **IAM**: Use least-privilege service accounts
5. **HTTPS**: Always use HTTPS in production

### Environment Variables Security

| Variable | Sensitivity | Recommendation |
|----------|-------------|----------------|
| GEMINI_API_KEY | High | Use Secret Manager |
| POSTGRES_PASSWORD | High | Use Secret Manager |
| MINIO_SECRET_KEY | High | Use Secret Manager |

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Support

- **Issues**: https://github.com/your-org/fieldsightlive/issues
- **Documentation**: https://github.com/your-org/fieldsightlive#readme

---

<p align="center">Built with ❤️ using Google Gemini Live API</p>
