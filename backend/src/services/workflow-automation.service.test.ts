import { WorkflowAutomationService } from './workflow-automation.service'

describe('WorkflowAutomationService', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env = { ...envBackup }
  })

  afterEach(() => {
    process.env = { ...envBackup }
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

  it('should retry retriable webhook failures and eventually succeed', async () => {
    process.env.WORKFLOW_TICKET_WEBHOOK_URL = 'https://example.com/workflow'
    const service = new WorkflowAutomationService()

    const sleepSpy = jest
      .spyOn(
        service as unknown as {
          sleep: (ms: number) => Promise<void>
        },
        'sleep',
      )
      .mockResolvedValue()

    const postJsonSpy = jest
      .spyOn(
        service as unknown as {
          postJson: (...args: unknown[]) => Promise<unknown>
        },
        'postJson',
      )
      .mockRejectedValueOnce(new Error('Webhook returned status 503'))
      .mockRejectedValueOnce(new Error('Webhook returned status 503'))
      .mockResolvedValueOnce({
        statusCode: 200,
        bodyText: '{"externalReferenceId":"TCK-900","message":"Ticket accepted"}',
        bodyJson: {
          externalReferenceId: 'TCK-900',
          message: 'Ticket accepted',
        },
      })

    const result = await service.runAction({
      inspectionId: 'insp-2',
      action: 'create_ticket',
      note: 'Need ticket with retry',
      idempotencyKey: 'retry-case-1',
    })

    expect(result.status).toBe('completed')
    expect(result.resultMessage).toBe('Ticket accepted')
    expect(result.externalReferenceId).toBe('TCK-900')
    expect(postJsonSpy).toHaveBeenCalledTimes(3)
    expect(sleepSpy).toHaveBeenCalledTimes(2)
  })

  it('should not retry non-retriable webhook failures', async () => {
    process.env.WORKFLOW_TICKET_WEBHOOK_URL = 'https://example.com/workflow'
    const service = new WorkflowAutomationService()

    const sleepSpy = jest
      .spyOn(
        service as unknown as {
          sleep: (ms: number) => Promise<void>
        },
        'sleep',
      )
      .mockResolvedValue()

    const postJsonSpy = jest
      .spyOn(
        service as unknown as {
          postJson: (...args: unknown[]) => Promise<unknown>
        },
        'postJson',
      )
      .mockRejectedValueOnce(new Error('Webhook returned status 400'))

    const result = await service.runAction({
      inspectionId: 'insp-3',
      action: 'create_ticket',
      note: 'Bad request case',
      idempotencyKey: 'non-retriable-1',
    })

    expect(result.status).toBe('failed')
    expect(result.resultMessage).toContain('status 400')
    expect(postJsonSpy).toHaveBeenCalledTimes(1)
    expect(sleepSpy).not.toHaveBeenCalled()
  })

  it('should return cached result for repeated idempotency key', async () => {
    process.env.WORKFLOW_NOTIFY_WEBHOOK_URL = 'https://hooks.example.com/notify'
    const service = new WorkflowAutomationService()

    const postJsonSpy = jest
      .spyOn(
        service as unknown as {
          postJson: (...args: unknown[]) => Promise<unknown>
        },
        'postJson',
      )
      .mockResolvedValue({
        statusCode: 200,
        bodyText: '{"referenceId":"NTF-44","resultMessage":"Notified supervisor"}',
        bodyJson: {
          referenceId: 'NTF-44',
          resultMessage: 'Notified supervisor',
        },
      })

    const first = await service.runAction({
      inspectionId: 'insp-4',
      action: 'notify_supervisor',
      note: 'Escalating safety concern',
      idempotencyKey: 'notify-idempotent-1',
    })
    const second = await service.runAction({
      inspectionId: 'insp-4',
      action: 'notify_supervisor',
      note: 'Escalating safety concern',
      idempotencyKey: 'notify-idempotent-1',
    })

    expect(first.status).toBe('completed')
    expect(second).toEqual(first)
    expect(postJsonSpy).toHaveBeenCalledTimes(1)
  })

  it('should map jira provider payload and use jira key as external reference', async () => {
    process.env.WORKFLOW_TICKET_WEBHOOK_URL = 'https://jira.example.com'
    process.env.WORKFLOW_TICKET_PROVIDER = 'jira'
    process.env.WORKFLOW_TICKET_JIRA_PROJECT_KEY = 'FS'
    process.env.WORKFLOW_TICKET_JIRA_ISSUE_TYPE = 'Bug'
    process.env.WORKFLOW_TICKET_AUTH_TYPE = 'bearer'
    process.env.WORKFLOW_TICKET_AUTH_TOKEN = 'jira-token'
    process.env.WORKFLOW_TICKET_JIRA_USE_ADF = 'true'
    const service = new WorkflowAutomationService()

    const postJsonSpy = jest
      .spyOn(
        service as unknown as {
          postJson: (...args: unknown[]) => Promise<unknown>
        },
        'postJson',
      )
      .mockResolvedValue({
        statusCode: 201,
        bodyText: '{"key":"FS-77","message":"Issue created"}',
        bodyJson: {
          key: 'FS-77',
          message: 'Issue created',
        },
      })

    const result = await service.runAction({
      inspectionId: 'insp-7',
      action: 'create_ticket',
      note: 'Compressor leakage',
      idempotencyKey: 'jira-idempotency-1',
      metadata: {
        source: 'voice_intent',
      },
    })

    expect(result.status).toBe('completed')
    expect(result.externalReferenceId).toBe('FS-77')
    expect(result.resultMessage).toBe('Issue created')

    expect(postJsonSpy.mock.calls[0][0]).toBe('https://jira.example.com/rest/api/3/issue')
    const payload = postJsonSpy.mock.calls[0][1] as Record<string, unknown>
    const fields = payload.fields as Record<string, unknown>
    expect(fields.project).toEqual({ key: 'FS' })
    expect(fields.issuetype).toEqual({ name: 'Bug' })
    const description = fields.description as Record<string, unknown>
    expect(description.type).toBe('doc')
    expect(description.version).toBe(1)
    expect(Array.isArray(description.content)).toBe(true)
    expect(fields.labels).toEqual(
      expect.arrayContaining(['fieldsightlive', 'create_ticket', 'voice_intent']),
    )

    const context = postJsonSpy.mock.calls[0][3] as { idempotencyKey: string }
    expect(context.idempotencyKey).toBe('jira-idempotency-1')
  })

  it('should build auth headers for service-now basic auth', () => {
    const service = new WorkflowAutomationService()

    const headers = (
      service as unknown as {
        buildRequestHeaders: (
          serializedPayload: string,
          webhookConfig: {
            provider: 'servicenow'
            authType: 'basic'
            authUsername: string
            authPassword: string
          },
          idempotencyKey: string,
        ) => Record<string, string>
      }
    ).buildRequestHeaders(
      '{"short_description":"x"}',
      {
        provider: 'servicenow',
        authType: 'basic',
        authUsername: 'sn_user',
        authPassword: 'sn_pass',
      },
      'idem-44',
    )

    expect(headers.Authorization).toBe(`Basic ${Buffer.from('sn_user:sn_pass').toString('base64')}`)
    expect(headers['X-Idempotency-Key']).toBe('idem-44')
  })

  it('should normalize service-now table endpoint and send table-record payload for proxy endpoint', async () => {
    process.env.WORKFLOW_NOTIFY_WEBHOOK_URL = 'https://snow.example.com/api/now/table'
    process.env.WORKFLOW_NOTIFY_PROVIDER = 'servicenow'
    process.env.WORKFLOW_NOTIFY_SERVICENOW_TABLE = 'incident'
    const service = new WorkflowAutomationService()

    const postJsonSpy = jest
      .spyOn(
        service as unknown as {
          postJson: (...args: unknown[]) => Promise<unknown>
        },
        'postJson',
      )
      .mockResolvedValue({
        statusCode: 201,
        bodyText: '{"result":{"number":"INC0012345"}}',
        bodyJson: {
          result: {
            number: 'INC0012345',
          },
        },
      })

    const result = await service.runAction({
      inspectionId: 'insp-8',
      action: 'notify_supervisor',
      note: 'Escalate to supervisor',
      idempotencyKey: 'snow-idempotency-1',
    })

    expect(result.status).toBe('completed')
    expect(result.externalReferenceId).toBe('INC0012345')
    expect(postJsonSpy.mock.calls[0][0]).toBe('https://snow.example.com/api/now/table/incident')

    const payloadToTableApi = postJsonSpy.mock.calls[0][1] as Record<string, unknown>
    expect(payloadToTableApi.short_description).toBe('Escalate to supervisor')
    expect(payloadToTableApi.u_inspection_id).toBe('insp-8')
  })

  it('should wrap service-now payload for non-table proxy endpoints', async () => {
    process.env.WORKFLOW_NOTIFY_WEBHOOK_URL = 'https://integrations.example.com/snow-proxy'
    process.env.WORKFLOW_NOTIFY_PROVIDER = 'servicenow'
    process.env.WORKFLOW_NOTIFY_SERVICENOW_TABLE = 'incident'
    const service = new WorkflowAutomationService()

    const postJsonSpy = jest
      .spyOn(
        service as unknown as {
          postJson: (...args: unknown[]) => Promise<unknown>
        },
        'postJson',
      )
      .mockResolvedValue({
        statusCode: 200,
        bodyText: '{"id":"proxy-44"}',
        bodyJson: {
          id: 'proxy-44',
        },
      })

    await service.runAction({
      inspectionId: 'insp-9',
      action: 'notify_supervisor',
      note: 'Proxy payload test',
      idempotencyKey: 'snow-proxy-1',
    })

    const payload = postJsonSpy.mock.calls[0][1] as Record<string, unknown>
    expect(payload.table).toBe('incident')
    const record = payload.record as Record<string, unknown>
    expect(record.short_description).toBe('Proxy payload test')
    expect(record.u_workflow_action).toBe('notify_supervisor')
  })
})
