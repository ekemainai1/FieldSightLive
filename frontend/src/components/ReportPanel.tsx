'use client'

import type { InspectionReport } from '@/services/inspection-service'

interface ReportPanelProps {
  report: InspectionReport | null
  onRefresh: () => void
  onDownloadPdf: () => void
}

export function ReportPanel({ report, onRefresh, onDownloadPdf }: ReportPanelProps) {
  const downloadJson = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    triggerDownload(blob, `inspection-report-${report.inspectionId}.json`)
  }

  const downloadTxt = () => {
    if (!report) return
    const text = [
      `Inspection Report: ${report.inspectionId}`,
      `Generated At: ${new Date(report.generatedAt).toLocaleString()}`,
      `Status: ${report.status}`,
      `Images Captured: ${report.imageCount}`,
      '',
      'Summary',
      report.summaryText,
      '',
      'Findings',
      ...(report.findings.length > 0 ? report.findings : ['- None']),
      '',
      'Safety Flags',
      ...(report.safetySummary.length > 0 ? report.safetySummary : ['- None']),
      '',
      'Recommended Actions',
      ...(report.recommendedActions.length > 0 ? report.recommendedActions : ['- None']),
    ].join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    triggerDownload(blob, `inspection-report-${report.inspectionId}.txt`)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Report Preview</h2>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
            disabled={!report}
          >
            Refresh
          </button>
          <button
            onClick={onDownloadPdf}
            className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
            disabled={!report}
          >
            Download PDF
          </button>
          <button
            onClick={downloadTxt}
            className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
            disabled={!report}
          >
            Download TXT
          </button>
          <button
            onClick={downloadJson}
            className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
            disabled={!report}
          >
            Download JSON
          </button>
        </div>
      </div>

      {!report ? (
        <p className="text-xs text-muted-foreground">
          Complete an inspection to preview and download the generated report.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Summary</p>
            <p>{report.summaryText}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric label="Findings" value={report.findings.length} />
            <Metric label="Safety Flags" value={report.safetySummary.length} />
            <Metric label="Images" value={report.imageCount} />
          </div>
          <ListBlock title="Findings" items={report.findings} />
          <ListBlock title="Safety Flags" items={report.safetySummary} />
          <ListBlock title="Recommended Actions" items={report.recommendedActions} />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <ul className="list-disc pl-5">
        {(items.length > 0 ? items : ['None']).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
