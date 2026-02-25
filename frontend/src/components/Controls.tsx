'use client'

import { cn } from '@/lib/utils'
import { Camera, CameraOff, Mic, Square, Image, CircleStop, VolumeX } from 'lucide-react'

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
    <div className="card-elevated p-4 lg:p-5 space-y-4">
      {/* Camera Control */}
      <div className="flex justify-center">
        {!isStreaming ? (
          <button
            onClick={onStartCamera}
            className="btn-primary text-sm px-6 py-3"
          >
            <Camera className="w-5 h-5" />
            Start Camera
          </button>
        ) : (
          <button
            onClick={onStopCamera}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
          >
            <CameraOff className="w-5 h-5" />
            Stop Camera
          </button>
        )}
      </div>

      {/* Recording Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3">
        {/* Push to Talk */}
        <button
          onMouseDown={onStartRecording}
          onMouseUp={onStopRecording}
          onMouseLeave={isRecording ? onStopRecording : undefined}
          onTouchStart={onStartRecording}
          onTouchEnd={onStopRecording}
          disabled={!isStreaming}
          className={cn(
            'flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
            isStreaming && !isRecording && 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95',
            isRecording && 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25 animate-pulse-subtle'
          )}
        >
          {isRecording ? (
            <>
              <VolumeX className="w-5 h-5 animate-pulse" />
              <span>Recording...</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Push to Talk</span>
            </>
          )}
        </button>

        {/* Audio Level Indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            <div className="w-20 lg:w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-100 rounded-full"
                style={{ width: `${Math.max(5, audioLevel)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-8">
              {Math.round(audioLevel)}%
            </span>
          </div>
        )}

        {/* Snapshot */}
        <button
          onClick={onCaptureSnapshot}
          disabled={!isStreaming}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200',
            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed',
            isStreaming && 'active:scale-95'
          )}
        >
          <Image className="w-5 h-5" />
          Snapshot
        </button>

        {/* Interrupt */}
        <button
          onClick={onInterrupt}
          disabled={!isStreaming}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200',
            'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-40 disabled:cursor-not-allowed',
            isStreaming && 'active:scale-95'
          )}
        >
          <CircleStop className="w-5 h-5" />
          Stop
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">Space</kbd> to toggle recording
        </p>
      </div>
    </div>
  )
}
