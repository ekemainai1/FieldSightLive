'use client'

import { useCallback, useEffect, useState } from 'react'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Controls } from '@/components/Controls'
import { Transcript } from '@/components/Transcript'
import { SetupPanel } from '@/components/SetupPanel'
import { ReportPanel } from '@/components/ReportPanel'
import { HistoryPanel } from '@/components/HistoryPanel'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { useInspectionSession } from '@/hooks/useInspectionSession'
import { getWebSocketService, WebSocketMessage } from '@/services/websocket'
import { useAppStore } from '@/lib/store'

export default function Home() {
  const sessionId = useAppStore((state) => state.sessionId)
  const setSessionId = useAppStore((state) => state.setSessionId)
  const setConnected = useAppStore((state) => state.setConnected)
  const addMessage = useAppStore((state) => state.addMessage)
  const messages = useAppStore((state) => state.messages)
  const safetyFlags = useAppStore((state) => state.safetyFlags)
  const detectedFaults = useAppStore((state) => state.detectedFaults)
  const addSafetyFlag = useAppStore((state) => state.addSafetyFlag)
  const addDetectedFault = useAppStore((state) => state.addDetectedFault)

  const { stream, videoRef, startStream, stopStream, captureFrame, state: webRTCState } = useWebRTC()
  const { startRecording, stopRecording, state: audioState } = useAudioCapture()
  const inspection = useInspectionSession()
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_TECHNICIAN_ID || ''
  )
  const [selectedSiteId, setSelectedSiteId] = useState(process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '')
  const wsService = getWebSocketService()

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
  }, [wsService, setConnected, addMessage, addSafetyFlag, addDetectedFault])

  useEffect(() => {
    if (webRTCState.isStreaming && sessionId) {
      wsService.connect(sessionId)
    } else {
      wsService.disconnect()
    }
    return () => wsService.disconnect()
  }, [webRTCState.isStreaming, sessionId, wsService])

  const handleStartRecording = useCallback(async () => {
    await startRecording((chunk) => {
      wsService.sendAudio(chunk)
    })
  }, [startRecording, wsService])

  const handleStopRecording = useCallback(async () => {
    await stopRecording()
    addMessage({ type: 'user', text: '[Audio stream sent]' })
    wsService.sendAudioEnd()
  }, [stopRecording, wsService, addMessage])

  const handleCaptureSnapshot = useCallback(() => {
    const frame = captureFrame()
    if (frame) {
      wsService.sendVideoFrame(frame)
      addMessage({ type: 'system', text: 'Snapshot captured' })
      void inspection.uploadSnapshot(frame)
        .then((imageUrl) => {
          addMessage({ type: 'system', text: `Snapshot uploaded: ${imageUrl}` })
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Snapshot upload failed'
          addMessage({ type: 'system', text: `Snapshot upload failed: ${message}` })
        })
    }
  }, [captureFrame, wsService, addMessage, inspection])

  const handleInterrupt = useCallback(() => {
    wsService.sendInterrupt()
    addMessage({ type: 'system', text: 'Interrupted' })
  }, [wsService, addMessage])

  const handleStartCamera = useCallback(async () => {
    await startStream()
    const technicianId = selectedTechnicianId
    const siteId = selectedSiteId

    if (!technicianId || !siteId) {
      addMessage({
        type: 'system',
        text: 'Set NEXT_PUBLIC_DEFAULT_TECHNICIAN_ID and NEXT_PUBLIC_DEFAULT_SITE_ID to persist inspections.',
      })
      return
    }

    if (!inspection.inspectionId) {
      try {
        const inspectionId = await inspection.startInspection({ technicianId, siteId })
        addMessage({ type: 'system', text: `Inspection started: ${inspectionId}` })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start inspection'
        addMessage({ type: 'system', text: `Inspection start failed: ${message}` })
      }
    }
  }, [addMessage, inspection, selectedSiteId, selectedTechnicianId, startStream])

  const handleStopCamera = useCallback(() => {
    stopStream()
    void inspection.completeInspection('Inspection closed from camera stop.')
      .then((report) => {
        addMessage({
          type: 'system',
          text: report
            ? `Inspection completed. Report ready: ${report.inspectionId}`
            : 'Inspection completed.',
        })
      })
      .catch(() => {
        // ignore when no inspection exists
      })
  }, [addMessage, inspection, stopStream])

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">FieldSight Live</h1>
          <p className="text-muted-foreground">AI-Assisted Field Technician Companion</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <SetupPanel
            technicianId={selectedTechnicianId}
            siteId={selectedSiteId}
            onTechnicianChange={setSelectedTechnicianId}
            onSiteChange={setSelectedSiteId}
          />
        </div>
        <div className="mb-6">
          <ReportPanel
            report={inspection.latestReport}
            onRefresh={() => {
              void inspection.refreshLatestReport()
            }}
            onDownloadPdf={() => {
              void inspection.downloadLatestReportPdf()
                .then((blob) => {
                  if (!blob || !inspection.latestReport) {
                    return
                  }
                  const url = URL.createObjectURL(blob)
                  const anchor = document.createElement('a')
                  anchor.href = url
                  anchor.download = `inspection-report-${inspection.latestReport.inspectionId}.pdf`
                  document.body.appendChild(anchor)
                  anchor.click()
                  anchor.remove()
                  URL.revokeObjectURL(url)
                })
                .catch((error) => {
                  const message = error instanceof Error ? error.message : 'PDF download failed'
                  addMessage({ type: 'system', text: `PDF download failed: ${message}` })
                })
            }}
          />
        </div>
        <div className="mb-6">
          <HistoryPanel
            technicianId={selectedTechnicianId}
            siteId={selectedSiteId}
            onOpenReport={(inspectionId) => {
              void inspection.loadReportForInspection(inspectionId)
                .then(() => {
                  addMessage({ type: 'system', text: `Loaded report: ${inspectionId}` })
                })
                .catch((error) => {
                  const message = error instanceof Error ? error.message : 'Failed to load report'
                  addMessage({ type: 'system', text: `Report load failed: ${message}` })
                })
            }}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          </div>

          <div>
            <Transcript
              messages={messages}
              safetyFlags={safetyFlags}
              detectedFaults={detectedFaults}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
