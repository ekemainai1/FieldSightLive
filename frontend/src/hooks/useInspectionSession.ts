import { useCallback, useEffect, useState } from 'react'
import { inspectionService, type InspectionReport } from '@/services/inspection-service'
import { offlineSyncQueueService } from '@/services/offline-sync-queue'

interface UseInspectionSessionState {
  inspectionId: string | null
  isBusy: boolean
  isSyncing: boolean
  isOffline: boolean
  pendingSyncCount: number
  error: string | null
  latestReport: InspectionReport | null
}

interface StartInspectionInput {
  technicianId: string
  siteId: string
}

export function useInspectionSession() {
  const [state, setState] = useState<UseInspectionSessionState>({
    inspectionId: null,
    isBusy: false,
    isSyncing: false,
    isOffline: false,
    pendingSyncCount: 0,
    error: null,
    latestReport: null,
  })

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const handleOnline = () => setState((prev) => ({ ...prev, isOffline: false }))
      const handleOffline = () => setState((prev) => ({ ...prev, isOffline: true }))

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      setState((prev) => ({ ...prev, isOffline: !navigator.onLine }))

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
    return undefined
  }, [])

  const syncPendingOperations = useCallback(async (): Promise<void> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState((prev) => ({
        ...prev,
        isOffline: true,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
      }))
      return
    }

    setState((prev) => ({ ...prev, isSyncing: true, error: null }))
    try {
      await offlineSyncQueueService.flush({
        onInspectionIdMapped: (localInspectionId, remoteInspectionId) => {
          setState((prev) => ({
            ...prev,
            inspectionId:
              prev.inspectionId === localInspectionId ? remoteInspectionId : prev.inspectionId,
          }))
        },
        onReportGenerated: (report) => {
          setState((prev) => ({ ...prev, latestReport: report }))
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync offline queue'
      setState((prev) => ({ ...prev, error: message }))
    } finally {
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : prev.isOffline,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
      }))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const refreshConnectivity = () => {
      const offline = !window.navigator.onLine
      setState((prev) => ({
        ...prev,
        isOffline: offline,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
      }))
      if (!offline) {
        void syncPendingOperations()
      }
    }

    refreshConnectivity()
    window.addEventListener('online', refreshConnectivity)
    window.addEventListener('offline', refreshConnectivity)

    return () => {
      window.removeEventListener('online', refreshConnectivity)
      window.removeEventListener('offline', refreshConnectivity)
    }
  }, [syncPendingOperations])

  const startInspection = useCallback(async (input: StartInspectionInput): Promise<string> => {
    setState((prev) => ({ ...prev, isBusy: true, error: null }))

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localInspectionId = offlineSyncQueueService.createOfflineInspectionId()
      offlineSyncQueueService.enqueueCreateInspection(localInspectionId, input)
      setState((prev) => ({
        ...prev,
        inspectionId: localInspectionId,
        isBusy: false,
        isOffline: true,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
        error: null,
      }))
      return localInspectionId
    }

    try {
      const inspection = await inspectionService.createInspection(input)
      setState((prev) => ({
        ...prev,
        inspectionId: inspection.id,
        isBusy: false,
        isOffline: false,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
        error: null,
      }))
      return inspection.id
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        const localInspectionId = offlineSyncQueueService.createOfflineInspectionId()
        offlineSyncQueueService.enqueueCreateInspection(localInspectionId, input)
        setState((prev) => ({
          ...prev,
          inspectionId: localInspectionId,
          isBusy: false,
          isOffline: true,
          pendingSyncCount: offlineSyncQueueService.getPendingCount(),
          error: null,
        }))
        return localInspectionId
      }

      const message = error instanceof Error ? error.message : 'Failed to start inspection'
      setState((prev) => ({ ...prev, isBusy: false, error: message }))
      throw error
    }
  }, [])

  const uploadSnapshot = useCallback(async (frameDataUrl: string): Promise<string> => {
    if (!state.inspectionId) {
      throw new Error('Inspection is not started')
    }

    setState((prev) => ({ ...prev, isBusy: true, error: null }))

    if (state.isOffline || state.inspectionId.startsWith('offline_')) {
      const operationId = offlineSyncQueueService.enqueueSnapshotUpload(state.inspectionId, frameDataUrl)
      setState((prev) => ({
        ...prev,
        isBusy: false,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
      }))
      return `offline://snapshot/${operationId}`
    }

    try {
      const imageUrl = await inspectionService.uploadSnapshot(state.inspectionId, frameDataUrl)
      setState((prev) => ({ ...prev, isBusy: false, error: null }))
      return imageUrl
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        const operationId = offlineSyncQueueService.enqueueSnapshotUpload(state.inspectionId, frameDataUrl)
        setState((prev) => ({
          ...prev,
          isBusy: false,
          isOffline: true,
          pendingSyncCount: offlineSyncQueueService.getPendingCount(),
          error: null,
        }))
        return `offline://snapshot/${operationId}`
      }

      const message = error instanceof Error ? error.message : 'Failed to upload snapshot'
      setState((prev) => ({ ...prev, isBusy: false, error: message }))
      throw error
    }
  }, [state.inspectionId, state.isOffline])

  const completeInspection = useCallback(async (summary?: string): Promise<InspectionReport | null> => {
    if (!state.inspectionId) {
      return null
    }

    setState((prev) => ({ ...prev, isBusy: true, error: null }))

    if (state.isOffline || state.inspectionId.startsWith('offline_')) {
      offlineSyncQueueService.enqueueCompleteInspection(state.inspectionId, summary)
      setState((prev) => ({
        ...prev,
        inspectionId: null,
        isBusy: false,
        pendingSyncCount: offlineSyncQueueService.getPendingCount(),
      }))
      return null
    }

    try {
      await inspectionService.completeInspection(state.inspectionId, { summary })
      const report = await inspectionService.generateReport(state.inspectionId)
      setState((prev) => ({
        ...prev,
        inspectionId: null,
        isBusy: false,
        error: null,
        latestReport: report,
      }))
      return report
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        offlineSyncQueueService.enqueueCompleteInspection(state.inspectionId, summary)
        setState((prev) => ({
          ...prev,
          inspectionId: null,
          isBusy: false,
          isOffline: true,
          pendingSyncCount: offlineSyncQueueService.getPendingCount(),
          error: null,
        }))
        return null
      }

      const message = error instanceof Error ? error.message : 'Failed to complete inspection'
      setState((prev) => ({ ...prev, isBusy: false, error: message }))
      throw error
    }
  }, [state.inspectionId, state.isOffline])

  const refreshLatestReport = useCallback(async (): Promise<InspectionReport | null> => {
    if (!state.latestReport?.inspectionId) {
      return null
    }

    const report = await inspectionService.getReport(state.latestReport.inspectionId)
    setState((prev) => ({ ...prev, latestReport: report }))
    return report
  }, [state.latestReport?.inspectionId])

  const loadReportForInspection = useCallback(async (inspectionId: string): Promise<InspectionReport> => {
    setState((prev) => ({ ...prev, isBusy: true, error: null }))
    try {
      const report = await inspectionService.getReport(inspectionId)
      setState((prev) => ({ ...prev, isBusy: false, latestReport: report }))
      return report
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load inspection report'
      setState((prev) => ({ ...prev, isBusy: false, error: message }))
      throw error
    }
  }, [])

  const downloadLatestReportPdf = useCallback(async (): Promise<Blob | null> => {
    if (!state.latestReport?.inspectionId) {
      return null
    }
    return inspectionService.downloadReportPdf(state.latestReport.inspectionId)
  }, [state.latestReport?.inspectionId])

  return {
    ...state,
    startInspection,
    uploadSnapshot,
    completeInspection,
    syncPendingOperations,
    refreshLatestReport,
    loadReportForInspection,
    downloadLatestReportPdf,
  }
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('load failed')
  )
}
