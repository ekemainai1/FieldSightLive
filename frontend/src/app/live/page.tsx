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
import { inspectionService } from '@/services/inspection-service'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/hooks/useTranslation'
import { 
  Camera, 
  Mic, 
  Wifi, 
  WifiOff, 
  Settings,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  FileText,
  History,
  ScanText,
  Sparkles,
  User,
  MapPin
} from 'lucide-react'

export default function LivePage() {
  const t = useTranslation()
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

  const { stream, videoRef, startStream, stopStream, switchCamera, captureFrame, state: webRTCState, facingMode } = useWebRTC()
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
    if (!pendingVoiceConfirmation) return
    const timer = setInterval(() => setConfirmationNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pendingVoiceConfirmation])

  useEffect(() => {
    if (!sessionId) setSessionId(`session_${Date.now()}`)
  }, [sessionId, setSessionId])

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message: WebSocketMessage) => {
      switch (message.type) {
        case 'connected':
          setConnected(true)
          addMessage({ type: 'system', text: t.status.connected })
          if (inspection.inspectionId) wsService.sendInspectionContext(inspection.inspectionId)
          break
        case 'live_transcript':
          if (typeof message.text === 'string' && message.text.trim().length > 0) {
            addMessage({ type: 'user', text: message.text })
          }
          break
        case 'workflow_confirmation':
          if (message.status === 'pending') {
            const action = typeof message.action === 'string' ? message.action : 'workflow_action'
            const expiresAt = typeof message.expiresAt === 'number' ? message.expiresAt : Date.now() + 30000
            setPendingVoiceConfirmation({ action, expiresAt })
            addMessage({ type: 'system', text: `WF_CONFIRM|pending|${action}|Awaiting voice confirmation` })
          } else {
            setPendingVoiceConfirmation(null)
            addMessage({ type: 'system', text: `WF_CONFIRM|${message.status || 'expired'}|${message.action || 'workflow_action'}|Voice confirmation ${message.status || 'expired'}` })
          }
          break
        case 'gemini_response':
          addMessage({ type: 'agent', text: (message.text as string) || '' })
          if (Array.isArray(message.safetyFlags) && message.safetyFlags.length) {
            message.safetyFlags.forEach((flag) => addSafetyFlag(flag as Parameters<typeof addSafetyFlag>[0]))
          }
          if (Array.isArray(message.detectedFaults) && message.detectedFaults.length) {
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
  }, [wsService, setConnected, addMessage, addSafetyFlag, addDetectedFault, inspection.inspectionId])

  const confirmationSecondsLeft = pendingVoiceConfirmation ? Math.max(0, Math.ceil((pendingVoiceConfirmation.expiresAt - confirmationNow) / 1000)) : 0

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
      addMessage({ type: 'system', text: 'Offline mode: voice streaming is unavailable.' })
      return
    }
    if (!wsService.isConnected) {
      addMessage({ type: 'system', text: 'WebSocket not connected. Start camera first.' })
      return
    }
    await startRecording((chunk) => wsService.sendAudio(chunk))
  }, [addMessage, inspection.isOffline, startRecording, wsService])

  const handleStopRecording = useCallback(async () => {
    await stopRecording()
    addMessage({ type: 'user', text: '[Audio stream sent]' })
    wsService.sendAudioEnd()
  }, [stopRecording, wsService, addMessage])

  const handleCaptureSnapshot = useCallback(() => {
    const frame = captureFrame()
    if (frame) {
      if (!inspection.isOffline) wsService.sendVideoFrame(frame)
      addMessage({ type: 'system', text: 'Snapshot captured' })
      void inspection.uploadSnapshot(frame)
        .then((imageUrl) => {
          if (imageUrl.startsWith('offline://')) {
            addMessage({ type: 'system', text: 'Snapshot queued for sync.' })
            return
          }
          setLastSnapshotUrl(imageUrl)
          addMessage({ type: 'system', text: `Snapshot uploaded` })
        })
        .catch((error) => addMessage({ type: 'system', text: `Snapshot upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` }))
    }
  }, [addMessage, captureFrame, inspection, wsService])

  const handleRunOcr = useCallback(() => {
    if (inspection.isOffline) {
      addMessage({ type: 'system', text: 'Offline mode: OCR requires network.' })
      return
    }
    if (!inspection.inspectionId) {
      addMessage({ type: 'system', text: 'Start inspection first.' })
      return
    }
    void inspectionService.runOcr(inspection.inspectionId, lastSnapshotUrl || undefined)
      .then((ocr) => {
        const summary = [
          ocr.serialNumbers.length > 0 ? `Serial: ${ocr.serialNumbers.join(', ')}` : null,
          ocr.partCodes.length > 0 ? `Part codes: ${ocr.partCodes.join(', ')}` : null,
          ocr.meterReadings.length > 0 ? `Readings: ${ocr.meterReadings.join(', ')}` : null,
        ].filter(Boolean).join(' | ')
        addMessage({ type: 'system', text: summary || `OCR completed (${Math.round(ocr.confidence * 100)}% confidence).` })
      })
      .catch((error) => addMessage({ type: 'system', text: `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}` }))
  }, [addMessage, inspection.inspectionId, inspection.isOffline, lastSnapshotUrl])

  const handleInterrupt = useCallback(() => {
    wsService.sendInterrupt()
    addMessage({ type: 'system', text: 'Interrupted' })
  }, [wsService, addMessage])

  const handleWorkflowAction = useCallback((action: 'log_issue' | 'create_ticket' | 'notify_supervisor' | 'add_to_history') => {
    if (!inspection.inspectionId) {
      addMessage({ type: 'system', text: 'Start inspection first.' })
      return
    }
    const note = `Triggered from live console at ${new Date().toLocaleTimeString()}`
    void inspectionService.runWorkflowAction(inspection.inspectionId, action, note)
      .then((event) => addMessage({ type: 'system', text: `${action}: ${event.resultMessage}` }))
      .catch((error) => addMessage({ type: 'system', text: `${action} failed: ${error instanceof Error ? error.message : 'Unknown error'}` }))
  }, [addMessage, inspection.inspectionId])

  const handleStartCamera = useCallback(async () => {
    await startStream()
    if (!technicianId || !siteId) {
      addMessage({ type: 'system', text: 'Select technician and site in Setup first.' })
      return
    }
    if (!inspection.inspectionId) {
      try {
        const inspectionId = await inspection.startInspection({ technicianId, siteId })
        wsService.sendInspectionContext(inspectionId)
        addMessage({ type: 'system', text: `Inspection started: ${inspectionId}` })
      } catch (error) {
        addMessage({ type: 'system', text: `Inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
      }
    }
  }, [addMessage, inspection, siteId, startStream, technicianId])

  const handleStopCamera = useCallback(() => {
    stopStream()
    const hadInspection = Boolean(inspection.inspectionId)
    void inspection.completeInspection('Inspection closed from camera stop.')
      .then((report) => {
        if (!hadInspection && !report) return
        addMessage({ type: 'system', text: report ? `Inspection completed. Report: ${report.inspectionId}` : 'Inspection queued for completion.' })
      })
      .catch(() => {})
  }, [addMessage, inspection, stopStream])

  const handleSyncOfflineQueue = useCallback(() => {
    void inspection.syncPendingOperations()
      .then(() => addMessage({ type: 'system', text: 'Offline queue sync completed.' }))
      .catch((error) => addMessage({ type: 'system', text: `Offline sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` }))
  }, [addMessage, inspection])

  return (
    <div className="min-h-screen p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 pl-12 sm:pl-0">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
            <Camera className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Live Assist
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Real-time AI-powered troubleshooting
            </p>
          </div>
        </div>
        <Link href="/setup" className="btn-secondary text-sm">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Setup</span>
        </Link>
      </header>

      {/* Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Connection Status */}
        <div className="card-elevated p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inspection.isOffline ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
            {inspection.isOffline ? <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400" /> : <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
            <p className={`font-semibold text-sm ${inspection.isOffline ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {inspection.isOffline ? 'Offline Mode' : 'Connected'}
            </p>
          </div>
        </div>

        {/* Current Session */}
        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Technician</p>
            <p className="font-semibold text-sm truncate">{technicianId || 'Not set'}</p>
          </div>
        </div>

        {/* Site */}
        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Site</p>
            <p className="font-semibold text-sm truncate">{siteId || 'Not set'}</p>
          </div>
        </div>

        {/* Inspection */}
        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">Inspection ID</p>
            <p className="font-semibold text-sm truncate font-mono">{inspection.inspectionId ? inspection.inspectionId.slice(0, 12) + '...' : 'Not started'}</p>
          </div>
        </div>
      </div>

      {/* Voice Commands */}
      <div className="card-elevated p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold">Voice Commands</h2>
          </div>
          <Link href="/agent" className="btn-ghost text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            Try AI Assistant
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {[
            { cmd: '"Create ticket"', action: 'create_ticket' },
            { cmd: '"Notify supervisor"', action: 'notify_supervisor' },
            { cmd: '"Log issue"', action: 'log_issue' },
            { cmd: '"Add to history"', action: 'add_to_history' },
          ].map((item) => (
            <button
              key={item.action}
              onClick={() => handleWorkflowAction(item.action as 'log_issue' | 'create_ticket' | 'notify_supervisor' | 'add_to_history')}
              className="text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all text-left"
            >
              {item.cmd}
            </button>
          ))}
        </div>

        {pendingVoiceConfirmation ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Awaiting confirmation: <span className="font-bold">{pendingVoiceConfirmation.action}</span>
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Say "confirm" or "cancel"</p>
            </div>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{confirmationSecondsLeft}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Say these commands during push-to-talk. External actions require confirmation.
          </p>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Video & Controls */}
        <div className="space-y-4 lg:space-y-5">
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
            onSwitchCamera={switchCamera}
            facingMode={facingMode}
          />

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleRunOcr}
              disabled={!inspection.inspectionId}
              className="btn-secondary text-sm justify-center"
            >
              <ScanText className="w-4 h-4" />
              Run OCR
            </button>
            {!inspection.isOffline && inspection.pendingSyncCount > 0 && (
              <button
                onClick={handleSyncOfflineQueue}
                disabled={inspection.isSyncing}
                className="btn-secondary text-sm justify-center"
              >
                <History className="w-4 h-4" />
                {inspection.isSyncing ? 'Syncing...' : `Sync (${inspection.pendingSyncCount})`}
              </button>
            )}
          </div>
        </div>

        {/* Transcript */}
        <Transcript
          messages={messages}
          safetyFlags={safetyFlags}
          detectedFaults={detectedFaults}
        />
      </div>
    </div>
  )
}
