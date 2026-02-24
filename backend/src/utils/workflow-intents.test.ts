import {
  detectWorkflowConfirmationDecision,
  detectWorkflowIntent,
  requiresVoiceConfirmation,
} from './workflow-intents'

describe('detectWorkflowIntent', () => {
  it('should detect create_ticket phrases', () => {
    expect(detectWorkflowIntent('please create a ticket for this fault')).toBe('create_ticket')
    expect(detectWorkflowIntent('open ticket now')).toBe('create_ticket')
  })

  it('should detect notify_supervisor phrases', () => {
    expect(detectWorkflowIntent('notify my supervisor immediately')).toBe('notify_supervisor')
  })

  it('should detect log_issue phrases', () => {
    expect(detectWorkflowIntent('log this issue for follow-up')).toBe('log_issue')
  })

  it('should detect add_to_history phrases', () => {
    expect(detectWorkflowIntent('add this to history')).toBe('add_to_history')
  })

  it('should return null for non-workflow transcript', () => {
    expect(detectWorkflowIntent('zoom in on the gauge')).toBeNull()
  })

  it('should require confirmation for external actions only', () => {
    expect(requiresVoiceConfirmation('create_ticket')).toBe(true)
    expect(requiresVoiceConfirmation('notify_supervisor')).toBe(true)
    expect(requiresVoiceConfirmation('log_issue')).toBe(false)
  })

  it('should detect confirmation decisions', () => {
    expect(detectWorkflowConfirmationDecision('confirm')).toBe('confirm')
    expect(detectWorkflowConfirmationDecision('yes, proceed')).toBe('confirm')
    expect(detectWorkflowConfirmationDecision('cancel that')).toBe('cancel')
    expect(detectWorkflowConfirmationDecision('never mind')).toBe('cancel')
    expect(detectWorkflowConfirmationDecision('continue inspection')).toBeNull()
  })
})
