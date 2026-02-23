import 'dotenv/config'
import { GoogleAuth } from 'google-auth-library'
import { GoogleGenAI } from '@google/genai'
import WebSocket from 'ws'
import type {
  AudioMessage,
  DetectedFault,
  GeminiResponse,
  SafetyFlag,
  VideoFrameMessage,
} from '../types'

interface ParsedGeminiPayload {
  text: string
  safetyFlags?: Array<{
    type: SafetyFlag['type']
    severity: SafetyFlag['severity']
    description: string
  }>
  detectedFaults?: Array<{
    component: string
    faultType: string
    confidence: number
    description: string
    recommendedActions: string[]
  }>
  needsClarity?: boolean
  clarityRequest?: string
}

type ChunkHandler = (textChunk: string) => void

export interface LiveResponseEvent {
  type: 'chunk' | 'final' | 'interrupted' | 'error' | 'transcript'
  text?: string
  message?: string
}

type LiveEventHandler = (event: LiveResponseEvent) => void

interface LiveSession {
  ws: WebSocket
  currentTurnText: string
  handler: LiveEventHandler
}

export interface LiveHealthStatus {
  liveApiOk: boolean
  directApiConfigured: boolean
  reason?: string
}

const SYSTEM_PROMPT = `You are VisionAssist, a real-time technician support agent.
You receive live video frames and/or field audio updates.

Rules:
- Keep responses short and actionable.
- Prioritize safety warnings when present.
- Ask for better angle/lighting if confidence is low.
- Return strict JSON only (no markdown code fences).

Return JSON shape:
{
  "text": "string",
  "needsClarity": boolean,
  "clarityRequest": "string | null",
  "safetyFlags": [{
    "type": "missing_ppe|dangerous_proximity|leak|spark|exposed_wire|slippery_surface|open_flame",
    "severity": "low|medium|high|critical",
    "description": "string"
  }],
  "detectedFaults": [{
    "component": "string",
    "faultType": "string",
    "confidence": number,
    "description": "string",
    "recommendedActions": ["string"]
  }]
}`

const DIRECT_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash']

export class GeminiLiveService {
  private client: GoogleGenAI | null = null
  private clientApiKey: string | null = null
  private liveSessions: Map<string, LiveSession> = new Map()

  public async analyzeVideoFrame(
    message: VideoFrameMessage,
    onChunk?: ChunkHandler,
  ): Promise<GeminiResponse> {
    const imageData = this.extractBase64Data(message.frame)
    if (!imageData) {
      return this.fallbackResponse('I could not read the frame. Capture another snapshot.')
    }

    const prompt =
      'Analyze this equipment image for faults and safety risks. Give next step guidance.'

    try {
      const liveText = await this.runLiveTurn([
        {
          realtime_input: {
            video: {
              mime_type: imageData.mimeType,
              data: imageData.data,
            },
          },
        },
        {
          client_content: {
            turns: [{ role: 'user', parts: [{ text: prompt }] }],
            turn_complete: true,
          },
        },
      ])

      const parsed = this.parseGeminiJson(liveText)
      return this.toResponse(parsed)
    } catch {
      const direct = await this.generateStructuredResponse(
        [
          { text: SYSTEM_PROMPT },
          { text: prompt },
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          },
        ],
        onChunk,
      )
      return direct
    }
  }

  public async analyzeAudio(message: AudioMessage, onChunk?: ChunkHandler): Promise<GeminiResponse> {
    const transcript = message.transcript?.trim()
    const prompt = transcript
      ? `Technician said: "${transcript}". Provide the next best action.`
      : 'Analyze the technician audio and provide the next best action in short steps.'

    const mimeType = message.mimeType?.trim() || 'audio/pcm;rate=16000'
    const hasAudioPayload = typeof message.audio === 'string' && message.audio.length > 0

    try {
      const liveMessages: Array<Record<string, unknown>> = []

      if (hasAudioPayload) {
        liveMessages.push({
          realtime_input: {
            media_chunks: [
              {
                mime_type: mimeType,
                data: message.audio,
              },
            ],
          },
        })
      }

      liveMessages.push({
        client_content: {
          turns: [{ role: 'user', parts: [{ text: prompt }] }],
          turn_complete: true,
        },
      })

      const liveText = await this.runLiveTurn(liveMessages)
      const parsed = this.parseGeminiJson(liveText)
      return this.toResponse(parsed)
    } catch {
      return this.generateStructuredResponse(
        [
          { text: SYSTEM_PROMPT },
          { text: prompt },
        ],
        onChunk,
      )
    }
  }

  public async handleInterrupt(): Promise<GeminiResponse> {
    return {
      type: 'gemini_response',
      text: 'Stopped. Tell me what to inspect next and point camera at the target part.',
    }
  }

  public async startLiveSession(clientId: string, handler: LiveEventHandler): Promise<boolean> {
    if (this.liveSessions.has(clientId)) {
      const existing = this.liveSessions.get(clientId)
      if (existing) {
        existing.handler = handler
      }
      return true
    }

    try {
      const session = await this.createLiveSession(handler)
      this.liveSessions.set(clientId, session)
      return true
    } catch {
      return false
    }
  }

  public hasLiveSession(clientId: string): boolean {
    return this.liveSessions.has(clientId)
  }

  public async sendAudioChunk(clientId: string, message: AudioMessage): Promise<void> {
    const session = this.liveSessions.get(clientId)
    if (!session) {
      throw new Error('Live session not initialized')
    }

    const mimeType = message.mimeType?.trim() || 'audio/pcm;rate=16000'
    await this.sendJson(session.ws, {
      realtime_input: {
        media_chunks: [
          {
            mime_type: mimeType,
            data: message.audio,
          },
        ],
      },
    })
  }

  public async endAudioStream(clientId: string): Promise<void> {
    const session = this.liveSessions.get(clientId)
    if (!session) {
      throw new Error('Live session not initialized')
    }

    await this.sendJson(session.ws, {
      client_content: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: 'Respond to the latest technician audio with short actionable guidance.',
              },
            ],
          },
        ],
        turn_complete: true,
      },
    })
  }

  public closeLiveSession(clientId: string): void {
    const session = this.liveSessions.get(clientId)
    if (!session) return
    session.ws.close()
    this.liveSessions.delete(clientId)
  }

  public getLiveSessionCount(): number {
    return this.liveSessions.size
  }

  public async getLiveHealthStatus(): Promise<LiveHealthStatus> {
    const directApiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim())

    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim()
    if (!projectId) {
      return {
        liveApiOk: false,
        directApiConfigured,
        reason: 'GOOGLE_CLOUD_PROJECT is not set',
      }
    }

    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1'
    const modelId = process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-live-2.5-flash-native-audio'

    try {
      const modelPath = `projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`
      const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
      const serviceUrl =
        `wss://${host}/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent`

      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })
      const token = await auth.getAccessToken()
      if (!token) {
        return {
          liveApiOk: false,
          directApiConfigured,
          reason: 'Unable to acquire ADC access token',
        }
      }

      const ws = await this.openWebSocket(serviceUrl, token)
      try {
        await this.sendJson(ws, {
          setup: {
            model: modelPath,
            generation_config: {
              response_modalities: ['TEXT'],
            },
          },
        })
        await this.waitForMessage(ws, 5_000)
      } finally {
        ws.close()
      }

      return {
        liveApiOk: true,
        directApiConfigured,
      }
    } catch (error) {
      return {
        liveApiOk: false,
        directApiConfigured,
        reason: error instanceof Error ? error.message : 'Live API probe failed',
      }
    }
  }

  private async runLiveTurn(messages: Array<Record<string, unknown>>): Promise<string> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim()
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1'
    const modelId = process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-live-2.5-flash-native-audio'

    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT is not set')
    }

    const modelPath = `projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
    const serviceUrl =
      `wss://${host}/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent`

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const token = await auth.getAccessToken()
    if (!token) {
      throw new Error('Unable to acquire ADC access token')
    }

    const ws = await this.openWebSocket(serviceUrl, token)
    try {
      await this.sendJson(ws, {
        setup: {
          model: modelPath,
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generation_config: {
            response_modalities: ['TEXT'],
            temperature: 0.2,
          },
          input_audio_transcription: {},
          output_audio_transcription: {},
        },
      })

      await this.waitForMessage(ws, 8_000)

      for (const message of messages) {
        await this.sendJson(ws, message)
      }

      return this.collectLiveTextUntilTurnComplete(ws, 12_000)
    } finally {
      ws.close()
    }
  }

  private async createLiveSession(handler: LiveEventHandler): Promise<LiveSession> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim()
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1'
    const modelId = process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-live-2.5-flash-native-audio'

    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT is not set')
    }

    const modelPath = `projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
    const serviceUrl =
      `wss://${host}/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent`

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const token = await auth.getAccessToken()
    if (!token) {
      throw new Error('Unable to acquire ADC access token')
    }

    const ws = await this.openWebSocket(serviceUrl, token)
    const session: LiveSession = {
      ws,
      currentTurnText: '',
      handler,
    }

    ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as {
          interrupted?: boolean
          serverContent?: {
            modelTurn?: { parts?: Array<{ text?: string }> }
            outputTranscription?: { text?: string }
            turnComplete?: boolean
          }
        }

        if (payload.interrupted) {
          session.currentTurnText = ''
          session.handler({ type: 'interrupted', text: 'Interrupted by user speech.' })
          return
        }

        const serverContent = payload.serverContent
        if (!serverContent) {
          return
        }

        const transcriptText = serverContent.outputTranscription?.text?.trim()
        if (transcriptText) {
          session.handler({ type: 'transcript', text: transcriptText })
        }

        for (const part of serverContent.modelTurn?.parts ?? []) {
          const text = part.text?.trim()
          if (!text) continue
          session.currentTurnText += `${text} `
          session.handler({ type: 'chunk', text })
        }

        if (serverContent.turnComplete) {
          const finalText = session.currentTurnText.trim()
          session.currentTurnText = ''
          if (finalText) {
            session.handler({ type: 'final', text: finalText })
          }
        }
      } catch {
        session.handler({ type: 'error', message: 'Failed to parse Live API response.' })
      }
    })

    ws.on('error', (error) => {
      session.handler({ type: 'error', message: error.message })
    })

    ws.on('close', () => {
      session.handler({ type: 'error', message: 'Live API session closed.' })
    })

    await this.sendJson(ws, {
      setup: {
        model: modelPath,
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generation_config: {
          response_modalities: ['TEXT'],
          temperature: 0.2,
        },
        realtime_input_config: {
          automatic_activity_detection: {
            disabled: false,
            start_of_speech_sensitivity: 'START_SENSITIVITY_HIGH',
            end_of_speech_sensitivity: 'END_SENSITIVITY_HIGH',
            prefix_padding_ms: 20,
            silence_duration_ms: 100,
          },
        },
      },
    })

    await this.waitForMessage(ws, 8_000)
    return session
  }

  private async collectLiveTextUntilTurnComplete(ws: WebSocket, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs
    const textParts: string[] = []

    while (Date.now() < deadline) {
      const remaining = Math.max(250, deadline - Date.now())
      const raw = await this.waitForMessage(ws, remaining)
      const payload = JSON.parse(raw.toString()) as {
        serverContent?: {
          modelTurn?: { parts?: Array<{ text?: string }> }
          outputTranscription?: { text?: string }
          turnComplete?: boolean
        }
      }

      const serverContent = payload.serverContent
      if (!serverContent) {
        continue
      }

      const outputTx = serverContent.outputTranscription?.text?.trim()
      if (outputTx) {
        textParts.push(outputTx)
      }

      for (const part of serverContent.modelTurn?.parts ?? []) {
        const text = part.text?.trim()
        if (text) {
          textParts.push(text)
        }
      }

      if (serverContent.turnComplete) {
        break
      }
    }

    const combined = textParts.join(' ').trim()
    if (!combined) {
      throw new Error('Live API returned no text output')
    }
    return combined
  }

  private async openWebSocket(serviceUrl: string, token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serviceUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const fail = (error: unknown) => {
        reject(error instanceof Error ? error : new Error('WebSocket connection failed'))
      }

      ws.once('open', () => resolve(ws))
      ws.once('error', fail)
    })
  }

  private async sendJson(ws: WebSocket, payload: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.send(JSON.stringify(payload), (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  private async waitForMessage(ws: WebSocket, timeoutMs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('Timed out waiting for Live API response'))
      }, timeoutMs)

      const onMessage = (data: WebSocket.RawData) => {
        cleanup()
        resolve(Buffer.isBuffer(data) ? data : Buffer.from(data.toString()))
      }

      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }

      const cleanup = () => {
        clearTimeout(timer)
        ws.off('message', onMessage)
        ws.off('error', onError)
      }

      ws.on('message', onMessage)
      ws.on('error', onError)
    })
  }

  private async generateStructuredResponse(parts: unknown[], onChunk?: ChunkHandler): Promise<GeminiResponse> {
    const client = this.getClient()
    if (!client) {
      return this.fallbackResponse('Gemini client unavailable.')
    }

    const modelsToTry = [
      process.env.GEMINI_MODEL || DIRECT_MODEL_FALLBACKS[0],
      ...DIRECT_MODEL_FALLBACKS,
    ]

    let aggregatedText = ''
    let lastError: unknown = null

    for (const model of modelsToTry) {
      try {
        aggregatedText = ''
        const stream = await client.models.generateContentStream({
          model,
          contents: parts as never,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        })

        for await (const chunk of stream) {
          const chunkText = chunk.text ?? ''
          if (!chunkText) continue
          aggregatedText += chunkText
          if (onChunk) {
            onChunk(chunkText)
          }
        }

        break
      } catch (error) {
        lastError = error
      }
    }

    if (!aggregatedText) {
      const reason = lastError instanceof Error ? lastError.message : 'unknown model error'
      return this.fallbackResponse(
        `Live reasoning unavailable right now (${reason}). Please retry in a moment.`,
      )
    }

    const parsed = this.parseGeminiJson(aggregatedText)
    return this.toResponse(parsed)
  }

  private toResponse(parsed: ParsedGeminiPayload): GeminiResponse {
    return {
      type: 'gemini_response',
      text: parsed.text,
      needsClarity: parsed.needsClarity,
      clarityRequest: parsed.clarityRequest,
      safetyFlags: (parsed.safetyFlags ?? []).map((flag) => ({
        ...flag,
        timestamp: new Date(),
      })),
      detectedFaults: (parsed.detectedFaults ?? []).map((fault) => ({
        ...fault,
        confidence: Math.max(0, Math.min(1, Number(fault.confidence) || 0)),
      })) as DetectedFault[],
    }
  }

  private parseGeminiJson(rawText: string): ParsedGeminiPayload {
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    try {
      const parsed = JSON.parse(cleaned) as ParsedGeminiPayload
      return {
        text: parsed.text || 'Analysis complete. Continue inspection with a closer angle.',
        needsClarity: Boolean(parsed.needsClarity),
        clarityRequest: parsed.clarityRequest ?? undefined,
        safetyFlags: parsed.safetyFlags ?? [],
        detectedFaults: parsed.detectedFaults ?? [],
      }
    } catch {
      return {
        text: rawText || 'Analysis complete. Continue inspection with a closer angle.',
        needsClarity: false,
        safetyFlags: [],
        detectedFaults: [],
      }
    }
  }

  private extractBase64Data(dataUrl: string): { mimeType: string; data: string } | null {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
    if (!match) {
      return null
    }
    const mimeType = match[1]
    const data = match[2]
    return { mimeType, data }
  }

  private fallbackResponse(text: string): GeminiResponse {
    return {
      type: 'gemini_response',
      text,
    }
  }

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return null
    }

    if (!this.client || this.clientApiKey !== apiKey) {
      this.client = new GoogleGenAI({ apiKey })
      this.clientApiKey = apiKey
    }

    return this.client
  }
}
