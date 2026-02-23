'use client'

import { forwardRef, useEffect, useState } from 'react'

interface VideoPlayerProps {
  stream: MediaStream | null
  isStreaming: boolean
  isLoading: boolean
  error: string | null
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ stream, isStreaming, isLoading, error }, ref) => {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
      setMounted(true)
    }, [])

    useEffect(() => {
      if (!mounted) return
      if (!ref || typeof ref === 'function') return
      const video = ref.current
      if (!video) return

      video.srcObject = stream
      if (stream) {
        void video.play().catch(() => {
          // no-op: browser may block autoplay until gesture, controls still allow retry
        })
      }
    }, [mounted, ref, stream])

    if (!mounted) {
      return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <svg
                className="w-16 h-16 text-white/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-white/70">Loading...</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">Starting camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <svg
                className="w-12 h-12 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-destructive font-medium">{error}</p>
              <p className="text-white/70 text-sm">Please check camera permissions</p>
            </div>
          </div>
        )}

        {!isStreaming && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <svg
                className="w-16 h-16 text-white/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-white/70">Click &quot;Start Camera&quot; to begin</p>
            </div>
          </div>
        )}

        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />

        {isStreaming && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
              LIVE
            </span>
          </div>
        )}
      </div>
    )
  }
)

VideoPlayer.displayName = 'VideoPlayer'
