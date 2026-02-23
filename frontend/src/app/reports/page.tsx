'use client'

import { useState } from 'react'
import { ReportPanel } from '@/components/ReportPanel'
import { inspectionService, type InspectionReport } from '@/services/inspection-service'

export default function ReportsPage() {
  const [inspectionId, setInspectionId] = useState('')
  const [report, setReport] = useState<InspectionReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadReport() {
    if (!inspectionId) {
      setError('Inspection ID is required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await inspectionService.getReport(inspectionId)
      setReport(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

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
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Preview and download generated inspection reports</p>
      </header>

      <div className="rounded border p-4 space-y-2">
        <label className="text-sm font-medium">Inspection ID</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="Enter inspection id"
            value={inspectionId}
            onChange={(e) => setInspectionId(e.target.value)}
          />
          <button
            className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm"
            disabled={loading}
            onClick={() => void loadReport()}
          >
            Load Report
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <ReportPanel
        report={report}
        onRefresh={() => {
          void loadReport()
        }}
        onDownloadPdf={() => {
          void downloadPdf()
        }}
      />
    </div>
  )
}
