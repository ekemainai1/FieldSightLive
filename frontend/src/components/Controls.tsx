'use client'

import { cn } from '@/lib/utils'

interface ControlsProps {
  isStreaming: boolean
  isRecording: boolean
  audioLevel: number
  onStartCamera: () => void
  onStopCamera: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onCaptureSnapshot: () => void
  onInterrupt: () => void
}

export function Controls({
  isStreaming,
  isRecording,
  audioLevel,
  onStartCamera,
  onStopCamera,
  onStartRecording,
  onStopRecording,
  onCaptureSnapshot,
  onInterrupt,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        {!isStreaming ? (
          <button
            onClick={onStartCamera}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Start Camera
          </button>
        ) : (
          <button
            onClick={onStopCamera}
            className="flex items-center gap-2 px-6 py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop Camera
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onMouseDown={onStartRecording}
          onMouseUp={onStopRecording}
          onMouseLeave={isRecording ? onStopRecording : undefined}
          onTouchStart={onStartRecording}
          onTouchEnd={onStopRecording}
          disabled={!isStreaming}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
          {isRecording ? 'Recording...' : 'Push to Talk'}
        </button>

        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-100"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onCaptureSnapshot}
          disabled={!isStreaming}
          className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Snapshot
        </button>

        <button
          onClick={onInterrupt}
          disabled={!isStreaming}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
          Stop
        </button>
      </div>
    </div>
  )
}
