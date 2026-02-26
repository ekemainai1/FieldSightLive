'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Camera, CameraOff, Mic, Square, Image, CircleStop, VolumeX, FlipHorizontal, Wifi, WifiOff } from 'lucide-react'
import { AudioVisualizer } from './AudioVisualizer'

type VideoQuality = 'low' | 'medium' | 'high' | 'auto'

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
  onSwitchCamera?: () => void
  onQualityChange?: (quality: VideoQuality) => void
  facingMode?: 'user' | 'environment'
  currentQuality?: VideoQuality
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
  onSwitchCamera,
  onQualityChange,
  facingMode = 'environment',
  currentQuality = 'auto',
}: ControlsProps) {
  const [showQualityMenu, setShowQualityMenu] = useState(false)

  const qualityOptions: { value: VideoQuality; label: string; resolution: string }[] = [
    { value: 'low', label: 'Low', resolution: '320p' },
    { value: 'medium', label: 'Medium', resolution: '480p' },
    { value: 'high', label: 'High', resolution: '720p' },
    { value: 'auto', label: 'Auto', resolution: 'Adaptive' },
  ]

  const handleQualitySelect = (quality: VideoQuality) => {
    onQualityChange?.(quality)
    setShowQualityMenu(false)
  }

  return (
    <div className="card-elevated p-4 lg:p-5 space-y-4">
      {/* Camera Control */}
      <div className="flex justify-center gap-3">
        {!isStreaming ? (
          <button
            onClick={onStartCamera}
            className="btn-primary text-sm px-6 py-3"
          >
            <Camera className="w-5 h-5" />
            Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={onStopCamera}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              <CameraOff className="w-5 h-5" />
              Stop Camera
            </button>
            {onSwitchCamera && (
              <button
                onClick={onSwitchCamera}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                aria-label={`Switch to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
              >
                <FlipHorizontal className="w-5 h-5" />
                {facingMode === 'environment' ? 'Selfie' : 'Back'}
              </button>
            )}
          </>
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

        {/* Audio Visualizer */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 min-w-[140px]">
            <AudioVisualizer isActive={isRecording} audioLevel={audioLevel} className="flex-1" />
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

        {/* Low Bandwidth Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowQualityMenu(!showQualityMenu)}
            disabled={!isStreaming}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200',
              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed',
              currentQuality !== 'auto' && 'ring-2 ring-blue-500/50'
            )}
          >
            {currentQuality === 'auto' ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            {qualityOptions.find(q => q.value === currentQuality)?.label || 'Auto'}
          </button>

          {/* Quality Dropdown */}
          {showQualityMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-50">
              {qualityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleQualitySelect(option.value)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
                    currentQuality === option.value && 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  )}
                >
                  <span className="block">{option.label}</span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">{option.resolution}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
