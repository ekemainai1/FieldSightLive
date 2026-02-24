import { EventEmitter } from 'events'
import http from 'http'
import https from 'https'
import { WorkflowAutomationService } from './workflow-automation.service'

interface MockTransportResponse {
  statusCode: number
  bodyText?: string
  requestError?: Error
  triggerTimeout?: boolean
}

interface MockRequestCapture {
  target: unknown
  options: http.RequestOptions | undefined
  payload: string
}

class MockClientRequest extends EventEmitter {
  public payload = ''

  public write(chunk: string | Buffer): boolean {
    this.payload += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk
    return true
  }

  public end(): this {
    return this
  }

  public destroy(error?: Error): this {
    if (error) {
      setImmediate(() => this.emit('error', error))
    }
    return this
  }
}

const createTransportRequestMock = (
  transport: typeof http | typeof https,
  response: MockTransportResponse,
): { capture: MockRequestCapture; spy: jest.SpyInstance } => {
  const capture: MockRequestCapture = {
    target: undefined,
    options: undefined,
    payload: '',
  }

  const spy = jest.spyOn(transport, 'request').mockImplementation(((...args: unknown[]) => {
    const [target, optionsOrCallback, maybeCallback] = args
    const callback =
      typeof optionsOrCallback === 'function'
        ? (optionsOrCallback as (res: http.IncomingMessage) => void)
        : (maybeCallback as ((res: http.IncomingMessage) => void) | undefined)
    const options =
      typeof optionsOrCallback === 'function'
        ? undefined
        : (optionsOrCallback as http.RequestOptions | undefined)

    capture.target = target
    capture.options = options

    const request = new MockClientRequest()
    request.end = () => {
      setImmediate(() => {
        if (response.requestError) {
          request.emit('error', response.requestError)
          return
        }

        if (response.triggerTimeout) {
          request.emit('timeout')
          return
        }

        const incoming = new EventEmitter() as http.IncomingMessage
        ;(incoming as { statusCode?: number }).statusCode = response.statusCode
        callback?.(incoming)
        if (response.bodyText) {
          incoming.emit('data', Buffer.from(response.bodyText, 'utf8'))
        }
        incoming.emit('end')
      })

      return request
    }

    const originalWrite = request.write.bind(request)
    request.write = (chunk: string | Buffer) => {
      const result = originalWrite(chunk)
      capture.payload = request.payload
      return result
    }

    return request as unknown as http.ClientRequest
  }) as typeof transport.request)

  return {
    capture,
    spy,
  }
}

describe('WorkflowAutomationService transport contract', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env = { ...envBackup }
  })

  afterEach(() => {
    process.env = { ...envBackup }
    jest.restoreAllMocks()
  })

  it('sends create_ticket payload through https transport with idempotency and auth headers', async () => {
    process.env.WORKFLOW_TICKET_WEBHOOK_URL = 'https://tickets.example.com/workflow'
    process.env.WORKFLOW_TICKET_AUTH_TYPE = 'bearer'
    process.env.WORKFLOW_TICKET_AUTH_TOKEN = 'secret-token'
    const service = new WorkflowAutomationService()

    const { capture, spy: httpsSpy } = createTransportRequestMock(https, {
      statusCode: 201,
      bodyText: '{"id":"TCK-200","message":"Remote ticket created"}',
    })
    const httpSpy = jest.spyOn(http, 'request')

    const result = await service.runAction({
      inspectionId: 'insp-transport-1',
      action: 'create_ticket',
      note: 'Remote ticket test',
      idempotencyKey: 'idem-https-1',
    })

    expect(result.status).toBe('completed')
    expect(result.externalReferenceId).toBe('TCK-200')
    expect(result.resultMessage).toBe('Remote ticket created')

    expect(httpsSpy).toHaveBeenCalledTimes(1)
    expect(httpSpy).not.toHaveBeenCalled()

    const target = capture.target as URL
    expect(target.protocol).toBe('https:')
    expect(target.hostname).toBe('tickets.example.com')
    const headers = (capture.options?.headers || {}) as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret-token')
    expect(headers['X-Idempotency-Key']).toBe('idem-https-1')
    expect(headers['Content-Type']).toBe('application/json')

    const payload = JSON.parse(capture.payload) as Record<string, unknown>
    expect(payload.inspectionId).toBe('insp-transport-1')
    expect(payload.action).toBe('create_ticket')
    expect(payload.note).toBe('Remote ticket test')
    expect(payload.idempotencyKey).toBe('idem-https-1')
  })

  it('maps 400 webhook responses to failed action without retries', async () => {
    process.env.WORKFLOW_NOTIFY_WEBHOOK_URL = 'http://notify.example.com/webhook'
    const service = new WorkflowAutomationService()

    const sleepSpy = jest
      .spyOn(
        service as unknown as {
          sleep: (ms: number) => Promise<void>
        },
        'sleep',
      )
      .mockResolvedValue()
    const { capture, spy: httpSpy } = createTransportRequestMock(http, {
      statusCode: 400,
      bodyText: '{"error":"validation failed"}',
    })

    const result = await service.runAction({
      inspectionId: 'insp-transport-2',
      action: 'notify_supervisor',
      note: 'Supervisor escalation test',
      idempotencyKey: 'idem-http-1',
    })

    expect(result.status).toBe('failed')
    expect(result.resultMessage).toContain('status 400')
    expect(httpSpy).toHaveBeenCalledTimes(1)
    expect(sleepSpy).not.toHaveBeenCalled()

    const target = capture.target as URL
    expect(target.protocol).toBe('http:')
    const payload = JSON.parse(capture.payload) as Record<string, unknown>
    expect(payload.action).toBe('notify_supervisor')
    expect(payload.idempotencyKey).toBe('idem-http-1')
  })

  it('retries timed-out webhook requests and eventually returns failed status', async () => {
    process.env.WORKFLOW_NOTIFY_WEBHOOK_URL = 'https://notify.example.com/workflow'
    const service = new WorkflowAutomationService()

    const sleepSpy = jest
      .spyOn(
        service as unknown as {
          sleep: (ms: number) => Promise<void>
        },
        'sleep',
      )
      .mockResolvedValue()
    const { spy: httpsSpy } = createTransportRequestMock(https, {
      statusCode: 200,
      triggerTimeout: true,
    })

    const result = await service.runAction({
      inspectionId: 'insp-transport-3',
      action: 'notify_supervisor',
      note: 'Timeout retry test',
      idempotencyKey: 'idem-timeout-1',
    })

    expect(result.status).toBe('failed')
    expect(result.resultMessage).toContain('timed out')
    expect(httpsSpy).toHaveBeenCalledTimes(3)
    expect(sleepSpy).toHaveBeenCalledTimes(2)
  })
})
