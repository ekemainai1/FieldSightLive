import http from 'http'
import https from 'https'
import { randomUUID } from 'crypto'
import { URL } from 'url'
import type { WorkflowActionType } from '../types'

type WorkflowProvider = 'generic' | 'jira' | 'servicenow'
type WorkflowAuthType = 'none' | 'bearer' | 'basic'

interface WorkflowActionInput {
  inspectionId: string
  action: WorkflowActionType
  note?: string
  metadata?: Record<string, unknown>
  idempotencyKey?: string
}

export interface WorkflowActionResult {
  status: 'completed' | 'failed'
  resultMessage: string
  externalReferenceId?: string
}

interface WorkflowRequestContext {
  idempotencyKey: string
  requestId: string
  requestedAt: string
}

interface WebhookResponse {
  statusCode: number
  bodyText: string
  bodyJson: Record<string, unknown> | null
}

interface CachedWorkflowResult {
  result: WorkflowActionResult
  createdAt: number
}

interface WorkflowWebhookConfig {
  url?: string
  provider: WorkflowProvider
  authType: WorkflowAuthType
  authToken?: string
  authUsername?: string
  authPassword?: string
  jiraProjectKey?: string
  jiraIssueType?: string
  jiraUseAdfDescription: boolean
  serviceNowTable?: string
}

class WorkflowWebhookError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message)
    this.name = 'WorkflowWebhookError'
  }
}

export class WorkflowAutomationService {
  private readonly requestTimeoutMs = 5000
  private readonly maxWebhookAttempts = 3
  private readonly baseRetryDelayMs = 150
  private readonly idempotencyResultTtlMs = 60 * 60 * 1000
  private readonly maxIdempotencyEntries = 1000
  private readonly idempotencyCache = new Map<string, CachedWorkflowResult>()

  public async runAction(input: WorkflowActionInput): Promise<WorkflowActionResult> {
    const idempotencyKey = this.resolveIdempotencyKey(input)
    const cachedResult = this.getCachedCompletedResult(idempotencyKey)
    if (cachedResult) {
      return cachedResult
    }

    switch (input.action) {
      case 'log_issue':
        return this.cacheCompletedResult(idempotencyKey, {
          status: 'completed',
          resultMessage: input.note
            ? `Issue logged: ${input.note}`
            : 'Issue logged for this inspection.',
        })

      case 'add_to_history':
        return this.cacheCompletedResult(idempotencyKey, {
          status: 'completed',
          resultMessage: 'Inspection update added to technician history.',
        })

      case 'create_ticket':
        return this.handleWebhookOrLocal(
          this.resolveWebhookConfig('create_ticket', input),
          input,
          idempotencyKey,
          'ticket',
          'Ticket created locally (no webhook configured).',
        )

      case 'notify_supervisor':
        return this.handleWebhookOrLocal(
          this.resolveWebhookConfig('notify_supervisor', input),
          input,
          idempotencyKey,
          'notification',
          'Supervisor notification queued locally (no webhook configured).',
        )

      default:
        return this.cacheCompletedResult(idempotencyKey, {
          status: 'completed',
          resultMessage: `Action ${input.action} processed via ADK agent.`,
        })
    }
  }

  private async handleWebhookOrLocal(
    webhookConfig: WorkflowWebhookConfig,
    input: WorkflowActionInput,
    idempotencyKey: string,
    refPrefix: string,
    localFallbackMessage: string,
  ): Promise<WorkflowActionResult> {
    if (!webhookConfig.url) {
      return this.cacheCompletedResult(idempotencyKey, {
        status: 'completed',
        resultMessage: localFallbackMessage,
        externalReferenceId: `${refPrefix}_${randomUUID()}`,
      })
    }

    const context: WorkflowRequestContext = {
      idempotencyKey,
      requestId: randomUUID(),
      requestedAt: new Date().toISOString(),
    }
    const payload = this.buildWebhookPayload(webhookConfig, input, context)

    try {
      const response = await this.postJsonWithRetry(webhookConfig.url, payload, webhookConfig, context)
      const fallbackReference = `${refPrefix}_${randomUUID()}`
      const externalReferenceId = this.extractExternalReferenceId(response.bodyJson, fallbackReference)
      const host = new URL(webhookConfig.url).host
      const resultMessage =
        this.extractWebhookResultMessage(response.bodyJson) ||
        `Workflow action delivered to ${host} (${webhookConfig.provider}).`

      return this.cacheCompletedResult(idempotencyKey, {
        status: 'completed',
        resultMessage,
        externalReferenceId,
      })
    } catch (error) {
      return {
        status: 'failed',
        resultMessage:
          error instanceof Error
            ? `Workflow webhook failed: ${error.message}`
            : 'Workflow webhook failed.',
      }
    }
  }

  private async postJsonWithRetry(
    url: string,
    payload: Record<string, unknown>,
    webhookConfig: WorkflowWebhookConfig,
    context: WorkflowRequestContext,
  ): Promise<WebhookResponse> {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= this.maxWebhookAttempts; attempt += 1) {
      try {
        return await this.postJson(url, payload, webhookConfig, context)
      } catch (error) {
        lastError = error
        if (!this.shouldRetryWebhookError(error) || attempt === this.maxWebhookAttempts) {
          break
        }
        await this.sleep(this.computeRetryDelayMs(attempt))
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Webhook request failed')
  }

  private async postJson(
    url: string,
    payload: Record<string, unknown>,
    webhookConfig: WorkflowWebhookConfig,
    context: WorkflowRequestContext,
  ): Promise<WebhookResponse> {
    const serialized = JSON.stringify(payload)
    const parsed = new URL(url)
    const transport = parsed.protocol === 'http:' ? http : https
    const headers = this.buildRequestHeaders(serialized, webhookConfig, context.idempotencyKey)

    return await new Promise<WebhookResponse>((resolve, reject) => {
      const request = transport.request(
        parsed,
        {
          method: 'POST',
          headers,
          timeout: this.requestTimeoutMs,
        },
        (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })
          response.on('end', () => {
            const bodyText = Buffer.concat(chunks).toString('utf8')
            const statusCode = response.statusCode || 0
            const bodyJson = this.tryParseJsonBody(bodyText)

            if (statusCode >= 200 && statusCode < 300) {
              resolve({
                statusCode,
                bodyText,
                bodyJson,
              })
              return
            }

            const message = `Webhook returned status ${statusCode || 'unknown'}`
            const retriable = statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500
            reject(new WorkflowWebhookError(message, retriable))
          })
          response.on('error', (error) => reject(error))
        },
      )

      request.on('timeout', () => {
        request.destroy(new WorkflowWebhookError('Webhook request timed out', true))
      })
      request.on('error', (error) => reject(error))
      request.write(serialized)
      request.end()
    })
  }

  private buildRequestHeaders(
    serializedPayload: string,
    webhookConfig: WorkflowWebhookConfig,
    idempotencyKey: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(serializedPayload)),
      'X-Idempotency-Key': idempotencyKey,
    }

    if (webhookConfig.provider === 'jira') {
      headers.Accept = 'application/json'
    }

    if (webhookConfig.authType === 'bearer') {
      const token = webhookConfig.authToken?.trim()
      if (!token) {
        throw new WorkflowWebhookError('Webhook bearer auth token is not configured', false)
      }
      headers.Authorization = `Bearer ${token}`
    }

    if (webhookConfig.authType === 'basic') {
      const username = webhookConfig.authUsername?.trim()
      const password = webhookConfig.authPassword
      if (!username || typeof password !== 'string') {
        throw new WorkflowWebhookError('Webhook basic auth credentials are not configured', false)
      }
      const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
      headers.Authorization = `Basic ${encoded}`
    }

    return headers
  }

  private buildWebhookPayload(
    webhookConfig: WorkflowWebhookConfig,
    input: WorkflowActionInput,
    context: WorkflowRequestContext,
  ): Record<string, unknown> {
    switch (webhookConfig.provider) {
      case 'jira':
        return this.buildJiraPayload(webhookConfig, input, context)
      case 'servicenow':
        return this.buildServiceNowPayload(webhookConfig, input, context)
      case 'generic':
      default:
        return this.buildGenericPayload(input, context)
    }
  }

  private buildGenericPayload(
    input: WorkflowActionInput,
    context: WorkflowRequestContext,
  ): Record<string, unknown> {
    return {
      inspectionId: input.inspectionId,
      action: input.action,
      note: input.note,
      metadata: input.metadata,
      idempotencyKey: context.idempotencyKey,
      requestId: context.requestId,
      requestedAt: context.requestedAt,
    }
  }

  private buildJiraPayload(
    webhookConfig: WorkflowWebhookConfig,
    input: WorkflowActionInput,
    context: WorkflowRequestContext,
  ): Record<string, unknown> {
    const projectKey = webhookConfig.jiraProjectKey || 'OPS'
    const issueType = webhookConfig.jiraIssueType || 'Task'
    const summary = input.note?.trim() || `Workflow ${input.action} for inspection ${input.inspectionId}`
    const description = input.note?.trim() || `Inspection ${input.inspectionId} requires ${input.action}.`
    const sourceLabel =
      typeof input.metadata?.source === 'string' && input.metadata.source.trim().length > 0
        ? input.metadata.source.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
        : 'app'
    const jiraDescription = webhookConfig.jiraUseAdfDescription
      ? this.toJiraAdfDescription({
          inspectionId: input.inspectionId,
          action: input.action,
          note: input.note,
          requestedAt: context.requestedAt,
        })
      : description

    return {
      fields: {
        project: {
          key: projectKey,
        },
        issuetype: {
          name: issueType,
        },
        summary,
        description: jiraDescription,
        labels: ['fieldsightlive', input.action, sourceLabel],
      },
      metadata: {
        inspectionId: input.inspectionId,
        action: input.action,
        requestedAt: context.requestedAt,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
        context: input.metadata || {},
      },
    }
  }

  private buildServiceNowPayload(
    webhookConfig: WorkflowWebhookConfig,
    input: WorkflowActionInput,
    context: WorkflowRequestContext,
  ): Record<string, unknown> {
    const shortDescription =
      input.note?.trim() || `Workflow ${input.action} requested for inspection ${input.inspectionId}`
    const serviceNowRecord = {
      short_description: shortDescription.slice(0, 160),
      description:
        input.note?.trim() || `Inspection ${input.inspectionId} requires action ${input.action}.`,
      category: 'operations',
      subcategory: 'fieldsightlive',
      u_inspection_id: input.inspectionId,
      u_workflow_action: input.action,
      u_idempotency_key: context.idempotencyKey,
      u_request_id: context.requestId,
      u_requested_at: context.requestedAt,
      u_metadata: input.metadata || {},
    }

    const targetPath = this.safeUrlPathname(webhookConfig.url)
    if (targetPath.startsWith('/api/now/table/')) {
      return serviceNowRecord
    }

    return {
      table: webhookConfig.serviceNowTable || 'incident',
      record: serviceNowRecord,
    }
  }

  private resolveWebhookConfig(
    action: 'create_ticket' | 'notify_supervisor',
    input: WorkflowActionInput,
  ): WorkflowWebhookConfig {
    const prefix = action === 'create_ticket' ? 'WORKFLOW_TICKET' : 'WORKFLOW_NOTIFY'
    const rawUrl = this.readEnvString(`${prefix}_WEBHOOK_URL`)
    const metadataProvider = this.getMetadataString(input.metadata, 'workflowProvider')
    const provider = this.parseProvider(metadataProvider || this.readEnvString(`${prefix}_PROVIDER`))
    const serviceNowTable = this.readEnvString(`${prefix}_SERVICENOW_TABLE`) || 'incident'
    const url = this.normalizeProviderUrl(rawUrl, provider, serviceNowTable)
    const authType = this.parseAuthType(this.readEnvString(`${prefix}_AUTH_TYPE`))

    return {
      url,
      provider,
      authType,
      authToken: this.readEnvString(`${prefix}_AUTH_TOKEN`),
      authUsername: this.readEnvString(`${prefix}_AUTH_USERNAME`),
      authPassword: this.readEnvString(`${prefix}_AUTH_PASSWORD`),
      jiraProjectKey: this.readEnvString(`${prefix}_JIRA_PROJECT_KEY`),
      jiraIssueType: this.readEnvString(`${prefix}_JIRA_ISSUE_TYPE`),
      jiraUseAdfDescription: this.parseBoolean(this.readEnvString(`${prefix}_JIRA_USE_ADF`), true),
      serviceNowTable,
    }
  }

  private resolveIdempotencyKey(input: WorkflowActionInput): string {
    if (typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim().length > 0) {
      return input.idempotencyKey.trim()
    }

    const fromMetadata = this.getMetadataString(input.metadata, 'idempotencyKey')
    if (fromMetadata) {
      return fromMetadata
    }

    return randomUUID()
  }

  private getCachedCompletedResult(idempotencyKey: string): WorkflowActionResult | null {
    this.pruneIdempotencyCache()
    const cached = this.idempotencyCache.get(idempotencyKey)
    if (!cached) {
      return null
    }
    return {
      ...cached.result,
    }
  }

  private cacheCompletedResult(
    idempotencyKey: string,
    result: WorkflowActionResult,
  ): WorkflowActionResult {
    this.pruneIdempotencyCache()
    this.idempotencyCache.set(idempotencyKey, {
      result: {
        ...result,
      },
      createdAt: Date.now(),
    })

    if (this.idempotencyCache.size > this.maxIdempotencyEntries) {
      const oldestKey = this.idempotencyCache.keys().next().value as string | undefined
      if (oldestKey) {
        this.idempotencyCache.delete(oldestKey)
      }
    }

    return result
  }

  private pruneIdempotencyCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.idempotencyCache.entries()) {
      if (now - entry.createdAt > this.idempotencyResultTtlMs) {
        this.idempotencyCache.delete(key)
      }
    }
  }

  private shouldRetryWebhookError(error: unknown): boolean {
    if (error instanceof WorkflowWebhookError) {
      return error.retriable
    }

    if (!(error instanceof Error)) {
      return false
    }

    const message = error.message.toLowerCase()
    return (
      message.includes('timed out') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('status 408') ||
      message.includes('status 425') ||
      message.includes('status 429') ||
      message.includes('status 5')
    )
  }

  private computeRetryDelayMs(attempt: number): number {
    const exp = this.baseRetryDelayMs * Math.pow(2, Math.max(0, attempt - 1))
    const jitter = Math.floor(Math.random() * 100)
    return exp + jitter
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  private tryParseJsonBody(bodyText: string): Record<string, unknown> | null {
    if (!bodyText || bodyText.trim().length === 0) {
      return null
    }

    try {
      const parsed = JSON.parse(bodyText) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return null
    } catch {
      return null
    }
  }

  private extractExternalReferenceId(
    bodyJson: Record<string, unknown> | null,
    fallbackReference: string,
  ): string {
    if (!bodyJson) {
      return fallbackReference
    }

    const directCandidates = [
      bodyJson.externalReferenceId,
      bodyJson.referenceId,
      bodyJson.ticketId,
      bodyJson.id,
      bodyJson.key,
      bodyJson.issueKey,
      bodyJson.number,
      bodyJson.sys_id,
    ]
    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }

    const nestedCandidates = [
      this.getStringByPath(bodyJson, ['result', 'number']),
      this.getStringByPath(bodyJson, ['result', 'sys_id']),
      this.getStringByPath(bodyJson, ['result', 'id']),
      this.getStringByPath(bodyJson, ['data', 'id']),
    ]
    for (const candidate of nestedCandidates) {
      if (candidate) {
        return candidate
      }
    }

    return fallbackReference
  }

  private extractWebhookResultMessage(bodyJson: Record<string, unknown> | null): string | null {
    if (!bodyJson) {
      return null
    }

    const directCandidates = [bodyJson.resultMessage, bodyJson.message, bodyJson.statusMessage]
    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }

    const nestedCandidates = [
      this.getStringByPath(bodyJson, ['result', 'message']),
      this.getStringByPath(bodyJson, ['result', 'status_message']),
      this.getStringByPath(bodyJson, ['error', 'message']),
    ]
    for (const candidate of nestedCandidates) {
      if (candidate) {
        return candidate
      }
    }

    return null
  }

  private readEnvString(name: string): string | undefined {
    const value = process.env[name]
    if (typeof value !== 'string') {
      return undefined
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  private parseProvider(value: string | undefined): WorkflowProvider {
    if (!value) {
      return 'generic'
    }
    const normalized = value.trim().toLowerCase()
    if (normalized === 'jira' || normalized === 'servicenow') {
      return normalized
    }
    return 'generic'
  }

  private parseAuthType(value: string | undefined): WorkflowAuthType {
    if (!value) {
      return 'none'
    }
    const normalized = value.trim().toLowerCase()
    if (normalized === 'bearer' || normalized === 'basic') {
      return normalized
    }
    return 'none'
  }

  private getStringByPath(
    source: Record<string, unknown>,
    path: [string, string] | [string, string, string],
  ): string | null {
    let current: unknown = source
    for (const segment of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null
      }
      current = (current as Record<string, unknown>)[segment]
    }
    if (typeof current === 'string' && current.trim().length > 0) {
      return current.trim()
    }
    return null
  }

  private getMetadataString(
    metadata: Record<string, unknown> | undefined,
    key: string,
  ): string | undefined {
    if (!metadata) {
      return undefined
    }
    const value = metadata[key]
    if (typeof value !== 'string') {
      return undefined
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  private normalizeProviderUrl(
    rawUrl: string | undefined,
    provider: WorkflowProvider,
    serviceNowTable: string,
  ): string | undefined {
    if (!rawUrl) {
      return undefined
    }

    try {
      const parsed = new URL(rawUrl)

      if (provider === 'jira') {
        if (parsed.pathname === '/' || parsed.pathname.trim().length === 0) {
          parsed.pathname = '/rest/api/3/issue'
        }
      }

      if (provider === 'servicenow') {
        if (parsed.pathname === '/api/now/table' || parsed.pathname === '/api/now/table/') {
          parsed.pathname = `/api/now/table/${serviceNowTable}`
        }
      }

      return parsed.toString()
    } catch {
      return rawUrl
    }
  }

  private safeUrlPathname(rawUrl: string | undefined): string {
    if (!rawUrl) {
      return ''
    }

    try {
      return new URL(rawUrl).pathname
    } catch {
      return ''
    }
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) {
      return defaultValue
    }

    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false
    }
    return defaultValue
  }

  private toJiraAdfDescription(input: {
    inspectionId: string
    action: WorkflowActionType
    note?: string
    requestedAt: string
  }): Record<string, unknown> {
    const primaryText =
      input.note?.trim() || `Inspection ${input.inspectionId} requires action ${input.action}.`

    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: primaryText,
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Inspection: ${input.inspectionId} | Action: ${input.action} | Requested: ${input.requestedAt}`,
            },
          ],
        },
      ],
    }
  }
}
