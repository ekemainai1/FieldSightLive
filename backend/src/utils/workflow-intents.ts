import type { WorkflowActionType } from '../types'

const EXTERNAL_ACTIONS = new Set<WorkflowActionType>(['create_ticket', 'notify_supervisor'])

const INTENT_PATTERNS: Array<{ action: WorkflowActionType; patterns: RegExp[] }> = [
  {
    action: 'create_ticket',
    patterns: [
      /\bcreate\s+(a\s+)?ticket\b/i,
      /\bopen\s+(a\s+)?ticket\b/i,
      /\braise\s+(a\s+)?ticket\b/i,
    ],
  },
  {
    action: 'notify_supervisor',
    patterns: [
      /\bnotify\s+(my\s+)?supervisor\b/i,
      /\balert\s+(my\s+)?supervisor\b/i,
      /\binform\s+(my\s+)?supervisor\b/i,
    ],
  },
  {
    action: 'log_issue',
    patterns: [
      /\blog\s+(this\s+)?issue\b/i,
      /\brecord\s+(this\s+)?issue\b/i,
      /\blog\s+issue\b/i,
    ],
  },
  {
    action: 'add_to_history',
    patterns: [
      /\badd\s+(this\s+)?to\s+history\b/i,
      /\bsave\s+(this\s+)?to\s+history\b/i,
    ],
  },
]

export function detectWorkflowIntent(transcript: string): WorkflowActionType | null {
  const text = transcript.trim()
  if (!text) {
    return null
  }

  for (const intent of INTENT_PATTERNS) {
    if (intent.patterns.some((pattern) => pattern.test(text))) {
      return intent.action
    }
  }

  return null
}

export function requiresVoiceConfirmation(action: WorkflowActionType): boolean {
  return EXTERNAL_ACTIONS.has(action)
}

export function detectWorkflowConfirmationDecision(transcript: string): 'confirm' | 'cancel' | null {
  const text = transcript.trim()
  if (!text) {
    return null
  }

  if (/\b(confirm|yes|proceed|do it|go ahead)\b/i.test(text)) {
    return 'confirm'
  }

  if (/\b(cancel|stop|never mind|abort|don't)\b/i.test(text)) {
    return 'cancel'
  }

  return null
}
