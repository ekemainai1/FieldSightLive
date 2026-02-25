'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Camera, AlertCircle, Loader2 } from 'lucide-react'

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
        void video.play().catch(() => {})
      }
    }, [mounted, ref, stream])

    if (!mounted) {
      return (
        <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-elevated">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Camera className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">Loading camera...</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-elevated group">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
              <p className="text-white text-sm font-medium">Starting camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3 text-center px-4 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-red-400 font-semibold">{error}</p>
              <p className="text-slate-400 text-sm">Please check camera permissions</p>
            </div>
          </div>
        )}

        {!isStreaming && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Camera className="w-10 h-10 text-white/60" />
              </div>
              <p className="text-white/70 font-medium">Click &quot;Start Camera&quot; to begin</p>
              <p className="text-white/40 text-sm">Real-time AI analysis will start automatically</p>
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

        {/* Live Badge */}
        {isStreaming && (
          <div className="absolute top-4 left-4 flex items-center gap-2 z-30">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-white bg-emerald-600/80 backdrop-blur-sm px-2.5 py-1 rounded-full tracking-wide">
              LIVE
            </span>
          </div>
        )}

        {/* Corner Decorations */}
        <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-20" />
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-white/5 to-transparent pointer-events-none z-20" />
      </div>
    )
  }
)

VideoPlayer.displayName = 'VideoPlayer'
