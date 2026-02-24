export interface Technician {
  id: string
  name: string
  email: string
  role: 'admin' | 'technician' | 'viewer'
  createdAt: Date
  updatedAt: Date
}

export interface Site {
  id: string
  name: string
  type: 'oil_gas' | 'power' | 'telecom' | 'manufacturing' | 'solar'
  location: {
    latitude: number
    longitude: number
    address?: string
  }
  technicianIds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SiteAsset {
  id: string
  siteId: string
  name: string
  assetType: string
  serialNumber?: string
  location?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface Inspection {
  id: string
  technicianId: string
  siteId: string
  timestamp: Date
  status: 'in_progress' | 'completed'
  images: string[]
  safetyFlags: SafetyFlag[]
  detectedFaults: DetectedFault[]
  recommendedActions: string[]
  ocrFindings: OcrFinding[]
  workflowEvents: WorkflowEvent[]
  transcript: string
  summary?: string
}

export type WorkflowActionType = 'log_issue' | 'create_ticket' | 'notify_supervisor' | 'add_to_history'

export interface WorkflowEvent {
  id: string
  action: WorkflowActionType
  note?: string
  metadata?: Record<string, unknown>
  status: 'completed' | 'failed'
  resultMessage: string
  externalReferenceId?: string
  createdAt: Date
}

export interface OcrFinding {
  imageUrl: string
  extractedText: string
  serialNumbers: string[]
  partCodes: string[]
  meterReadings: string[]
  warningLabels: string[]
  confidence: number
  createdAt: Date
}

export interface SafetyFlag {
  type: 'missing_ppe' | 'dangerous_proximity' | 'leak' | 'spark' | 'exposed_wire' | 'slippery_surface' | 'open_flame'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: Date
}

export interface DetectedFault {
  component: string
  faultType: string
  confidence: number
  description: string
  recommendedActions: string[]
}

export interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

export interface VideoFrameMessage extends WebSocketMessage {
  type: 'video_frame'
  frame: string
  timestamp: number
}

export interface AudioMessage extends WebSocketMessage {
  type: 'audio'
  audio: string
  mimeType?: string
  sampleRate?: number
  transcript?: string
}

export interface AudioStreamEndMessage extends WebSocketMessage {
  type: 'audio_stream_end'
}

export interface GeminiResponse extends WebSocketMessage {
  type: 'gemini_response'
  text: string
  audio?: string
  safetyFlags?: SafetyFlag[]
  detectedFaults?: DetectedFault[]
  needsClarity?: boolean
  clarityRequest?: string
}

export interface GeminiResponseChunk extends WebSocketMessage {
  type: 'gemini_response_chunk'
  textChunk: string
}

export interface ApiError {
  code: string
  message: string
  statusCode: number
}
