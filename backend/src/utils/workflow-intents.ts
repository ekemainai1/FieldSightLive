import type { WorkflowActionType } from '../types'

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
