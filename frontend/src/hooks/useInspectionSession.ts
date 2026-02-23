import { useCallback, useState } from 'react'
import { inspectionService, type InspectionReport } from '@/services/inspection-service'

interface UseInspectionSessionState {
  inspectionId: string | null
  isBusy: boolean
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
    error: null,
    latestReport: null,
  })

  const startInspection = useCallback(async (input: StartInspectionInput): Promise<string> => {
    setState((prev) => ({ ...prev, isBusy: true, error: null }))
    try {
      const inspection = await inspectionService.createInspection(input)
      setState((prev) => ({
        ...prev,
        inspectionId: inspection.id,
        isBusy: false,
        error: null,
      }))
      return inspection.id
    } catch (error) {
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
    try {
      const imageUrl = await inspectionService.uploadSnapshot(state.inspectionId, frameDataUrl)
      setState((prev) => ({ ...prev, isBusy: false, error: null }))
      return imageUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload snapshot'
      setState((prev) => ({ ...prev, isBusy: false, error: message }))
      throw error
    }
  }, [state.inspectionId])

  const completeInspection = useCallback(async (summary?: string): Promise<InspectionReport | null> => {
    if (!state.inspectionId) {
      return null
    }

    setState((prev) => ({ ...prev, isBusy: true, error: null }))
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
      const message = error instanceof Error ? error.message : 'Failed to complete inspection'
      setState((prev) => ({ ...prev, isBusy: false, error: message }))
      throw error
    }
  }, [state.inspectionId])

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
    refreshLatestReport,
    loadReportForInspection,
    downloadLatestReportPdf,
  }
}
