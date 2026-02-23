'use client'

import { useEffect, useState } from 'react'
import { inspectionService } from '@/services/inspection-service'

interface InspectionItem {
  id: string
  status: 'in_progress' | 'completed'
  technicianId?: string
  siteId?: string
  timestamp?: string
}

interface HistoryPanelProps {
  technicianId?: string
  siteId?: string
  onOpenReport: (inspectionId: string) => void
}

export function HistoryPanel({ technicianId, siteId, onOpenReport }: HistoryPanelProps) {
  const [items, setItems] = useState<InspectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadHistory()
  }, [technicianId, siteId])

  async function loadHistory() {
    setLoading(true)
    setError(null)
    try {
      const list = await inspectionService.listInspections({
        technicianId: technicianId || undefined,
        siteId: siteId || undefined,
      })
      setItems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Inspection History</h2>
        <button
          onClick={() => void loadHistory()}
          className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No inspections found for current filters.</p>
      ) : (
        <div className="max-h-56 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-2 py-2">Inspection</th>
                <th className="text-left px-2 py-2">Status</th>
                <th className="text-left px-2 py-2">Time</th>
                <th className="text-left px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-2 py-2 font-mono">{item.id.slice(0, 8)}...</td>
                  <td className="px-2 py-2">{item.status}</td>
                  <td className="px-2 py-2">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => onOpenReport(item.id)}
                      className="px-2 py-1 rounded bg-primary text-primary-foreground"
                    >
                      Open Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
