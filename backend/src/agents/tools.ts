import type { WorkflowActionType } from '../types'

export interface AdkTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

export const ADK_TOOLS: Record<WorkflowActionType, AdkTool> = {
  log_issue: {
    name: 'log_issue',
    description: 'Log an issue or problem found during inspection. Creates a record in the inspection history.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to log the issue under' },
        note: { type: 'string', description: 'Description of the issue' },
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
        note: { type: 'string', description: 'Ticket description or summary' },
      },
      required: ['inspectionId'],
    },
  },
  notify_supervisor: {
    name: 'notify_supervisor',
    description: 'Notify supervisor via webhook or external system about urgent findings or status.',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: 'The inspection ID to notify about' },
        note: { type: 'string', description: 'Notification message' },
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
        note: { type: 'string', description: 'Optional note for history entry' },
      },
      required: ['inspectionId'],
    },
  },
}

export const ALL_ADK_TOOLS = Object.values(ADK_TOOLS)

export function getToolForAction(action: WorkflowActionType): AdkTool {
  return ADK_TOOLS[action]
}
