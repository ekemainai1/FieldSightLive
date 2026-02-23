# AGENTS.md - FieldSightLive Development Guide

## Project Overview

**FieldSightLive** is an AI-Assisted Field Technician Companion application powered by Gemini Live API. It provides real-time vision and audio AI to help technicians:
- Diagnose equipment faults through live camera feeds
- Receive step-by-step repair guidance via speech
- Detect safety risks automatically
- Generate inspection reports

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, WebRTC, TailwindCSS |
| Backend | Node.js + TypeScript, Cloud Run |
| AI Agent | Google ADK (Agent Developer Kit), Gemini Live API |
| Database | Firestore |
| Storage | Cloud Storage (GCS) |
| Async Tasks | Cloud Functions |

---

## Core Features

### 1. Real-Time Visual Fault Detection (Core Value)
The user points their camera at equipment — FieldSight Live immediately:
- Identifies components (valves, gauges, connectors, pipes)
- Reads gauge levels, warnings, pressure indicators
- Detects visible abnormalities (leaks, corrosion, burnt marks, misalignment)
- Flags dangerous conditions (sparks, smoke, no PPE)

### 2. Hands-Free, Voice-Based Troubleshooting
Technician talks naturally to the agent and receives real-time audio responses with short, actionable instructions.

### 3. Step-by-Step Repair Guidance (Procedural Assistance)
The agent explains tasks like a trained engineer:
- "Turn the pressure valve clockwise by 20 degrees."
- "Reconnect the red cable into port A."
- "Unscrew the housing cover—check for moisture."

### 4. Intelligent Angle & Clarity Requests
The agent understands when the view is not clear:
- "Move the camera closer."
- "Rotate to the left."
- "Please zoom in on the label."
- "Lighting is low; turn your flashlight on."

### 5. Safety Violation Detection
Live monitoring for:
- Missing PPE (gl, goggles)
- Dangerous proximity to moving machinery
- Leoves, hard hataks, sparks, exposed wires
- Slippery surfaces, open flames

### 6. Auto-Generated Inspection Notes
Every inspection session produces:
- Key findings
- Detected faults
- Safety warnings
- Actions taken
- Image snapshots with captions
- Time & location metadata

### 7. Full Inspection Report Generation (Cloud Function)
When the session ends:
- FieldSight Live generates a structured PDF or digital log
- Includes images, descriptions, and actionable recommendations
- Automatically uploaded to Firestore & Cloud Storage

### 8. Equipment Label Reading (OCR + Vision)
Agent can read:
- Serial numbers
- Part codes
- Warning labels
- Meter readings

### 9. Technician History & Asset Tracking
The system tracks:
- Past inspections
- Fault patterns
- Frequently failing components
- Repairs performed per site

### 10. Multi-Site Support (O&G, Power, Telecom, Factories)
Works in:
- Oil & gas fields
- Telecom towers
- Solar microgrids
- Manufacturing plants
- Power substations

### 11. Offline-Friendly Mode
If internet is weak, app can still:
- Capture images
- Buffer videos
- Sync later when online

### 12. Workflow Automation
Technician can say:
- "Log this issue."
- "Create a ticket."
- "Notify my supervisor."
- "Add this to inspection history."

FieldSight Live automatically performs these actions via ADK tools.

### Top 5 Features for Demo/Pitch
1. **Real-Time Visual Fault & Safety Detection**
2. **Hands-Free Voice Interaction (Gemini Live)**
3. **Step-by-Step Repair Guidance**
4. **Automatic Inspection Logs & Reports**
5. **Industry-Agnostic Field Support (O&G, Power, Telecom)**

---

## Build, Lint, and Test Commands

### Frontend (Next.js)

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Run linter
npm run lint

# Run type checking
npm run typecheck

# Run all tests
npm test

# Run a single test file
npm test -- path/to/testfile.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Backend (Node.js/TypeScript)

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run development server
npm run dev

# Run linter
npm run lint

# Run tests
npm test

# Run single test
npm test -- path/to/testfile.test.ts

# Deploy to Cloud Run
gcloud run deploy visionassist-core --source ./
```

---

## Code Style Guidelines

### TypeScript/JavaScript Conventions

#### Imports

```typescript
// Group imports in this order:
// 1. External libraries (React, Next.js, etc.)
// 2. Internal modules (components, hooks, utils)
// 3. Types/interfaces
// 4. Relative imports

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { User } from '@/types'
import { formatDate } from '@/utils/date'
```

- Use absolute imports with `@/` path alias
- Avoid default exports except for pages/components that will be dynamically imported
- Prefer named exports

#### Naming Conventions

```typescript
// Variables and functions: camelCase
const userName = 'John'
function calculateTotal() {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3
const API_BASE_URL = '/api/v1'

// Classes and Types: PascalCase
class UserService {}
interface UserProfile {}
type ResponseStatus = 'success' | 'error'

// React Components: PascalCase
function UserProfile() {}
const SettingsForm = () => {}

// Files: kebab-case for components, camelCase for utils
// user-profile.tsx, useAuth.ts, apiClient.ts
```

#### Formatting

- Use 2 spaces for indentation
- Maximum line length: 100 characters
- Add trailing commas in multiline objects/arrays
- Use semicolons
- Prefer single quotes for strings

#### Types

- Always define return types for functions
- Use interfaces for objects, type aliases for unions/primitives
- Avoid `any` - use `unknown` when type is truly unknown
- Use strict null checks

```typescript
// Good
interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'technician' | 'viewer'
  createdAt: Date
  metadata?: Record<string, unknown>
}

function getUser(id: string): Promise<User | null> {}

// Avoid
function process(data: any): any {}
```

### Production Quality Standards

All code must be production-ready, not MVP quality. No shortcuts, no "we'll fix it later".

- **No placeholder code**: Every function must have real implementation
- **Error handling**: Every async operation must have proper try/catch with meaningful error messages
- **Type safety**: Full TypeScript strict mode, no `any` or `unknown` without justification
- **Performance**: Code must be optimized for speed and efficiency
  - Use appropriate data structures (Maps for lookups, Sets for uniqueness)
  - Avoid unnecessary re-renders in React (use memo, useCallback)
  - Lazy load non-critical components
  - Implement proper caching strategies
- **Memory management**: Avoid memory leaks, clean up subscriptions and event listeners
- **Edge cases**: Handle null, undefined, empty arrays, rate limits, timeouts
- **Security**: Validate all inputs, sanitize outputs, no secrets in code
- **Observability**: Add proper logging, metrics, and error tracking
- **Resilience**: Implement retries with exponential backoff, circuit breakers where appropriate

```typescript
// Good - production ready
async function fetchUser(id: string, retries = 3): Promise<User> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await api.get(`/users/${id}`, {
        timeout: 5000,
      })
      return UserSchema.parse(response.data)
    } catch (error) {
      if (attempt === retries) {
        throw new ApiError('Failed to fetch user', 500, 'FETCH_ERROR')
      }
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
  throw new ApiError('Failed to fetch user', 500, 'FETCH_ERROR')
}

// Bad - MVP thinking
async function fetchUser(id: string) {
  const response = await api.get(`/users/${id}`)
  return response.data
}
```

---

## Project Structure

```
FieldSightLive/
├── frontend/                 # Next.js web app
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/           # Custom React hooks (useWebRTC, etc.)
│   │   ├── lib/             # Utilities and helpers
│   │   ├── services/        # API client services
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                  # Node.js Cloud Run service
│   ├── src/
│   │   ├── agents/          # Google ADK agent definitions
│   │   ├── handlers/        # WebSocket/WebRTC handlers
│   │   ├── services/        # Business logic (Gemini integration)
│   │   ├── routes/          # API routes
│   │   └── utils/           # Utilities
│   ├── package.json
│   └── tsconfig.json
│
└── AGENTS.md                # This file
```

---

## Development Plan

### Current Progress (Updated)

- [x] Phase 1 complete: repository structure, frontend/backend setup, CI pipeline, lint/typecheck/test scripts
- [x] Phase 2 complete: camera streaming, push-to-talk, websocket, transcript UI, snapshot capture, frontend tests
- [x] Phase 3 mostly complete: websocket gateway, Gemini integration (Live + fallback), interrupt handling, rate limiting, logging, backend tests
- [x] Phase 4 complete: Firestore CRUD, GCS signed upload flow, history APIs, integration tests
- [x] Phase 5 mostly complete: report generation + persistence + PDF endpoint + frontend preview/download panel
- [ ] Phase 6/6b partial: offline mode and workflow automation integrations still pending
- [ ] Phase 7 partial: load/security/perf profiling still pending
- [ ] Phase 8 partial: production Cloud Run deployment and monitoring still pending

### Phase 1 — Project Setup (Week 1)

**Goals:**
- [ ] Initialize GitHub repository with proper structure
- [ ] Set up frontend (Next.js 14) with TypeScript and TailwindCSS
- [ ] Set up backend (Node.js + TypeScript) with Cloud Run configuration
- [ ] Configure Google Cloud project (Cloud Run, Firestore, Storage, Functions)
- [ ] Set up CI/CD pipeline (Cloud Build or GitHub Actions)
- [ ] Add linting, type checking, and test scripts to both projects

**Deliverables:**
- Working dev environments for frontend and backend
- Deployed empty Cloud Run service
- Configured Firestore database with security rules

---

### Phase 2 — Frontend Core (Week 1-2)

**Goals:**
- [ ] Implement WebRTC video streaming from camera
- [ ] Build audio capture and playback (push-to-talk)
- [ ] Create WebSocket connection to backend
- [ ] Design UI components (video player, controls, transcript display)
- [ ] Add snapshot capture functionality
- [ ] Implement loading and error states
- [ ] Write unit and component tests

**Deliverables:**
- Functional video/audio streaming UI
- Snapshot capture and preview
- WebSocket connection with reconnection logic
- 80%+ component test coverage

---

### Phase 2 — Frontend Core (Week 1-2)

**Features Delivered:** #1, #2, #3, #4

**Goals:**
- [ ] Implement WebRTC video streaming from camera
- [ ] Build audio capture and playback (push-to-talk)
- [ ] Create WebSocket connection to backend
- [ ] Design UI components (video player, controls, transcript display)
- [ ] Add snapshot capture functionality
- [ ] Implement loading and error states
- [ ] Write unit and component tests

**Deliverables:**
- Functional video/audio streaming UI
- Snapshot capture and preview
- WebSocket connection with reconnection logic
- 80%+ component test coverage

---

### Phase 3 — Backend Core API & AI Integration (Week 2-3)

**Features Delivered:** #1, #2, #3, #4, #5, #8

**Goals:**
- [ ] Build WebSocket gateway for real-time streaming
- [ ] Implement Gemini Live API integration
- [ ] Create interrupt handling (user can stop agent mid-response)
- [ ] Implement visual fault detection (valves, gauges, connectors, leaks, corrosion)
- [ ] Implement safety violation detection (PPE, sparks, leaks, exposed wires)
- [ ] Implement equipment label reading (OCR for serial numbers, part codes)
- [ ] Add authentication (Firebase Auth middleware)
- [ ] Implement rate limiting
- [ ] Add comprehensive logging and error tracking
- [ ] Write unit and integration tests

**Deliverables:**
- Cloud Run service handling real-time video/audio
- Gemini Live API integration with proper prompt engineering
- Interruptible conversation flow
- Real-time fault and safety detection
- OCR capability for equipment labels
- 80%+ backend test coverage

---

### Phase 4 — Data & Storage (Week 3)

**Features Delivered:** #6, #9

**Goals:**
- [ ] Implement Firestore schema for inspections
- [ ] Add Cloud Storage for images and snapshots
- [ ] Create CRUD operations for technicians, sites, inspections
- [ ] Implement real-time updates to frontend
- [ ] Add security rules for database and storage
- [ ] Implement technician history & asset tracking
- [ ] Track fault patterns and frequently failing components
- [ ] Write integration tests for data layer

**Deliverables:**
- Complete Firestore data model
- Image upload/download functionality
- Real-time inspection updates
- Security rules verified

---

### Phase 5 — Report Generation (Week 3-4)

**Features Delivered:** #6, #7

**Goals:**
- [ ] Implement Cloud Functions for async report generation
- [ ] Create inspection summary from Gemini responses
- [ ] Generate PDF reports with images and findings
- [ ] Add notification system (Pub/Sub)
- [ ] Implement report download functionality

**Deliverables:**
- Automatic report generation on inspection completion
- PDF export functionality
- Notification system for completed reports

---

### Phase 6 — Safety & Quality Features (Week 4)

**Features Delivered:** #5, #11

**Goals:**
- [ ] Implement safety risk detection alerts
- [ ] Add confidence scores for fault predictions
- [ ] Create equipment-specific detection modules
- [ ] Implement quality checks on all Gemini responses
- [ ] Add offline mode for critical safety warnings

**Deliverables:**
- Real-time safety flag notifications
- Confidence scoring in inspection results
- Offline-capable safety alerts

---

### Phase 6b — Multi-Site Support & Workflow Automation (Week 4)

**Features Delivered:** #10, #12

**Goals:**
- [ ] Implement multi-site support for O&G, Power, Telecom, Manufacturing
- [ ] Create site-specific configuration and asset management
- [ ] Implement workflow automation (log issue, create ticket, notify supervisor)
- [ ] Integrate with external ticketing systems
- [ ] Add ADK tools for automation actions

**Deliverables:**
- Industry-agnostic field support
- Automated ticket creation and notifications
- ADK-powered workflow actions

---

### Phase 7 — Testing & Optimization (Week 4-5)

**Goals:**
- [ ] Complete end-to-end functional tests
- [ ] Perform load testing and optimization
- [ ] Optimize video/audio latency
- [ ] Implement caching strategies
- [ ] Conduct security audit
- [ ] Performance profiling and tuning

**Deliverables:**
- Full test suite passing
- Load test results with optimization applied
- Security audit report

---

### Phase 8 — Deployment & Documentation (Week 5-6)

**Goals:**
- [ ] Deploy to production Cloud Run
- [ ] Set up monitoring and alerting
- [ ] Create user documentation
- [ ] Prepare demo materials
- [ ] Write deployment scripts (Terraform if applicable)

**Deliverables:**
- Production deployment
- Monitoring dashboards
- Complete documentation
- Demo video

---

## Milestones Checklist

| Milestone | Target | Status |
|-----------|--------|--------|
| Project setup complete | Week 1 | [x] |
| Frontend core functional | Week 2 | [x] |
| Backend Gemini integration | Week 3 | [x] (partial: auth/OCR hardening pending) |
| Data layer complete | Week 3 | [x] |
| Reports generation | Week 4 | [x] (partial: Cloud Functions async pipeline pending) |
| Safety features | Week 4 | [ ] (partial implementation in app flow) |
| Multi-site & workflow automation | Week 4 | [ ] |
| Testing complete | Week 5 | [ ] (quality gates + major tests done; load/security pending) |
| Production deployment | Week 6 | [ ] |

---

## Gemini Live API Integration

### Core Prompt Template

```typescript
const SYSTEM_PROMPT = `You are VisionAssist, a real-time technician support agent.
You receive live video frames of equipment.

Tasks:
1. Understand equipment condition
2. Detect safety risks
3. Identify faults and error codes
4. Provide step-by-step repair guidance
5. Keep conversation short, fast, interruptible
6. Ask for clearer angles when needed
7. Generate automatic inspection notes

Always respond with short actionable steps, not long paragraphs.`
```

### Streaming Integration

- Use WebRTC for real-time video/audio streaming
- Implement WebSocket connection to backend for Gemini responses
- Handle interrupt signals (user can stop agent mid-response)

---

## Firestore Schema

```
/technicians/{technicianId}
/sites/{siteId}
/inspections/{inspectionId}
  - timestamp: timestamp
  - technicianId: string
  - siteId: string
  - images: string[] (Cloud Storage URLs)
  - safetyFlags: string[]
  - detectedFaults: string[]
  - recommendedActions: string[]
  - transcript: string
  - status: 'in_progress' | 'completed'
```

---

## Error Handling

### TypeScript/JavaScript

```typescript
// Use custom error classes
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Always handle async errors
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`)
    return response.data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError('Failed to fetch user', 500, 'INTERNAL_ERROR')
  }
}
```

---

## Git Conventions

- Use conventional commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- Keep commits atomic and small
- Write descriptive commit messages (first line < 72 chars)
- Never commit secrets, API keys, or credentials
- Run lint and tests before committing

---

## Testing Guidelines

Write tests for all new features and bug fixes. Follow AAA pattern: Arrange, Act, Assert.

### Test Types

| Type | Purpose | Location |
|------|---------|-----------|
| **Unit Tests** | Test individual functions, classes, hooks in isolation | `*.test.ts` |
| **Integration Tests** | Test how modules work together | `*.integration.test.ts` |
| **Functional Tests** | Test end-to-end user workflows | `e2e/*.test.ts` |
| **Component Tests** | Test React components with React Testing Library | `*.component.test.tsx` |

### Test Organization

```
src/
├── services/
│   ├── user.service.ts
│   └── user.service.test.ts      # Unit tests
├── handlers/
│   └── webhook.handler.test.ts   # Integration tests
├── __tests__/
│   ├── integration/
│   │   └── inspection.flow.test.ts
│   └── e2e/
│       └── technician-inspection.test.ts
└── components/
    └── video-player/
        └── video-player.test.tsx # Component tests
```

### Best Practices

- Test behavior, not implementation
- Use meaningful test names: `should_return_user_when_valid_id_provided`
- Keep tests independent and isolated
- Aim for >80% code coverage on critical paths
- Mock external dependencies (APIs, databases)
- Use descriptive mock data

### Example Test Structure

```typescript
describe('UserService', () => {
  describe('getUser', () => {
    it('should return user when valid id provided', async () => {
      // Arrange
      const mockUser = { id: '1', name: 'John' }
      mockApi.get.mockResolvedValue({ data: mockUser })

      // Act
      const result = await userService.getUser('1')

      // Assert
      expect(result).toEqual(mockUser)
    })
  })
})
```

### Running Tests

```bash
# All tests
npm test

# Single test file
npm test -- path/to/testfile.test.ts

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage

# Integration tests only
npm test -- --testPathPattern=integration

# E2E tests (if using Playwright/Cypress)
npm run test:e2e
```

---

## UI/Component Guidelines

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use composition over inheritance
- Implement proper loading and error states

### Key Frontend Features

- Live camera streaming via WebRTC
- Push-to-talk voice input
- Real-time Gemini response display
- Snapshot capture functionality
- Safety flag notifications

---

## Security Best Practices

- Never log secrets or API keys
- Validate all user inputs
- Use parameterized queries for database operations
- Sanitize data before rendering
- Follow least privilege principle
- Use Firebase Auth for technician authentication

---

## When in Doubt

- Look at existing code in the repository for patterns
- Ask for clarification when requirements are unclear
- Prefer explicit over implicit
- Write code that's easy to delete, not just easy to write
