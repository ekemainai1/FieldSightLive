import { WorkflowAutomationService } from './workflow-automation.service'

describe('WorkflowAutomationService', () => {
  const originalTicketWebhook = process.env.WORKFLOW_TICKET_WEBHOOK_URL

  afterEach(() => {
    process.env.WORKFLOW_TICKET_WEBHOOK_URL = originalTicketWebhook
    jest.restoreAllMocks()
  })

  it('should complete create_ticket with local fallback when webhook is absent', async () => {
    delete process.env.WORKFLOW_TICKET_WEBHOOK_URL
    const service = new WorkflowAutomationService()

    const result = await service.runAction({
      inspectionId: 'insp-1',
      action: 'create_ticket',
      note: 'Pressure drift near valve A',
    })

    expect(result.status).toBe('completed')
    expect(result.resultMessage).toContain('no webhook configured')
    expect(result.externalReferenceId).toMatch(/^ticket_/)
  })

  it('should retry webhook delivery and eventually succeed', async () => {
    process.env.WORKFLOW_TICKET_WEBHOOK_URL = 'https://example.com/workflow'
    const service = new WorkflowAutomationService()

    const postJsonSpy = jest
      .spyOn(service as unknown as { postJson: (url: string, payload: unknown) => Promise<void> }, 'postJson')
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockResolvedValueOnce()

    const result = await service.runAction({
      inspectionId: 'insp-2',
      action: 'create_ticket',
      note: 'Need ticket with retry',
    })

    expect(result.status).toBe('completed')
    expect(result.resultMessage).toContain('example.com')
    expect(postJsonSpy).toHaveBeenCalledTimes(3)
  })
})
