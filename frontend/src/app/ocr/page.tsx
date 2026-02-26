'use client'

import { useState } from 'react'
import { inspectionService, type InspectionOcrResult } from '@/services/inspection-service'
import { useTranslation } from '@/hooks/useTranslation'
import { ScanText, Camera, Upload, AlertCircle, CheckCircle2, Loader2, Image } from 'lucide-react'

export default function OcrPage() {
  const t = useTranslation()
  const [inspectionId, setInspectionId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [result, setResult] = useState<InspectionOcrResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function runOcr() {
    // Validate inputs
    if (!inspectionId.trim() && !imageUrl.trim()) {
      setError('Please provide either an Inspection ID or an Image URL.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // If image URL is provided directly, use it; otherwise use inspection ID
      const targetImageUrl = imageUrl.trim() || undefined
      const targetInspectionId = inspectionId.trim() || undefined

      let data: InspectionOcrResult

      if (targetInspectionId) {
        data = await inspectionService.runOcr(targetInspectionId, targetImageUrl)
      } else if (targetImageUrl) {
        // Run OCR directly with image URL - need to handle this differently
        // For now, use a placeholder inspection ID
        setError('OCR with just image URL requires an inspection ID. Please enter an Inspection ID or capture a snapshot from the Live page.')
        setLoading(false)
        return
      } else {
        setError('Please provide either an Inspection ID or an Image URL.')
        setLoading(false)
        return
      }

      setResult(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run OCR'
      if (message.includes('404') || message.includes('not found')) {
        setError(`Inspection "${inspectionId}" not found. Make sure the inspection ID is correct and you started it from the Live page.`)
      } else if (message.includes('No image')) {
        setError('No image found for this inspection. Go to Live page, start an inspection, and capture at least one snapshot first.')
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
    <div className="min-h-screen p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-600/25">
          <ScanText className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            {t.ocr.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.ocr.extractText.replace('Text', 'text, serial numbers, and readings')}
          </p>
        </div>
      </header>

      {/* Instructions */}
      <div className="card-elevated p-4 lg:p-5">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          How to use OCR
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
            </div>
            <p>Go to <strong>Live Assist</strong> and start an inspection</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
            </div>
            <p>Capture snapshots using the camera button</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
            </div>
            <p>Copy the <strong>Inspection ID</strong> from the Live page</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 dark:text-blue-400 font-bold">4</span>
            </div>
            <p>Paste the ID here and click <strong>Run OCR</strong></p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="card-elevated p-4 lg:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-500" />
              Inspection ID
            </label>
            <input
              className="input-field"
              placeholder="e.g., inspection_1234567890"
              value={inspectionId}
              onChange={(e) => setInspectionId(e.target.value)}
            />
            <p className="text-xs text-slate-400">Get this from the Live page after starting an inspection</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Image className="w-4 h-4 text-purple-500" />
              Image URL (optional)
            </label>
            <input
              className="input-field"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <p className="text-xs text-slate-400">Leave empty to use the latest snapshot from inspection</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            onClick={() => void runOcr()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running OCR...
              </>
            ) : (
              <>
                <ScanText className="w-4 h-4" />
                Run OCR
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="card-elevated p-4 lg:p-5 space-y-5 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold">OCR Results</h2>
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {Math.round(result.confidence * 100)}%
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium">Confidence Score</p>
              <p className="text-xs">Higher is better</p>
            </div>
            <div className="flex-1 h-2 bg-emerald-200 dark:bg-emerald-800 rounded-full overflow-hidden ml-4">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${result.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Extracted Text */}
          {result.extractedText && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Extracted Text</h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-sm whitespace-pre-wrap font-mono">{result.extractedText}</p>
              </div>
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultList 
              title="Serial Numbers" 
              items={result.serialNumbers} 
              icon={<ScanText className="w-4 h-4" />}
              color="blue"
            />
            <ResultList 
              title="Part Codes" 
              items={result.partCodes} 
              icon={<Camera className="w-4 h-4" />}
              color="purple"
            />
            <ResultList 
              title="Meter Readings" 
              items={result.meterReadings} 
              icon={<Upload className="w-4 h-4" />}
              color="amber"
            />
            <ResultList 
              title="Warning Labels" 
              items={result.warningLabels} 
              icon={<AlertCircle className="w-4 h-4" />}
              color="red"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ResultList({ title, items, icon, color }: { 
  title: string; 
  items: string[]; 
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </span>
        {title}
      </h3>
      <div className={`p-3 rounded-xl border ${colorClasses[color]}`}>
        {items.length > 0 ? (
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li key={index} className="text-sm font-mono">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs opacity-60">None found</p>
        )}
      </div>
    </div>
  )
}
