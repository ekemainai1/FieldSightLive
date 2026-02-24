'use client'

import { useState } from 'react'
import { inspectionService, type InspectionOcrResult } from '@/services/inspection-service'

export default function OcrPage() {
  const [inspectionId, setInspectionId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [result, setResult] = useState<InspectionOcrResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function runOcr() {
    if (!inspectionId.trim()) {
      setError('Inspection ID is required. Start an inspection from the Live page first.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await inspectionService.runOcr(inspectionId.trim(), imageUrl || undefined)
      setResult(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run OCR'
      if (message.includes('404') || message.includes('not found')) {
        setError(`Inspection "${inspectionId}" not found. Make sure the inspection ID is correct and you started it from the Live page.`)
      } else if (message.includes('No image')) {
        setError('No image found for this inspection. Capture a snapshot from the Live page first, then try again.')
      } else if (message.includes('fetch')) {
        setError('Could not access the image. Make sure the image URL is publicly accessible.')
      } else {
        setError(message)
      }
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Equipment OCR</h1>
        <p className="text-muted-foreground">
          Extract serial numbers, part codes, meter readings, and warning labels.
        </p>
      </header>

      <div className="rounded border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Run OCR on equipment images. First start an inspection and capture snapshots from the Live page.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Inspection ID (e.g., inspection_1234567890)"
            value={inspectionId}
            onChange={(e) => setInspectionId(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Image URL (optional - uses latest snapshot if empty)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
        <button
          className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm"
          onClick={() => void runOcr()}
          disabled={loading}
        >
          {loading ? 'Running OCR...' : 'Run OCR'}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="rounded border p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-lg font-semibold">{Math.round(result.confidence * 100)}%</p>
          </div>

          <section>
            <p className="text-sm font-semibold">Extracted Text</p>
            <p className="text-sm whitespace-pre-wrap">{result.extractedText || 'None'}</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <List title="Serial Numbers" items={result.serialNumbers} />
            <List title="Part Codes" items={result.partCodes} />
            <List title="Meter Readings" items={result.meterReadings} />
            <List title="Warning Labels" items={result.warningLabels} />
          </section>
        </div>
      )}
    </div>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="list-disc pl-5">
        {(items.length > 0 ? items : ['None']).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
