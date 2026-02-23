import { useState, useRef, useCallback, useEffect } from 'react'

export interface AudioCaptureState {
  isRecording: boolean
  isProcessing: boolean
  error: string | null
  audioLevel: number
}

export interface AudioCaptureHooks {
  startRecording: (onChunk: (chunk: { pcmBase64: string; sampleRate: number; mimeType: string }) => void) => Promise<void>
  stopRecording: () => Promise<void>
  state: AudioCaptureState
}

const TARGET_SAMPLE_RATE = 16000

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

function toBase64FromInt16(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) {
    return input
  }

  const ratio = inputRate / TARGET_SAMPLE_RATE
  const newLength = Math.max(1, Math.round(input.length / ratio))
  const result = new Float32Array(newLength)

  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i += 1) {
      accum += input[i]
      count += 1
    }

    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult += 1
    offsetBuffer = nextOffsetBuffer
  }

  return result
}

export function useAudioCapture(): AudioCaptureHooks {
  const [state, setState] = useState<AudioCaptureState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioLevel: 0,
  })

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const onChunkRef = useRef<((chunk: { pcmBase64: string; sampleRate: number; mimeType: string }) => void) | null>(null)

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedLevel = Math.min(100, (average / 128) * 100)

    setState((prev) => ({ ...prev, audioLevel: normalizedLevel }))

    if (state.isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [state.isRecording])

  const startRecording = useCallback(async (onChunk: (chunk: {
    pcmBase64: string
    sampleRate: number
    mimeType: string
  }) => void) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      onChunkRef.current = onChunk

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const processor = audioContext.createScriptProcessor(1024, 1, 1)
      processorRef.current = processor
      source.connect(processor)
      processor.connect(audioContext.destination)

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const downsampled = downsampleTo16k(input, audioContext.sampleRate)
        const pcm16 = floatTo16BitPCM(downsampled)
        const pcmBase64 = toBase64FromInt16(pcm16)

        const handler = onChunkRef.current
        if (handler) {
          handler({
            pcmBase64,
            sampleRate: TARGET_SAMPLE_RATE,
            mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
          })
        }
      }

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
      }))

      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone'
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }))
    }
  }, [updateAudioLevel])

  const stopRecording = useCallback(async (): Promise<void> => {
    processorRef.current?.disconnect()
    processorRef.current = null
    sourceRef.current?.disconnect()
    sourceRef.current = null

    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    onChunkRef.current = null

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setState((prev) => ({
      ...prev,
      isRecording: false,
      audioLevel: 0,
    }))
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (processorRef.current) {
        processorRef.current.disconnect()
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return {
    startRecording,
    stopRecording,
    state,
  }
}
