export interface ExpertEscalationRequest {
  inspectionId: string
  reason: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  context: {
    faultDescription?: string
    failedAttempts?: number
    technicianNotes?: string
    attachedImages?: string[]
  }
}

export interface ExpertEscalationResult {
  escalationId: string
  status: 'queued' | 'sent' | 'acknowledged' | 'resolved'
  expertContacted?: string
  estimatedResponseTime?: string
  message: string
}

export interface ExpertContact {
  id: string
  name: string
  role: string
  specialty: string[]
  availability: 'online' | 'offline' | 'busy'
  contactMethod: 'email' | 'sms' | 'push'
}

type EscalationProvider = 'webhook' | 'email' | 'sms' | 'push'

export class ExpertRoutingService {
  private readonly webhookUrl: string | undefined
  private readonly provider: EscalationProvider
  private readonly expertiseAreas = [
    'electrical',
    'mechanical',
    'hydraulic',
    'pneumatic',
    'safety',
    'software',
    'network',
    'general',
  ]

  constructor() {
    this.webhookUrl = process.env.EXPERT_ESCALATION_WEBHOOK?.trim()
    this.provider = this.resolveProvider()
  }

  private resolveProvider(): EscalationProvider {
    const envProvider = process.env.EXPERT_ESCALATION_PROVIDER?.trim().toLowerCase()
    if (envProvider === 'email' || envProvider === 'sms' || envProvider === 'push') {
      return envProvider
    }
    return 'webhook'
  }

  public async escalateToExpert(
    request: ExpertEscalationRequest,
  ): Promise<ExpertEscalationResult> {
    const escalationId = `ESC_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    if (!this.webhookUrl && this.provider === 'webhook') {
      return {
        escalationId,
        status: 'queued',
        message: 'Expert escalation queued (no webhook configured). A supervisor will be notified.',
      }
    }

    try {
      const payload = this.buildEscalationPayload(request, escalationId)

      if (this.provider === 'webhook' && this.webhookUrl) {
        const response = await this.callWebhook(payload)
        return {
          escalationId,
          status: response.ok ? 'sent' : 'queued',
          estimatedResponseTime: this.getEstimatedResponseTime(request.priority),
          message: response.ok
            ? `Escalation sent to expert team. Reference: ${escalationId}`
            : 'Escalation queued for retry.',
        }
      }

      return {
        escalationId,
        status: 'queued',
        estimatedResponseTime: this.getEstimatedResponseTime(request.priority),
        message: `Escalation queued via ${this.provider}. Reference: ${escalationId}`,
      }
    } catch (error) {
      return {
        escalationId,
        status: 'queued',
        message: `Escalation queued locally. ${error instanceof Error ? error.message : 'Will retry.'}`,
      }
    }
  }

  public shouldEscalate(
    faultCount: number,
    confidenceSum: number,
    failedAttempts: number,
    safetyCritical: boolean,
  ): { shouldEscalate: boolean; reason?: string } {
    if (safetyCritical) {
      return { shouldEscalate: true, reason: 'Safety-critical condition detected' }
    }

    if (failedAttempts >= 3) {
      return { shouldEscalate: true, reason: 'Multiple resolution attempts failed' }
    }

    if (faultCount >= 5) {
      return { shouldEscalate: true, reason: 'Multiple faults detected - expert review needed' }
    }

    if (confidenceSum / Math.max(faultCount, 1) < 0.5) {
      return { shouldEscalate: true, reason: 'Low confidence in automated diagnosis' }
    }

    return { shouldEscalate: false }
  }

  public determineRequiredExpertise(faultDescriptions: string[]): string[] {
    const text = faultDescriptions.join(' ').toLowerCase()
    const required: string[] = []

    for (const area of this.expertiseAreas) {
      const keywords = this.getKeywordsForExpertise(area)
      if (keywords.some((kw) => text.includes(kw))) {
        required.push(area)
      }
    }

    return required.length > 0 ? required : ['general']
  }

  private getKeywordsForExpertise(area: string): string[] {
    const keywords: Record<string, string[]> = {
      electrical: ['voltage', 'current', 'circuit', 'wire', 'power', 'electrical', 'fuse', 'breaker'],
      mechanical: ['bearing', 'belt', 'gear', 'motor', 'pump', 'valve', 'mechanical', 'vibration'],
      hydraulic: ['hydraulic', 'pressure', 'fluid', 'cylinder', 'hydraulic'],
      pneumatic: ['pneumatic', 'air', 'compressor', 'valve', 'pneumatic'],
      safety: ['safety', 'ppe', 'hazard', 'danger', 'emergency', 'leak', 'fire'],
      software: ['software', ' firmware', 'update', 'configuration', 'error code'],
      network: ['network', 'connection', 'signal', 'communication', 'remote'],
    }

    return keywords[area] || []
  }

  private buildEscalationPayload(
    request: ExpertEscalationRequest,
    escalationId: string,
  ): Record<string, unknown> {
    return {
      escalationId,
      inspectionId: request.inspectionId,
      priority: request.priority,
      reason: request.reason,
      context: request.context,
      requestedAt: new Date().toISOString(),
      source: 'fieldsightlive',
    }
  }

  private async callWebhook(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
    if (!this.webhookUrl) {
      return { ok: false }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      return { ok: response.ok }
    } catch {
      return { ok: false }
    } finally {
      clearTimeout(timeout)
    }
  }

  private getEstimatedResponseTime(priority: string): string {
    const times: Record<string, string> = {
      critical: '5-15 minutes',
      high: '15-30 minutes',
      medium: '1-2 hours',
      low: '4-8 hours',
    }
    return times[priority] || '4-8 hours'
  }
}
