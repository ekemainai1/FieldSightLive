import { useState, useRef, useCallback, useEffect } from 'react'

export interface WebRTCState {
  isStreaming: boolean
  isLoading: boolean
  error: string | null
}

export interface WebRTCHooks {
  stream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
  startStream: () => Promise<void>
  stopStream: () => void
  captureFrame: () => string | null
  state: WebRTCState
}

export function useWebRTC(): WebRTCHooks {
  const [state, setState] = useState<WebRTCState>({
    isStreaming: false,
    isLoading: false,
    error: null,
  })

  const [stream, setStream] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const getCanvas = useCallback(() => {
    if (!canvasRef.current && typeof document !== 'undefined') {
      canvasRef.current = document.createElement('canvas')
    }
    return canvasRef.current
  }, [])

  const startStream = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const existingStream = streamRef.current
      if (existingStream) {
        existingStream.getTracks().forEach((track) => track.stop())
      }

      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      setStream(mediaStream)
      streamRef.current = mediaStream

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play().catch(() => undefined)
      }

      const videoTrack = mediaStream.getVideoTracks()[0]
      if (!videoTrack || videoTrack.readyState !== 'live') {
        throw new Error('Camera stream is not active. Check camera permissions and device settings.')
      }

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        isLoading: false,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
    }
  }, [])

  const stopStream = useCallback(() => {
    const activeStream = streamRef.current
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setState((prev) => ({
      ...prev,
      isStreaming: false,
    }))
  }, [])

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !state.isStreaming) {
      return null
    }

    const video = videoRef.current
    const canvas = getCanvas()
    if (!canvas) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [state.isStreaming, getCanvas])

  useEffect(() => {
    return () => {
      const activeStream = streamRef.current
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return {
    stream,
    videoRef,
    startStream,
    stopStream,
    captureFrame,
    state,
  }
}
