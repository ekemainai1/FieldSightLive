import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LivePage from './live/page'

const wsServiceMock = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendVideoFrame: jest.fn(),
  sendAudio: jest.fn(),
  sendAudioEnd: jest.fn(),
  sendInspectionContext: jest.fn(),
  sendInterrupt: jest.fn(),
  onMessage: jest.fn(() => () => undefined),
  isConnected: true,
}

const inspectionSessionMocks = {
  startInspection: jest.fn(async () => 'insp-flow-1'),
  uploadSnapshot: jest.fn(async () => 'https://storage.example/snapshot.jpg'),
  completeInspection: jest.fn(async () => ({
    inspectionId: 'insp-flow-1',
    generatedAt: new Date().toISOString(),
    status: 'completed' as const,
    findings: ['Valve misalignment'],
    safetySummary: ['HIGH - PPE missing'],
    workflowSummary: ['COMPLETED - create_ticket: Ticket created (wf_123)'],
    recommendedActions: ['Wear gloves'],
    imageCount: 1,
    summaryText: 'Inspection summary text',
  })),
}

jest.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: React.forwardRef(() => <div data-testid="video-player">video</div>),
}))

jest.mock('@/components/Transcript', () => ({
  Transcript: () => <div data-testid="transcript">transcript</div>,
}))

jest.mock('@/components/Controls', () => ({
  Controls: ({ onStartCamera, onCaptureSnapshot, onStopCamera }: {
    onStartCamera: () => void
    onCaptureSnapshot: () => void
    onStopCamera: () => void
  }) => (
    <div>
      <button onClick={onStartCamera}>Start Camera</button>
      <button onClick={onCaptureSnapshot}>Snapshot</button>
      <button onClick={onStopCamera}>Stop Camera</button>
    </div>
  ),
}))

jest.mock('@/hooks/useWebRTC', () => ({
  useWebRTC: () => ({
    stream: null,
    videoRef: { current: null },
    startStream: jest.fn(async () => undefined),
    stopStream: jest.fn(),
    captureFrame: jest.fn(() => 'data:image/jpeg;base64,aGVsbG8='),
    state: {
      isStreaming: false,
      isLoading: false,
      error: null,
    },
  }),
}))

jest.mock('@/hooks/useAudioCapture', () => ({
  useAudioCapture: () => ({
    startRecording: jest.fn(async () => undefined),
    stopRecording: jest.fn(async () => undefined),
    state: {
      isRecording: false,
      isProcessing: false,
      error: null,
      audioLevel: 0,
    },
  }),
}))

jest.mock('@/hooks/useInspectionSession', () => {
  return {
    useInspectionSession: () => {
      const [latestReport] = React.useState<null | {
        inspectionId: string
        generatedAt: string
        status: 'completed'
        findings: string[]
        safetySummary: string[]
        workflowSummary: string[]
        recommendedActions: string[]
        imageCount: number
        summaryText: string
      }>(null)

      return {
        inspectionId: null,
        isBusy: false,
        error: null,
        latestReport,
        startInspection: inspectionSessionMocks.startInspection,
        uploadSnapshot: inspectionSessionMocks.uploadSnapshot,
        completeInspection: inspectionSessionMocks.completeInspection,
        refreshLatestReport: jest.fn(async () => latestReport),
        loadReportForInspection: jest.fn(async () => latestReport),
        downloadLatestReportPdf: jest.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
      }
    },
  }
})

jest.mock('@/services/websocket', () => ({
  getWebSocketService: () => wsServiceMock,
}))

const addMessageMock = jest.fn()

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: (state: {
    sessionId: string
    setSessionId: (id: string) => void
    setConnected: (v: boolean) => void
    addMessage: (...args: unknown[]) => void
    messages: unknown[]
    safetyFlags: unknown[]
    detectedFaults: unknown[]
    addSafetyFlag: (...args: unknown[]) => void
    addDetectedFault: (...args: unknown[]) => void
    selection: {
      technicianId: string
      siteId: string
    }
  }) => unknown) => {
    const state = {
      sessionId: 'session-flow-1',
      setSessionId: jest.fn(),
      setConnected: jest.fn(),
      addMessage: addMessageMock,
      messages: [],
      safetyFlags: [],
      detectedFaults: [],
      addSafetyFlag: jest.fn(),
      addDetectedFault: jest.fn(),
      selection: {
        technicianId: 'tech-flow-1',
        siteId: 'site-flow-1',
      },
    }
    return selector(state)
  },
}))

describe('Home flow (E2E-style component test)', () => {
  beforeEach(() => {
    inspectionSessionMocks.startInspection.mockClear()
    inspectionSessionMocks.uploadSnapshot.mockClear()
    inspectionSessionMocks.completeInspection.mockClear()
  })

  it('should run start -> snapshot -> complete and show report', async () => {
    render(<LivePage />)

    fireEvent.click(screen.getByText('Start Camera'))
    fireEvent.click(screen.getByText('Snapshot'))
    fireEvent.click(screen.getByText('Stop Camera'))

    await waitFor(() => {
      expect(inspectionSessionMocks.startInspection).toHaveBeenCalledTimes(1)
      expect(inspectionSessionMocks.uploadSnapshot).toHaveBeenCalledTimes(1)
      expect(inspectionSessionMocks.completeInspection).toHaveBeenCalledTimes(1)
    })
  })
})
