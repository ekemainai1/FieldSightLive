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
