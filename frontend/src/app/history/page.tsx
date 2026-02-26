'use client'

import { useState } from 'react'
import { HistoryPanel } from '@/components/HistoryPanel'
import { ReportPanel } from '@/components/ReportPanel'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/hooks/useTranslation'
import {
  inspectionService,
  type Inspection,
  type InspectionReport,
  type WorkflowActionEvent,
} from '@/services/inspection-service'

export default function HistoryPage() {
  const t = useTranslation()
  const technicianId = useAppStore((state) => state.selection.technicianId)
  const siteId = useAppStore((state) => state.selection.siteId)
  const [report, setReport] = useState<InspectionReport | null>(null)
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function openReport(inspectionId: string) {
    setError(null)
    try {
      const [next, inspection] = await Promise.all([
        inspectionService.getReport(inspectionId),
        inspectionService.getInspection(inspectionId),
      ])
      setReport(next)
      setSelectedInspection(inspection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    }
  }

  function getSortedWorkflowEvents(events: WorkflowActionEvent[] | undefined): WorkflowActionEvent[] {
    if (!events || events.length === 0) {
      return []
    }
    return [...events].sort((a, b) => {
      const left = new Date(a.createdAt).getTime()
      const right = new Date(b.createdAt).getTime()
      return right - left
    })
  }

  const workflowEvents = getSortedWorkflowEvents(selectedInspection?.workflowEvents)

  async function downloadPdf() {
    if (!report) return
    const blob = await inspectionService.downloadReportPdf(report.inspectionId)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `inspection-report-${report.inspectionId}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t.history.title}</h1>
        <p className="text-muted-foreground">{t.history.filterByDate} & {t.history.filterBySite}</p>
      </header>

      <HistoryPanel
        technicianId={technicianId}
        siteId={siteId}
        onOpenReport={(inspectionId) => {
          void openReport(inspectionId)
        }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Workflow Timeline</h2>
          <span className="text-xs text-muted-foreground">
            {workflowEvents.length} event{workflowEvents.length === 1 ? '' : 's'}
          </span>
        </div>
        {workflowEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Open an inspection report to view workflow automation events.
          </p>
        ) : (
          <ul className="space-y-2">
            {workflowEvents.map((event) => (
              <li key={event.id} className="rounded border p-2 text-xs">
                <p className="font-medium">
                  {event.action} - {event.status}
                </p>
                <p className="text-muted-foreground">{event.resultMessage}</p>
                <p className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReportPanel
        report={report}
        onRefresh={() => {
          if (report) {
            void openReport(report.inspectionId)
          }
        }}
        onDownloadPdf={() => {
          void downloadPdf()
        }}
      />
    </div>
  )
}
