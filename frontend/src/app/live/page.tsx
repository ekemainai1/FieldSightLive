'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Controls } from '@/components/Controls'
import { Transcript } from '@/components/Transcript'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { useInspectionSession } from '@/hooks/useInspectionSession'
import { getWebSocketService, WebSocketMessage } from '@/services/websocket'
import type { WorkflowActionType } from '@/services/inspection-service'
import { inspectionService } from '@/services/inspection-service'
import { useAppStore } from '@/lib/store'

export default function LivePage() {
  const sessionId = useAppStore((state) => state.sessionId)
  const setSessionId = useAppStore((state) => state.setSessionId)
  const setConnected = useAppStore((state) => state.setConnected)
  const addMessage = useAppStore((state) => state.addMessage)
  const messages = useAppStore((state) => state.messages)
  const safetyFlags = useAppStore((state) => state.safetyFlags)
  const detectedFaults = useAppStore((state) => state.detectedFaults)
  const addSafetyFlag = useAppStore((state) => state.addSafetyFlag)
  const addDetectedFault = useAppStore((state) => state.addDetectedFault)
  const technicianId = useAppStore((state) => state.selection.technicianId)
  const siteId = useAppStore((state) => state.selection.siteId)

  const { stream, videoRef, startStream, stopStream, captureFrame, state: webRTCState } = useWebRTC()
  const { startRecording, stopRecording, state: audioState } = useAudioCapture()
  const inspection = useInspectionSession()
  const wsService = getWebSocketService()
  const [lastSnapshotUrl, setLastSnapshotUrl] = useState<string | null>(null)
  const [pendingVoiceConfirmation, setPendingVoiceConfirmation] = useState<{
    action: string
    expiresAt: number
  } | null>(null)
  const [confirmationNow, setConfirmationNow] = useState<number>(Date.now())

  useEffect(() => {
    if (!pendingVoiceConfirmation) {
      return
    }

    const timer = setInterval(() => setConfirmationNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pendingVoiceConfirmation])

  useEffect(() => {
    if (!sessionId) {
      setSessionId(`session_${Date.now()}`)
    }
  }, [sessionId, setSessionId])

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message: WebSocketMessage) => {
      switch (message.type) {
        case 'connected':
          setConnected(true)
          addMessage({ type: 'system', text: 'Connected to FieldSight Live' })
          if (inspection.inspectionId) {
            wsService.sendInspectionContext(inspection.inspectionId)
          }
          break
        case 'live_transcript':
          if (typeof message.text === 'string' && message.text.trim().length > 0) {
            addMessage({ type: 'user', text: message.text })
          }
          break
        case 'workflow_confirmation':
          if (message.status === 'pending') {
            const action = typeof message.action === 'string' ? message.action : 'workflow_action'
            const expiresAt =
              typeof message.expiresAt === 'number' ? message.expiresAt : Date.now() + 30000
            setPendingVoiceConfirmation({ action, expiresAt })
            addMessage({
              type: 'system',
              text: `WF_CONFIRM|pending|${action}|Awaiting voice confirmation`,
            })
          } else {
            setPendingVoiceConfirmation(null)
            const status =
              typeof message.status === 'string' ? message.status : 'expired'
            const action = typeof message.action === 'string' ? message.action : 'workflow_action'
            addMessage({
              type: 'system',
              text: `WF_CONFIRM|${status}|${action}|Voice confirmation ${status}`,
            })
          }
          break
        case 'gemini_response':
          addMessage({ type: 'agent', text: (message.text as string) || '' })
          if (message.safetyFlags && Array.isArray(message.safetyFlags)) {
            message.safetyFlags.forEach((flag) => addSafetyFlag(flag as Parameters<typeof addSafetyFlag>[0]))
          }
          if (message.detectedFaults && Array.isArray(message.detectedFaults)) {
            message.detectedFaults.forEach((fault) => addDetectedFault(fault as Parameters<typeof addDetectedFault>[0]))
          }
          break
        case 'gemini_response_chunk':
          if (typeof message.textChunk === 'string' && message.textChunk.trim().length > 0) {
            addMessage({ type: 'agent', text: message.textChunk })
          }
          break
        case 'error':
          addMessage({ type: 'system', text: `Error: ${message.message || 'Unknown error'}` })
          break
      }
    })

    return () => unsubscribe()
  }, [
    wsService,
    setConnected,
    addMessage,
    addSafetyFlag,
    addDetectedFault,
    inspection.inspectionId,
  ])

  const confirmationSecondsLeft = pendingVoiceConfirmation
    ? Math.max(0, Math.ceil((pendingVoiceConfirmation.expiresAt - confirmationNow) / 1000))
    : 0

  useEffect(() => {
    if (pendingVoiceConfirmation && confirmationSecondsLeft === 0) {
      setPendingVoiceConfirmation(null)
    }
  }, [pendingVoiceConfirmation, confirmationSecondsLeft])

  useEffect(() => {
    if (webRTCState.isStreaming && sessionId) {
      wsService.connect(sessionId)
    } else {
      wsService.disconnect()
    }
    return () => wsService.disconnect()
  }, [webRTCState.isStreaming, sessionId, wsService])

  const handleStartRecording = useCallback(async () => {
    if (inspection.isOffline) {
      addMessage({
        type: 'system',
        text: 'Offline mode: voice streaming is unavailable. Capture snapshots and sync later.',
      })
      return
    }

    if (!wsService.isConnected) {
      addMessage({
        type: 'system',
        text: 'WebSocket not connected. Make sure camera is streaming first.',
      })
      return
    }

    await startRecording((chunk) => {
      wsService.sendAudio(chunk)
    })
  }, [addMessage, inspection.isOffline, startRecording, wsService])

  const handleStopRecording = useCallback(async () => {
    await stopRecording()
    addMessage({ type: 'user', text: '[Audio stream sent]' })
    wsService.sendAudioEnd()
  }, [stopRecording, wsService, addMessage])

  const handleCaptureSnapshot = useCallback(() => {
    const frame = captureFrame()
    if (frame) {
      if (!inspection.isOffline) {
        wsService.sendVideoFrame(frame)
      }
      addMessage({ type: 'system', text: 'Snapshot captured' })
      void inspection.uploadSnapshot(frame)
        .then((imageUrl) => {
          if (imageUrl.startsWith('offline://')) {
            addMessage({
              type: 'system',
              text: 'Snapshot queued for sync. It will upload automatically when network is back.',
            })
            addMessage({
              type: 'system',
              text: 'Offline safety note: live AI detections pause while disconnected.',
            })
            return
          }

          setLastSnapshotUrl(imageUrl)
          addMessage({ type: 'system', text: `Snapshot uploaded: ${imageUrl}` })
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Snapshot upload failed'
          addMessage({ type: 'system', text: `Snapshot upload failed: ${message}` })
        })
    }
  }, [addMessage, captureFrame, inspection, wsService])

  const handleRunOcr = useCallback(() => {
    if (inspection.isOffline) {
      addMessage({ type: 'system', text: 'Offline mode: OCR requires network connectivity.' })
      return
    }

    if (!inspection.inspectionId) {
      addMessage({ type: 'system', text: 'Start an inspection first before running OCR.' })
      return
    }

    void inspectionService.runOcr(inspection.inspectionId, lastSnapshotUrl || undefined)
      .then((ocr) => {
        const summary = [
          ocr.serialNumbers.length > 0 ? `Serial: ${ocr.serialNumbers.join(', ')}` : null,
          ocr.partCodes.length > 0 ? `Part codes: ${ocr.partCodes.join(', ')}` : null,
          ocr.meterReadings.length > 0 ? `Readings: ${ocr.meterReadings.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join(' | ')

        addMessage({
          type: 'system',
          text: summary || `OCR completed (${Math.round(ocr.confidence * 100)}% confidence).`,
        })
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'OCR failed'
        addMessage({ type: 'system', text: `OCR failed: ${message}` })
      })
  }, [addMessage, inspection.inspectionId, inspection.isOffline, lastSnapshotUrl])

  const handleInterrupt = useCallback(() => {
    wsService.sendInterrupt()
    addMessage({ type: 'system', text: 'Interrupted' })
  }, [wsService, addMessage])

  const handleWorkflowAction = useCallback(
    (action: WorkflowActionType) => {
      if (!inspection.inspectionId) {
        addMessage({ type: 'system', text: 'Start an inspection first before triggering workflow actions.' })
        return
      }

      const note = `Triggered from live console at ${new Date().toLocaleTimeString()}`
      void inspectionService
        .runWorkflowAction(inspection.inspectionId, action, note)
        .then((event) => {
          addMessage({
            type: 'system',
            text: `${action}: ${event.resultMessage}`,
          })
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Workflow action failed'
          addMessage({ type: 'system', text: `${action} failed: ${message}` })
        })
    },
    [addMessage, inspection.inspectionId],
  )

  const handleStartCamera = useCallback(async () => {
    await startStream()

    if (!technicianId || !siteId) {
      addMessage({
        type: 'system',
        text: 'Select technician and site in Setup before starting an inspection.',
      })
      return
    }

    if (!inspection.inspectionId) {
      try {
        const inspectionId = await inspection.startInspection({ technicianId, siteId })
        wsService.sendInspectionContext(inspectionId)
        addMessage({ type: 'system', text: `Inspection started: ${inspectionId}` })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start inspection'
        addMessage({ type: 'system', text: `Inspection start failed: ${message}` })
      }
    }
  }, [addMessage, inspection, siteId, startStream, technicianId])

  const handleStopCamera = useCallback(() => {
    stopStream()
    const hadInspection = Boolean(inspection.inspectionId)

    void inspection.completeInspection('Inspection closed from camera stop.')
      .then((report) => {
        if (!hadInspection && !report) {
          return
        }
        addMessage({
          type: 'system',
          text: report
            ? `Inspection completed. Report ready: ${report.inspectionId}`
            : 'Inspection queued for completion. It will sync when network is back.',
        })
      })
      .catch(() => {
        // ignore when no inspection exists
      })
  }, [addMessage, inspection, stopStream])

  const handleSyncOfflineQueue = useCallback(() => {
    void inspection.syncPendingOperations()
      .then(() => {
        addMessage({ type: 'system', text: 'Offline queue sync completed.' })
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Offline sync failed'
        addMessage({ type: 'system', text: `Offline sync failed: ${message}` })
      })
  }, [addMessage, inspection])

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Assist</h1>
          <p className="text-muted-foreground">Real-time camera + voice troubleshooting session</p>
        </div>
        <Link href="/setup" className="text-sm px-3 py-2 rounded bg-secondary hover:bg-secondary/80">
          Go to Setup
        </Link>
      </header>

      <div className="rounded border p-3 text-sm">
        <span className="font-medium">Current selection:</span>{' '}
        {technicianId && siteId ? (
          <span className="text-muted-foreground">Technician `{technicianId}` at Site `{siteId}`</span>
        ) : (
          <span className="text-destructive">Not configured</span>
        )}
      </div>

      <div className="rounded border p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="font-medium">Connectivity:</span>{' '}
          {inspection.isOffline ? (
            <span className="text-amber-600">Offline mode active</span>
          ) : (
            <span className="text-emerald-600">Online</span>
          )}
          <span className="text-muted-foreground">
            {` | Pending sync items: ${inspection.pendingSyncCount}`}
          </span>
        </div>
        {!inspection.isOffline && inspection.pendingSyncCount > 0 ? (
          <button
            className="px-3 py-2 rounded bg-secondary hover:bg-secondary/80 text-xs"
            onClick={handleSyncOfflineQueue}
            disabled={inspection.isSyncing}
          >
            {inspection.isSyncing ? 'Syncing...' : 'Sync offline queue'}
          </button>
        ) : null}
      </div>

      <div className="rounded border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">Voice Commands</p>
        <p className="text-xs text-muted-foreground">
          Say these during push-to-talk to trigger workflow automation:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="rounded border p-2">"Create ticket"</div>
          <div className="rounded border p-2">"Notify my supervisor"</div>
          <div className="rounded border p-2">"Log this issue"</div>
          <div className="rounded border p-2">"Add this to history"</div>
        </div>
        <p className="text-xs text-muted-foreground">
          For external actions, the system asks for confirmation. Say "confirm" to proceed or
          "cancel" to abort.
        </p>
        {pendingVoiceConfirmation ? (
          <div className="rounded border border-amber-500/40 bg-amber-100/50 p-2 text-xs">
            Pending confirmation: <span className="font-semibold">{pendingVoiceConfirmation.action}</span>{' '}
            ({confirmationSecondsLeft}s)
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <VideoPlayer
            ref={videoRef}
            stream={stream}
            isStreaming={webRTCState.isStreaming}
            isLoading={webRTCState.isLoading}
            error={webRTCState.error}
          />
          <Controls
            isStreaming={webRTCState.isStreaming}
            isRecording={audioState.isRecording}
            audioLevel={audioState.audioLevel}
            onStartCamera={handleStartCamera}
            onStopCamera={handleStopCamera}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onCaptureSnapshot={handleCaptureSnapshot}
            onInterrupt={handleInterrupt}
          />
          <button
            className="px-3 py-2 rounded bg-secondary hover:bg-secondary/80 text-sm"
            onClick={handleRunOcr}
          >
            Run OCR on Latest Snapshot
          </button>
          <div className="rounded border p-3 space-y-2">
            <p className="text-xs font-semibold">Workflow automation</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="px-2 py-2 rounded bg-primary text-primary-foreground text-xs"
                onClick={() => handleWorkflowAction('log_issue')}
              >
                Log Issue
              </button>
              <button
                className="px-2 py-2 rounded bg-primary text-primary-foreground text-xs"
                onClick={() => handleWorkflowAction('create_ticket')}
              >
                Create Ticket
              </button>
              <button
                className="px-2 py-2 rounded bg-primary text-primary-foreground text-xs"
                onClick={() => handleWorkflowAction('notify_supervisor')}
              >
                Notify Supervisor
              </button>
              <button
                className="px-2 py-2 rounded bg-primary text-primary-foreground text-xs"
                onClick={() => handleWorkflowAction('add_to_history')}
              >
                Add to History
              </button>
            </div>
          </div>
        </div>

        <Transcript
          messages={messages}
          safetyFlags={safetyFlags}
          detectedFaults={detectedFaults}
        />
      </div>
    </div>
  )
}
