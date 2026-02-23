import 'dotenv/config'
import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import { GeminiLiveService, type LiveResponseEvent } from './services/gemini-live.service'
import { AuthService } from './services/auth.service'
import { EquipmentOcrService } from './services/equipment-ocr.service'
import { FirestoreDataService } from './services/firestore-data.service'
import { ReportPdfService } from './services/report-pdf.service'
import { StorageService } from './services/storage.service'
import { WorkflowAutomationService } from './services/workflow-automation.service'
import { createDataRouter } from './routes/data.routes'
import { incomingMessageSchema, type IncomingMessage } from './utils/ws-validation'
import { detectWorkflowIntent } from './utils/workflow-intents'
import { SlidingWindowRateLimiter } from './utils/rate-limiter'
import type {
  AudioMessage,
  AudioStreamEndMessage,
  VideoFrameMessage,
  WebSocketMessage,
} from './types'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
})

interface WebSocketClient {
  id: string
  ws: WebSocket
  sessionId?: string
}

class App {
  public app: Application
  public server: ReturnType<typeof createServer>
  public wss: WebSocketServer
  private clients: Map<string, WebSocketClient> = new Map()
  private inspectionContextByClient: Map<string, string> = new Map()
  private lastVoiceIntentByClient: Map<string, { action: string; at: number }> = new Map()
  private liveSessionEnabled: Map<string, boolean> = new Map()
  private audioChunkBuffers: Map<string, { chunks: string[]; mimeType: string; sampleRate: number }> = new Map()
  private geminiLiveService = new GeminiLiveService()
  private authService = new AuthService()
  private ocrService = new EquipmentOcrService()
  private firestoreService = new FirestoreDataService()
  private reportPdfService = new ReportPdfService()
  private storageService = new StorageService()
  private workflowAutomationService = new WorkflowAutomationService()
  private rateLimiter: SlidingWindowRateLimiter

  private readonly RATE_WINDOW_MS = 10_000
  private readonly RATE_MAX_MESSAGES = 400

  constructor() {
    this.app = express()
    this.server = createServer(this.app)
    this.wss = new WebSocketServer({
      server: this.server,
    })
    this.rateLimiter = new SlidingWindowRateLimiter(this.RATE_WINDOW_MS, this.RATE_MAX_MESSAGES)

    this.middleware()
    this.routes()
    this.websocket()
  }

  public start(port: number = 8080): void {
    this.server.listen(port, () => {
      logger.info(`Server running on port ${port}`)
      logger.info(`Auth required: ${this.authService.isAuthRequired()}`)
      logger.info(`WebSocket available at ws://localhost:${port}/ws`)
      logger.info(`WebSocket also accepts ws://localhost:${port}`)
    })
  }

  private middleware(): void {
    this.app.use(helmet())
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
    }))
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
  }

  private routes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        websocket: {
          connectedClients: this.clients.size,
          liveSessionCount: this.geminiLiveService.getLiveSessionCount(),
          fallbackClientCount: Array.from(this.liveSessionEnabled.values()).filter((v) => !v).length,
          bufferedAudioClients: this.audioChunkBuffers.size,
          rateTrackedClients: this.rateLimiter.size(),
        },
      })
    })

    this.app.get('/api/v1/status', (_req: Request, res: Response) => {
      res.json({
        status: 'running',
        clients: this.clients.size,
        version: '1.0.0',
      })
    })

    this.app.get('/healthz/live', async (_req: Request, res: Response) => {
      const health = await this.geminiLiveService.getLiveHealthStatus()

      if (health.liveApiOk) {
        res.json({
          status: 'ok',
          ai: {
            liveApi: 'up',
            directApiConfigured: health.directApiConfigured,
          },
          timestamp: new Date().toISOString(),
        })
        return
      }

      if (health.directApiConfigured) {
        res.status(200).json({
          status: 'degraded',
          ai: {
            liveApi: 'down',
            directApiConfigured: true,
            reason: health.reason,
          },
          timestamp: new Date().toISOString(),
        })
        return
      }

      res.status(503).json({
        status: 'down',
        ai: {
          liveApi: 'down',
          directApiConfigured: false,
          reason: health.reason,
        },
        timestamp: new Date().toISOString(),
      })
    })

    this.app.use('/api/v1', this.httpAuthMiddleware.bind(this))
    this.app.use(
      '/api/v1',
      createDataRouter(
        this.firestoreService,
        this.storageService,
        this.reportPdfService,
        this.ocrService,
        this.workflowAutomationService,
      ),
    )

    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error', { message: err.message })
      res.status(500).json({ error: 'Internal server error' })
    })
  }

  private websocket(): void {
    this.wss.on('connection', async (ws: WebSocket, request) => {
      const tokenFromQuery = this.extractTokenFromRequestUrl(request.url)
      try {
        const authUser = await this.authService.authenticateToken(tokenFromQuery)
        if (this.authService.isAuthRequired() && !authUser) {
          ws.close(4401, 'Unauthorized')
          return
        }
      } catch {
        ws.close(4401, 'Unauthorized')
        return
      }

      const clientId = uuidv4()
      const client: WebSocketClient = { id: clientId, ws }
      this.clients.set(clientId, client)

      void this.geminiLiveService
        .startLiveSession(clientId, (event) => {
          this.forwardLiveEventToClient(clientId, event)
        })
        .then((enabled) => {
          this.liveSessionEnabled.set(clientId, enabled)
          this.logWithContext(clientId, 'session.init', {
            liveEnabled: enabled,
          })
          if (!enabled) {
            logger.warn(`Live API disabled for ${clientId}; using direct fallback mode`)
          }
        })

      logger.info(`WebSocket client connected: ${clientId}`)

      ws.on('message', (data: Buffer) => {
        this.handleMessage(clientId, data)
      })

      ws.on('close', () => {
        this.geminiLiveService.closeLiveSession(clientId)
        this.liveSessionEnabled.delete(clientId)
        this.audioChunkBuffers.delete(clientId)
        this.inspectionContextByClient.delete(clientId)
        this.lastVoiceIntentByClient.delete(clientId)
        this.rateLimiter.clear(clientId)
        this.clients.delete(clientId)
        logger.info(`WebSocket client disconnected: ${clientId}`)
      })

      ws.on('error', (error: Error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error)
      })

      ws.send(JSON.stringify({ type: 'connected', clientId }))
    })
  }

  private handleMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId)
    if (!client) return

    if (!this.allowMessage(clientId)) {
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Rate limit exceeded. Slow down and try again.',
      })
      return
    }

    try {
      const raw = JSON.parse(data.toString()) as WebSocketMessage
      const parsed = incomingMessageSchema.safeParse(raw)
      if (!parsed.success) {
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Invalid message payload.',
        })
        return
      }

      const message: IncomingMessage = parsed.data
      this.logWithContext(clientId, 'ws.incoming', {
        type: message.type,
      })

      switch (message.type) {
        case 'join_session':
          client.sessionId = message.sessionId
          logger.info(`Client ${clientId} joined session ${message.sessionId}`)
          break

        case 'video_frame':
          void this.processVideoFrame(client, message as VideoFrameMessage)
          break

        case 'audio':
          void this.processAudioChunk(client, message as AudioMessage)
          break

        case 'audio_stream_end':
          void this.processAudioStreamEnd(client, message as AudioStreamEndMessage)
          break

        case 'interrupt':
          logger.info(`Client ${clientId} interrupted session`)
          void this.processInterrupt(client)
          break

        case 'inspection_context':
          this.inspectionContextByClient.set(clientId, message.inspectionId)
          this.sendToClient(clientId, {
            type: 'gemini_response',
            text: `Inspection context set to ${message.inspectionId}`,
          })
          break
      }
    } catch (error) {
      logger.error(`Error handling message from ${clientId}:`, error)
    }
  }

  private async httpAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization
      const authUser = await this.authService.authenticateBearerHeader(authHeader)
      req.authUser = authUser
      next()
    } catch {
      res.status(401).json({ error: 'Unauthorized' })
    }
  }

  private extractTokenFromRequestUrl(rawUrl?: string): string | undefined {
    if (!rawUrl) {
      return undefined
    }
    const parsed = new URL(rawUrl, 'http://localhost')
    const token = parsed.searchParams.get('token')
    return token || undefined
  }

  private allowMessage(clientId: string): boolean {
    return this.rateLimiter.allow(clientId)
  }

  private async processVideoFrame(client: WebSocketClient, message: VideoFrameMessage): Promise<void> {
    logger.debug(`Processing video frame for client ${client.id}`)
    try {
      const response = await this.geminiLiveService.analyzeVideoFrame(message)
      this.sendToClient(client.id, response)
    } catch (error) {
      logger.error(`Video frame processing failed for ${client.id}:`, error)
      this.sendToClient(client.id, {
        type: 'gemini_response',
        text: 'I could not analyze that frame. Capture a clearer snapshot and try again.',
      })
    }
  }

  private async processAudioChunk(client: WebSocketClient, message: AudioMessage): Promise<void> {
    const liveEnabled = this.liveSessionEnabled.get(client.id) === true
    if (!liveEnabled) {
      if (!message.audio) {
        return
      }
      const current = this.audioChunkBuffers.get(client.id)
      if (!current) {
        this.audioChunkBuffers.set(client.id, {
          chunks: [message.audio],
          mimeType: message.mimeType || 'audio/pcm;rate=16000',
          sampleRate: message.sampleRate || 16000,
        })
      } else {
        current.chunks.push(message.audio)
      }
      return
    }

    try {
      await this.geminiLiveService.sendAudioChunk(client.id, message)
    } catch (error) {
      logger.error(`Audio chunk streaming failed for ${client.id}:`, error)
      this.sendToClient(client.id, {
        type: 'gemini_response',
        text: 'Audio stream interrupted. Keep push-to-talk pressed and try again.',
      })
    }
  }

  private async processAudioStreamEnd(
    client: WebSocketClient,
    _message: AudioStreamEndMessage,
  ): Promise<void> {
    const liveEnabled = this.liveSessionEnabled.get(client.id) === true
    if (!liveEnabled) {
      const buffered = this.audioChunkBuffers.get(client.id)
      this.audioChunkBuffers.delete(client.id)

      if (!buffered || buffered.chunks.length === 0) {
        this.sendToClient(client.id, {
          type: 'gemini_response',
          text: 'No audio was captured. Hold push-to-talk and speak, then release.',
        })
        return
      }

      const combinedBuffer = Buffer.concat(buffered.chunks.map((chunk) => Buffer.from(chunk, 'base64')))
      const combinedMessage: AudioMessage = {
        type: 'audio',
        audio: combinedBuffer.toString('base64'),
        mimeType: buffered.mimeType,
        sampleRate: buffered.sampleRate,
      }

      try {
        const response = await this.geminiLiveService.analyzeAudio(combinedMessage)
        this.sendToClient(client.id, response)
      } catch (error) {
        logger.error(`Fallback audio processing failed for ${client.id}:`, error)
        this.sendToClient(client.id, {
          type: 'gemini_response',
          text: 'Audio processing failed. Please try again.',
        })
      }
      return
    }

    try {
      await this.geminiLiveService.endAudioStream(client.id)
    } catch (error) {
      logger.error(`Audio stream end failed for ${client.id}:`, error)
      this.sendToClient(client.id, {
        type: 'gemini_response',
        text: 'I could not complete that audio turn. Please repeat in one short sentence.',
      })
    }
  }

  private async processInterrupt(client: WebSocketClient): Promise<void> {
    const response = await this.geminiLiveService.handleInterrupt()
    this.sendToClient(client.id, response)
  }

  private forwardLiveEventToClient(clientId: string, event: LiveResponseEvent): void {
    if (event.type === 'chunk' && event.text) {
      this.sendToClient(clientId, {
        type: 'gemini_response_chunk',
        textChunk: event.text,
      })
      return
    }

    if (event.type === 'final' && event.text) {
      this.sendToClient(clientId, {
        type: 'gemini_response',
        text: event.text,
      })
      return
    }

    if (event.type === 'interrupted') {
      this.sendToClient(clientId, {
        type: 'gemini_response',
        text: event.text || 'Interrupted by user speech.',
      })
      return
    }

    if (event.type === 'error') {
      logger.warn(`Live session event error for ${clientId}: ${event.message}`)
      return
    }

    if (event.type === 'transcript' && event.text) {
      this.sendToClient(clientId, {
        type: 'live_transcript',
        speaker: 'user',
        text: event.text,
      })
      void this.triggerWorkflowFromTranscript(clientId, event.text)
    }
  }

  private async triggerWorkflowFromTranscript(clientId: string, transcript: string): Promise<void> {
    try {
      const action = detectWorkflowIntent(transcript)
      if (!action) {
        return
      }

      const inspectionId = this.inspectionContextByClient.get(clientId)
      if (!inspectionId) {
        this.sendToClient(clientId, {
          type: 'gemini_response',
          text: 'Workflow intent heard, but no active inspection context is set.',
        })
        return
      }

      const previous = this.lastVoiceIntentByClient.get(clientId)
      const now = Date.now()
      if (previous && previous.action === action && now - previous.at < 15_000) {
        return
      }
      this.lastVoiceIntentByClient.set(clientId, { action, at: now })

      const inspection = await this.firestoreService.getInspectionById(inspectionId)
      if (!inspection) {
        this.sendToClient(clientId, {
          type: 'gemini_response',
          text: `Workflow intent skipped because inspection ${inspectionId} was not found.`,
        })
        return
      }

      const result = await this.workflowAutomationService.runAction({
        inspectionId,
        action,
        note: transcript,
        metadata: {
          source: 'voice_intent',
        },
      })

      await this.firestoreService.appendInspectionWorkflowEvent(inspectionId, {
        action,
        note: transcript,
        metadata: {
          source: 'voice_intent',
        },
        status: result.status,
        resultMessage: result.resultMessage,
        externalReferenceId: result.externalReferenceId,
      })

      this.sendToClient(clientId, {
        type: 'gemini_response',
        text: `Voice workflow executed (${action}): ${result.resultMessage}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.sendToClient(clientId, {
        type: 'gemini_response',
        text: `Voice workflow execution failed: ${message}`,
      })
    }
  }

  public sendToClient(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId)
    if (client && client.ws.readyState === WebSocket.OPEN) {
      const payloadType =
        typeof data === 'object' && data !== null && 'type' in data
          ? (data as { type?: string }).type
          : 'unknown'
      this.logWithContext(clientId, 'ws.outgoing', { type: payloadType })
      client.ws.send(JSON.stringify(data))
    }
  }

  private logWithContext(clientId: string, event: string, meta: Record<string, unknown>): void {
    const client = this.clients.get(clientId)
    logger.info({
      event,
      clientId,
      sessionId: client?.sessionId ?? null,
      ...meta,
    })
  }

  public broadcastToSession(sessionId: string, data: unknown): void {
    const message = JSON.stringify(data)
    this.clients.forEach((client) => {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message)
      }
    })
  }
}

const app = new App()
app.start()
export default app
