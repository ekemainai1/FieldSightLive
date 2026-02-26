import type { WorkflowActionType } from '../types'

export interface AdkFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required: string[]
  }
}

export interface ToolImplementation {
  name: string
  handler: (params: Record<string, unknown>) => Promise<{
    success: boolean
    message: string
    data?: unknown
  }>
}

export const ADK_FUNCTIONS: Record<string, AdkFunctionDeclaration> = {
  log_issue: {
    name: 'log_issue',
    description: 'Log an issue or problem found during inspection. Creates a record in the inspection history for follow-up.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to log the issue under' },
        note: { type: 'string', description: 'Description of the issue or problem found' },
      },
      required: ['inspectionId'],
    },
  },
  create_ticket: {
    name: 'create_ticket',
    description: 'Create an external ticket in Jira, ServiceNow, or generic webhook system for follow-up action.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to create ticket for' },
        note: { type: 'string', description: 'Ticket description or summary of the issue' },
      },
      required: ['inspectionId'],
    },
  },
  notify_supervisor: {
    name: 'notify_supervisor',
    description: 'Notify supervisor via webhook or external system about urgent findings or status updates.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to notify about' },
        note: { type: 'string', description: 'Notification message describing the issue or status' },
      },
      required: ['inspectionId'],
    },
  },
  add_to_history: {
    name: 'add_to_history',
    description: 'Add inspection findings to technician history for future reference and trend analysis.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to add to history' },
        note: { type: 'string', description: 'Optional note describing what to add to history' },
      },
      required: ['inspectionId'],
    },
  },
  run_ocr: {
    name: 'run_ocr',
    description: 'Extract text, serial numbers, part codes, and meter readings from equipment images using OCR.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID containing the image' },
        imageUrl: { type: 'string', description: 'URL of the image to process. If not provided, uses the latest snapshot.' },
      },
      required: ['inspectionId'],
    },
  },
  get_equipment_manual: {
    name: 'get_equipment_manual',
    description: 'Get equipment manual, specifications, schematics, and troubleshooting guides for identified equipment.',
    parameters: {
      type: 'object',
      properties: {
        equipmentType: { type: 'string', description: 'Type of equipment (e.g., pump, motor, valve, transformer)' },
        serialNumber: { type: 'string', description: 'Serial number if available' },
        topic: { type: 'string', description: 'Specific topic: installation, operation, maintenance, troubleshooting, safety' },
      },
      required: ['equipmentType'],
    },
  },
  get_calibration_guide: {
    name: 'get_calibration_guide',
    description: 'Get step-by-step calibration procedures for equipment. Returns detailed instructions with safety precautions.',
    parameters: {
      type: 'object',
      properties: {
        equipmentType: { type: 'string', description: 'Type of equipment to calibrate' },
        standard: { type: 'string', description: 'Calibration standard or requirement if known' },
      },
      required: ['equipmentType'],
    },
  },
  track_time: {
    name: 'track_time',
    description: 'Track time spent on specific inspection tasks. Useful for time logging and productivity tracking.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID' },
        taskName: { type: 'string', description: 'Name of the task being tracked' },
        duration: { type: 'string', description: 'Duration in minutes or description like "started", "paused", "completed"' },
        notes: { type: 'string', description: 'Optional notes about the task' },
      },
      required: ['inspectionId', 'taskName', 'duration'],
    },
  },
  order_part: {
    name: 'order_part',
    description: 'Order replacement parts from configured suppliers. Creates a purchase request or webhook call.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID' },
        partNumber: { type: 'string', description: 'Part number or description' },
        quantity: { type: 'number', description: 'Quantity needed' },
        urgency: { type: 'string', description: 'Urgency: routine, urgent, critical' },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['inspectionId', 'partNumber', 'quantity'],
    },
  },
  start_share_session: {
    name: 'start_share_session',
    description: 'Start a collaborative session to share live camera view with a remote expert for real-time assistance.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to share' },
        expertEmail: { type: 'string', description: 'Email of the expert to invite' },
        duration: { type: 'string', description: 'Session duration in minutes (default 30)' },
        reason: { type: 'string', description: 'Reason for sharing the session' },
      },
      required: ['inspectionId', 'expertEmail'],
    },
  },
  enable_low_bandwidth: {
    name: 'enable_low_bandwidth',
    description: 'Enable low bandwidth mode for slow network connections. Reduces video quality to save data.',
    parameters: {
      type: 'object',
      properties: {
        quality: { type: 'string', description: 'Quality: low (320p), medium (480p), high (720p), auto' },
      },
      required: [],
    },
  },
  sync_offline_data: {
    name: 'sync_offline_data',
    description: 'Manually trigger synchronization of offline queued data when back online.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to sync' },
      },
      required: [],
    },
  },
  send_push_notification: {
    name: 'send_push_notification',
    description: 'Send push notification to technician device for safety alerts, task assignments, or important updates.',
    parameters: {
      type: 'object',
      properties: {
        recipientId: { type: 'string', description: 'Technician ID or device token' },
        title: { type: 'string', description: 'Notification title' },
        message: { type: 'string', description: 'Notification body' },
        priority: { type: 'string', description: 'Priority: high, normal, low' },
        type: { type: 'string', description: 'Type: safety_alert, task_assignment, inspection_update' },
      },
      required: ['recipientId', 'title', 'message'],
    },
  },
  capture_location: {
    name: 'capture_location',
    description: 'Capture current GPS location and tag to inspection or equipment for location tracking.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to tag with location' },
        label: { type: 'string', description: 'Label for this location (e.g., equipment location)' },
      },
      required: ['inspectionId'],
    },
  },
}

export const ALL_ADK_FUNCTIONS = Object.values(ADK_FUNCTIONS)

export function getFunctionDeclaration(name: string): AdkFunctionDeclaration | undefined {
  return ADK_FUNCTIONS[name]
}

export type WorkflowActionTypeWithOcr = WorkflowActionType | 'run_ocr'

export function isWorkflowAction(action: string): action is WorkflowActionType {
  return ['log_issue', 'create_ticket', 'notify_supervisor', 'add_to_history'].includes(action)
}

export function isAdkFunction(action: string): action is keyof typeof ADK_FUNCTIONS {
  return action in ADK_FUNCTIONS
}
