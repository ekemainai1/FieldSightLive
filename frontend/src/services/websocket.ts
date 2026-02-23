export interface SafetyFlag {
  type: 'missing_ppe' | 'dangerous_proximity' | 'leak' | 'spark' | 'exposed_wire' | 'slippery_surface' | 'open_flame'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
}

export interface DetectedFault {
  component: string
  faultType: string
  confidence: number
  description: string
  recommendedActions: string[]
}

export interface GeminiResponse {
  type: 'gemini_response'
  text: string
  audio?: string
  safetyFlags?: SafetyFlag[]
  detectedFaults?: DetectedFault[]
  needsClarity?: boolean
  clarityRequest?: string
}

export type WebSocketMessageType =
  | 'connected'
  | 'join_session'
  | 'inspection_context'
  | 'video_frame'
  | 'audio'
  | 'audio_stream_end'
  | 'interrupt'
  | 'live_transcript'
  | 'gemini_response_chunk'
  | 'gemini_response'
  | 'error'

export interface WebSocketMessage {
  type: WebSocketMessageType
  [key: string]: unknown
}

type MessageHandler = (message: WebSocketMessage) => void

export interface WebSocketService {
  connect: (sessionId?: string) => void
  disconnect: () => void
  sendVideoFrame: (frame: string) => void
  sendAudio: (payload: { pcmBase64: string; sampleRate: number; mimeType: string }) => void
  sendAudioEnd: () => void
  sendInspectionContext: (inspectionId: string) => void
  sendInterrupt: () => void
  onMessage: (handler: MessageHandler) => () => void
  isConnected: boolean
}

type WebSocketAuthTokenProvider = () => Promise<string | null>

let wsAuthTokenProvider: WebSocketAuthTokenProvider = async () => null

export function setWebSocketAuthTokenProvider(provider: WebSocketAuthTokenProvider): void {
  wsAuthTokenProvider = provider
}

export function createWebSocketService(url: string): WebSocketService {
  let ws: WebSocket | null = null
  const messageHandlers: Set<MessageHandler> = new Set()
  let reconnectAttempts = 0
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  const maxReconnectAttempts = 5
  let intentionalDisconnect = false

  const notifyHandlers = (message: WebSocketMessage) => {
    messageHandlers.forEach((handler) => handler(message))
  }

  const buildCandidateUrls = (baseUrl: string): string[] => {
    const normalized = baseUrl.trim()
    const candidates = new Set<string>()
    candidates.add(normalized)

    if (normalized.endsWith('/ws')) {
      candidates.add(normalized.slice(0, -3))
    } else {
      candidates.add(`${normalized}/ws`)
    }

    return Array.from(candidates)
  }

  const withTokenIfPresent = (baseUrl: string, token: string | null): string => {
    if (!token) {
      return baseUrl
    }

    try {
      const parsed = new URL(baseUrl)
      parsed.searchParams.set('token', token)
      return parsed.toString()
    } catch {
      return baseUrl
    }
  }

  const connect = (sessionId?: string) => {
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connected or connecting')
      return
    }

    intentionalDisconnect = false
    const wsUrl = url || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'
    void wsAuthTokenProvider().then((token) => {
      const candidates = buildCandidateUrls(wsUrl).map((candidate) => withTokenIfPresent(candidate, token))

      const tryConnect = (index: number): void => {
        if (index >= candidates.length) {
          if (reconnectAttempts < maxReconnectAttempts && !intentionalDisconnect) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts += 1
              connect(sessionId)
            }, delay)
          }
          return
        }

        const candidateUrl = candidates[index]
        const socket = new WebSocket(candidateUrl)
        ws = socket
        let opened = false
        let switched = false

        socket.onopen = () => {
          opened = true
          reconnectAttempts = 0
          console.log('WebSocket connected:', candidateUrl)

          if (sessionId) {
            socket.send(JSON.stringify({ type: 'join_session', sessionId }))
          }
        }

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage
            notifyHandlers(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        socket.onerror = () => {
          if (intentionalDisconnect || switched) return
          if (!opened) {
            switched = true
            socket.close()
            tryConnect(index + 1)
            return
          }
          console.error('WebSocket runtime error on:', candidateUrl)
        }

        socket.onclose = (event) => {
          if (intentionalDisconnect) return

          if (!opened && !switched) {
            switched = true
            tryConnect(index + 1)
            return
          }

          console.log('WebSocket disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })

          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts += 1
              connect(sessionId)
            }, delay)
          }
        }
      }

      tryConnect(0)
    })
  }

  const disconnect = () => {
    intentionalDisconnect = true
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  const sendVideoFrame = (frame: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'video_frame',
        frame,
        timestamp: Date.now(),
      }))
    }
  }

  const sendAudio = (payload: { pcmBase64: string; sampleRate: number; mimeType: string }) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'audio',
        audio: payload.pcmBase64,
        mimeType: payload.mimeType,
        sampleRate: payload.sampleRate,
        timestamp: Date.now(),
      }))
    }
  }

  const sendAudioEnd = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'audio_stream_end',
        timestamp: Date.now(),
      }))
    }
  }

  const sendInspectionContext = (inspectionId: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'inspection_context',
        inspectionId,
      }))
    }
  }

  const sendInterrupt = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'interrupt' }))
    }
  }

  const onMessage = (handler: MessageHandler) => {
    messageHandlers.add(handler)
    return () => {
      messageHandlers.delete(handler)
    }
  }

  return {
    connect,
    disconnect,
    sendVideoFrame,
    sendAudio,
    sendAudioEnd,
    sendInspectionContext,
    sendInterrupt,
    onMessage,
    get isConnected(): boolean {
      return ws?.readyState === WebSocket.OPEN
    },
  }
}

let wsService: WebSocketService | null = null

export function getWebSocketService(url?: string): WebSocketService {
  if (!wsService) {
    const wsUrl = url || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'
    wsService = createWebSocketService(wsUrl)
  }
  return wsService
}
