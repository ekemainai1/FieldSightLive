import { detectWorkflowIntent } from './workflow-intents'

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
})
