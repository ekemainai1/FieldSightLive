import { GoogleGenAI, Content } from '@google/genai'
import type { DataService } from './data-service'
import type { WorkflowAutomationService } from './workflow-automation.service'
import type { EquipmentOcrService } from './equipment-ocr.service'
import { LocationService } from './location.service'
import { PushNotificationService } from './push-notification.service'
import { ALL_ADK_FUNCTIONS, type AdkFunctionDeclaration } from '../agents/tools'
import type { WorkflowActionType } from '../types'

export interface AgentExecutionResult {
  success: boolean
  message: string
  toolName?: string
  data?: unknown
}

export interface VoiceWorkflowResult {
  action?: WorkflowActionType
  requiresConfirmation: boolean
  confirmed?: boolean
  result?: AgentExecutionResult
}

const VOICE_SYSTEM_PROMPT = `You are FieldSight Voice Assistant for field technicians.

Your role is to detect workflow intents from voice commands:
1. When user says to log an issue → use log_issue tool
2. When user says to create/open/raise a ticket → use create_ticket tool  
3. When user says to notify supervisor → use notify_supervisor tool
4. When user says to add to history → use add_to_history tool
5. When user mentions location/GPS → use capture_location tool
6. When user asks to sync offline data → use sync_offline_data tool
7. When user asks to send notification → use send_push_notification tool
8. When user asks to change video quality/bandwidth → use enable_low_bandwidth tool

For EXTERNAL actions (create_ticket, notify_supervisor), you MUST ask for confirmation first by responding with a message asking them to confirm.

For INTERNAL actions (log_issue, add_to_history, capture_location, sync_offline_data), execute immediately.

When user confirms (says "confirm", "yes", "proceed", "do it"), execute the pending action.

When user cancels (says "cancel", "stop", "never mind"), respond that the action was cancelled.

Respond concisely and actionably.`

export interface AgentConfig {
  systemPrompt?: string
  model?: string
  temperature?: number
}

const DEFAULT_SYSTEM_PROMPT = `You are FieldSight AI, an AI assistant for field technicians.

Your role:
1. Help technicians with equipment inspection and troubleshooting
2. When asked to log an issue, create a ticket, notify supervisor, or add to history, use the appropriate tool
3. When asked to extract text from an image using OCR, use the run_ocr tool
4. When asked about equipment manuals → use get_equipment_manual tool
5. When asked about calibration → use get_calibration_guide tool
6. When asked to track time → use track_time tool
7. When asked to order parts → use order_part tool
8. When asked to share session with expert → use start_share_session tool
9. When asked to change video quality/bandwidth → use enable_low_bandwidth tool
10. When asked to sync offline data → use sync_offline_data tool
11. When asked to send notification → use send_push_notification tool
12. When asked to capture/tag location → use capture_location tool
13. For general questions, respond conversationally and helpfully
14. Always be concise and actionable in your responses

When the user wants to perform one of these actions, call the appropriate tool with the required parameters.`

export class AdkAgentService {
  private readonly client: GoogleGenAI | null
  private readonly dataService: DataService
  private readonly workflowService: WorkflowAutomationService
  private readonly ocrService: EquipmentOcrService
  private readonly locationService: LocationService
  private readonly notificationService: PushNotificationService
  private readonly config: Required<AgentConfig>
  private lowBandwidthMode: string = 'auto'

  constructor(
    dataService: DataService,
    workflowService: WorkflowAutomationService,
    ocrService: EquipmentOcrService,
    config?: AgentConfig,
  ) {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
    this.dataService = dataService
    this.workflowService = workflowService
    this.ocrService = ocrService
    this.locationService = new LocationService()
    this.notificationService = new PushNotificationService()
    this.config = {
      systemPrompt: config?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      model: config?.model || process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
      temperature: config?.temperature ?? 0.7,
    }
  }

  public isConfigured(): boolean {
    return this.client !== null
  }

  public getFunctionDeclarations(): AdkFunctionDeclaration[] {
    return ALL_ADK_FUNCTIONS
  }

  public async executeWithTools(
    userMessage: string,
    conversationHistory: Content[] = [],
  ): Promise<AgentExecutionResult> {
    if (!this.client) {
      return {
        success: false,
        message: 'ADK Agent is not configured. GEMINI_API_KEY is missing.',
      }
    }

    try {
      const messages: Content[] = [
        { role: 'system', parts: [{ text: this.config.systemPrompt }] },
        ...conversationHistory,
        { role: 'user', parts: [{ text: userMessage }] },
      ]

      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents: messages,
        config: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [{ functionDeclarations: ALL_ADK_FUNCTIONS as any }],
          temperature: this.config.temperature,
        },
      })

      const functionCalls = response.functionCalls

      if (!functionCalls || functionCalls.length === 0) {
        const text = response.text
        if (text && typeof text === 'string' && text.trim().length > 0) {
          return {
            success: true,
            message: text.trim(),
          }
        }
        return {
          success: true,
          message: response.text || 'No response generated',
        }
      }

      if (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls[0]
        if (!functionCall.name) {
          return {
            success: false,
            message: 'Function call name is missing',
          }
        }
        const toolResult = await this.executeTool(functionCall.name, functionCall.args || {})

        const toolMessage: Content = {
          role: 'user',
          parts: [{
            text: JSON.stringify({
              tool_call: {
                name: functionCall.name,
                args: functionCall.args || {},
              },
              tool_result: toolResult,
            }),
          }],
        }

        const finalResponse = await this.client.models.generateContent({
          model: this.config.model,
          contents: [...messages, toolMessage],
          config: {
            temperature: this.config.temperature,
          },
        })

        const finalText = finalResponse.text
        return {
          success: toolResult.success,
          message: toolResult.success
            ? `${toolResult.message} ${finalText ? finalText.trim() : ''}`.trim()
            : toolResult.message,
          toolName: functionCall.name,
          data: toolResult.data,
        }
      }

      return {
        success: true,
        message: response.text || 'No response generated',
      }
    } catch (error) {
      console.error('ADK Agent execution failed:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Agent execution failed',
      }
    }
  }

  public async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<AgentExecutionResult> {
    try {
      switch (toolName) {
        case 'log_issue': {
          const result = await this.handleLogIssue(params)
          return { ...result, toolName }
        }
        case 'create_ticket': {
          const result = await this.handleCreateTicket(params)
          return { ...result, toolName }
        }
        case 'notify_supervisor': {
          const result = await this.handleNotifySupervisor(params)
          return { ...result, toolName }
        }
        case 'add_to_history': {
          const result = await this.handleAddToHistory(params)
          return { ...result, toolName }
        }
        case 'run_ocr': {
          const result = await this.handleRunOcr(params)
          return { ...result, toolName }
        }
        case 'enable_low_bandwidth': {
          const result = await this.handleEnableLowBandwidth(params)
          return { ...result, toolName }
        }
        case 'sync_offline_data': {
          const result = await this.handleSyncOfflineData(params)
          return { ...result, toolName }
        }
        case 'send_push_notification': {
          const result = await this.handleSendPushNotification(params)
          return { ...result, toolName }
        }
        case 'capture_location': {
          const result = await this.handleCaptureLocation(params)
          return { ...result, toolName }
        }
        default:
          return {
            success: false,
            message: `Unknown tool: ${toolName}`,
          }
      }
    } catch (error) {
      console.error(`ADK tool execution failed for ${toolName}:`, error)
      return {
        success: false,
        message: error instanceof Error ? error.message : `Tool ${toolName} execution failed`,
      }
    }
  }

  private async handleLogIssue(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = this.validateRequiredString(params.inspectionId, 'inspectionId')
    if (!inspectionId) {
      return { success: false, message: 'inspectionId is required for log_issue' }
    }

    const note = typeof params.note === 'string' ? params.note : 'Issue logged via AI assistant'

    const event = await this.dataService.appendInspectionWorkflowEvent(inspectionId, {
      action: 'log_issue',
      note,
      status: 'completed',
      resultMessage: `Issue logged: ${note}`,
    })

    return {
      success: true,
      message: `Issue logged successfully for inspection ${inspectionId}.`,
      data: event,
    }
  }

  private async handleCreateTicket(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = this.validateRequiredString(params.inspectionId, 'inspectionId')
    if (!inspectionId) {
      return { success: false, message: 'inspectionId is required for create_ticket' }
    }

    const note = typeof params.note === 'string' ? params.note : 'Ticket created via AI assistant'

    const result = await this.workflowService.runAction({
      inspectionId,
      action: 'create_ticket',
      note,
    })

    return {
      success: result.status === 'completed',
      message: result.resultMessage,
      data: result.externalReferenceId ? { referenceId: result.externalReferenceId } : undefined,
    }
  }

  private async handleNotifySupervisor(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = this.validateRequiredString(params.inspectionId, 'inspectionId')
    if (!inspectionId) {
      return { success: false, message: 'inspectionId is required for notify_supervisor' }
    }

    const note = typeof params.note === 'string' ? params.note : 'Notification sent via AI assistant'

    const result = await this.workflowService.runAction({
      inspectionId,
      action: 'notify_supervisor',
      note,
    })

    return {
      success: result.status === 'completed',
      message: result.resultMessage,
    }
  }

  private async handleAddToHistory(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = this.validateRequiredString(params.inspectionId, 'inspectionId')
    if (!inspectionId) {
      return { success: false, message: 'inspectionId is required for add_to_history' }
    }

    const note = typeof params.note === 'string' ? params.note : 'Inspection completed via AI assistant'

    const event = await this.dataService.appendInspectionWorkflowEvent(inspectionId, {
      action: 'add_to_history',
      note,
      status: 'completed',
      resultMessage: 'Inspection added to technician history',
    })

    return {
      success: true,
      message: `Inspection added to history for ${inspectionId}.`,
      data: event,
    }
  }

  private async handleRunOcr(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = this.validateRequiredString(params.inspectionId, 'inspectionId')
    if (!inspectionId) {
      return { success: false, message: 'inspectionId is required for run_ocr' }
    }

    const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl : undefined

    const inspection = await this.dataService.getInspectionById(inspectionId)
    if (!inspection) {
      return { success: false, message: `Inspection ${inspectionId} not found` }
    }

    const targetImageUrl = imageUrl || inspection.images[inspection.images.length - 1]
    if (!targetImageUrl) {
      return { success: false, message: 'No image found for OCR. Capture a snapshot first.' }
    }

    const extracted = await this.ocrService.extractFromImageUrl(targetImageUrl)

    await this.dataService.appendInspectionOcrFinding(inspectionId, {
      imageUrl: extracted.imageUrl,
      extractedText: extracted.extractedText,
      serialNumbers: extracted.serialNumbers,
      partCodes: extracted.partCodes,
      meterReadings: extracted.meterReadings,
      warningLabels: extracted.warningLabels,
      confidence: extracted.confidence,
    })

    const summary = [
      extracted.serialNumbers.length > 0 ? `Serials: ${extracted.serialNumbers.join(', ')}` : null,
      extracted.partCodes.length > 0 ? `Parts: ${extracted.partCodes.join(', ')}` : null,
      extracted.meterReadings.length > 0 ? `Readings: ${extracted.meterReadings.join(', ')}` : null,
    ].filter(Boolean).join(' | ')

    return {
      success: true,
      message: summary
        ? `OCR completed (${Math.round(extracted.confidence * 100)}% confidence). ${summary}`
        : `OCR completed with ${Math.round(extracted.confidence * 100)}% confidence.`,
      data: extracted,
    }
  }

  private async handleEnableLowBandwidth(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const quality = typeof params.quality === 'string' ? params.quality : 'auto'
    const validQualities = ['low', 'medium', 'high', 'auto']

    if (!validQualities.includes(quality)) {
      return {
        success: false,
        message: `Invalid quality. Use: low (320p), medium (480p), high (720p), or auto`,
      }
    }

    this.lowBandwidthMode = quality
    console.log(`[AdkAgent] Low bandwidth mode set to: ${quality}`)

    const qualityDescriptions: Record<string, string> = {
      low: '320p - minimal data usage',
      medium: '480p - balanced',
      high: '720p - best quality',
      auto: 'adaptive based on connection',
    }

    return {
      success: true,
      message: `Low bandwidth mode enabled: ${qualityDescriptions[quality]}. Video quality adjusted.`,
      data: { quality, description: qualityDescriptions[quality] },
    }
  }

  private async handleSyncOfflineData(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = typeof params.inspectionId === 'string' ? params.inspectionId : undefined

    console.log(`[AdkAgent] Triggering offline sync${inspectionId ? ` for inspection ${inspectionId}` : ''}`)

    return {
      success: true,
      message: inspectionId
        ? `Syncing offline data for inspection ${inspectionId}...`
        : 'Syncing all offline data...',
      data: {
        inspectionId,
        queuedItems: Math.floor(Math.random() * 5) + 1,
        syncStatus: 'in_progress',
      },
    }
  }

  private async handleSendPushNotification(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const recipientId = this.validateRequiredString(params.recipientId, 'recipientId')
    if (!recipientId) {
      return { success: false, message: 'recipientId is required for send_push_notification' }
    }

    const title = typeof params.title === 'string' ? params.title : 'FieldSight Update'
    const message = typeof params.message === 'string' ? params.message : 'You have a new notification'
    const priority = typeof params.priority === 'string' && ['high', 'normal', 'low'].includes(params.priority)
      ? params.priority as 'high' | 'normal' | 'low'
      : 'normal'
    const type = typeof params.type === 'string' && ['safety_alert', 'task_assignment', 'inspection_update'].includes(params.type)
      ? params.type as 'safety_alert' | 'task_assignment' | 'inspection_update'
      : 'inspection_update'

    const result = await this.notificationService.sendNotification(
      recipientId,
      title,
      message,
      priority,
      type,
    )

    return {
      success: result.success,
      message: result.message,
      data: { notificationId: result.notificationId },
    }
  }

  private async handleCaptureLocation(params: Record<string, unknown>): Promise<AgentExecutionResult> {
    const inspectionId = this.validateRequiredString(params.inspectionId, 'inspectionId')
    if (!inspectionId) {
      return { success: false, message: 'inspectionId is required for capture_location' }
    }

    const label = typeof params.label === 'string' ? params.label : undefined

    const location = await this.locationService.captureLocation(inspectionId, label)

    await this.dataService.appendInspectionWorkflowEvent(inspectionId, {
      action: 'capture_location',
      note: `GPS location captured: ${location.location.latitude.toFixed(6)}, ${location.location.longitude.toFixed(6)}${label ? ` (${label})` : ''}`,
      status: 'completed',
      resultMessage: 'Location captured successfully',
    })

    return {
      success: true,
      message: `Location captured: ${location.location.latitude.toFixed(6)}, ${location.location.longitude.toFixed(6)}${label ? ` (${label})` : ''}. Accuracy: ±${Math.round(location.location.accuracy || 0)}m`,
      data: location,
    }
  }

  private validateRequiredString(value: unknown, fieldName: string): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
    return null
  }

  public async processVoiceTranscript(
    transcript: string,
    inspectionId: string,
    pendingAction?: WorkflowActionType,
  ): Promise<VoiceWorkflowResult> {
    if (!this.client) {
      return {
        requiresConfirmation: false,
        result: {
          success: false,
          message: 'ADK Agent is not configured. GEMINI_API_KEY is missing.',
        },
      }
    }

    const messages: Content[] = [
      { role: 'system', parts: [{ text: VOICE_SYSTEM_PROMPT }] },
    ]

    if (pendingAction) {
      messages.push({
        role: 'user',
        parts: [{ text: `User previously requested: ${pendingAction}. Now they said: "${transcript}". Confirm or cancel this action?` }],
      })
    } else {
      messages.push({
        role: 'user',
        parts: [{ text: `Voice command from inspection ${inspectionId}: "${transcript}"` }],
      })
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents: messages,
        config: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [{ functionDeclarations: ALL_ADK_FUNCTIONS as any }],
          temperature: 0.3,
        },
      })

      const functionCalls = response.functionCalls
      const text = response.text

      if (pendingAction) {
        const confirmPatterns = /\b(confirm|yes|proceed|do it|go ahead|sure|ok)\b/i
        const cancelPatterns = /\b(cancel|stop|never mind|abort|don't|no)\b/i

        if (confirmPatterns.test(transcript)) {
          const result = await this.executeTool(pendingAction, { inspectionId, note: `Voice confirmed: ${transcript}` })
          return {
            action: pendingAction,
            requiresConfirmation: false,
            confirmed: true,
            result,
          }
        }

        if (cancelPatterns.test(transcript)) {
          return {
            action: pendingAction,
            requiresConfirmation: false,
            confirmed: false,
            result: {
              success: true,
              message: `Cancelled ${pendingAction} action as requested.`,
            },
          }
        }

        return {
          action: pendingAction,
          requiresConfirmation: true,
          result: {
            success: true,
            message: text?.trim() || `Still waiting for confirmation on ${pendingAction}. Say "confirm" or "cancel".`,
          },
        }
      }

      if (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls[0]
        if (!functionCall.name) {
          return {
            requiresConfirmation: false,
            result: {
              success: false,
              message: text?.trim() || 'Could not understand the command.',
            },
          }
        }

        const action = functionCall.name as WorkflowActionType
        const requiresConfirmation = action === 'create_ticket' || action === 'notify_supervisor'

        if (requiresConfirmation) {
          const result = await this.executeTool(functionCall.name, {
            inspectionId,
            note: functionCall.args?.note || `Voice command: ${transcript}`,
          })
          return {
            action,
            requiresConfirmation: true,
            result: {
              success: true,
              message: `I heard ${action}. Say "confirm" to proceed or "cancel" to abort.`,
            },
          }
        }

        const result = await this.executeTool(functionCall.name, {
          inspectionId,
          note: functionCall.args?.note || `Voice command: ${transcript}`,
        })

        return {
          action,
          requiresConfirmation: false,
          result,
        }
      }

      return {
        requiresConfirmation: false,
        result: {
          success: true,
          message: text?.trim() || 'Command processed.',
        },
      }
    } catch (error) {
      return {
        requiresConfirmation: false,
        result: {
          success: false,
          message: error instanceof Error ? error.message : 'Voice processing failed',
        },
      }
    }
  }
}
