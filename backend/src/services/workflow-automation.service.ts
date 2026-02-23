import http from 'http'
import https from 'https'
import { randomUUID } from 'crypto'
import { URL } from 'url'
import type { WorkflowActionType } from '../types'

interface WorkflowActionInput {
  inspectionId: string
  action: WorkflowActionType
  note?: string
  metadata?: Record<string, unknown>
}

export interface WorkflowActionResult {
  status: 'completed' | 'failed'
  resultMessage: string
  externalReferenceId?: string
}

interface OutboundPayload {
  inspectionId: string
  action: WorkflowActionType
  note?: string
  metadata?: Record<string, unknown>
  requestedAt: string
}

export class WorkflowAutomationService {
  private readonly requestTimeoutMs = 5000
  private readonly maxWebhookAttempts = 3

  public async runAction(input: WorkflowActionInput): Promise<WorkflowActionResult> {
    switch (input.action) {
      case 'log_issue':
        return {
          status: 'completed',
          resultMessage: input.note
            ? `Issue logged: ${input.note}`
            : 'Issue logged for this inspection.',
        }

      case 'add_to_history':
        return {
          status: 'completed',
          resultMessage: 'Inspection update added to technician history.',
        }

      case 'create_ticket':
        return this.handleWebhookOrLocal(
          process.env.WORKFLOW_TICKET_WEBHOOK_URL,
          input,
          'ticket',
          'Ticket created locally (no webhook configured).',
        )

      case 'notify_supervisor':
        return this.handleWebhookOrLocal(
          process.env.WORKFLOW_NOTIFY_WEBHOOK_URL,
          input,
          'notification',
          'Supervisor notification queued locally (no webhook configured).',
        )
    }
  }

  private async handleWebhookOrLocal(
    webhookUrl: string | undefined,
    input: WorkflowActionInput,
    refPrefix: string,
    localFallbackMessage: string,
  ): Promise<WorkflowActionResult> {
    if (!webhookUrl) {
      return {
        status: 'completed',
        resultMessage: localFallbackMessage,
        externalReferenceId: `${refPrefix}_${randomUUID()}`,
      }
    }

    const payload: OutboundPayload = {
      inspectionId: input.inspectionId,
      action: input.action,
      note: input.note,
      metadata: input.metadata,
      requestedAt: new Date().toISOString(),
    }

    try {
      await this.postJsonWithRetry(webhookUrl, payload)
      return {
        status: 'completed',
        resultMessage: `Workflow action delivered to ${new URL(webhookUrl).host}.`,
        externalReferenceId: `${refPrefix}_${randomUUID()}`,
      }
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

  private async postJsonWithRetry(url: string, payload: OutboundPayload): Promise<void> {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= this.maxWebhookAttempts; attempt += 1) {
      try {
        await this.postJson(url, payload)
        return
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Webhook request failed')
  }

  private async postJson(url: string, payload: OutboundPayload): Promise<void> {
    const serialized = JSON.stringify(payload)
    const parsed = new URL(url)
    const transport = parsed.protocol === 'http:' ? http : https

    await new Promise<void>((resolve, reject) => {
      const request = transport.request(
        parsed,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(serialized),
          },
          timeout: this.requestTimeoutMs,
        },
        (response) => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve()
            return
          }
          reject(new Error(`Webhook returned status ${response.statusCode || 'unknown'}`))
        },
      )

      request.on('timeout', () => {
        request.destroy(new Error('Webhook request timed out'))
      })
      request.on('error', (error) => reject(error))
      request.write(serialized)
      request.end()
    })
  }
}
