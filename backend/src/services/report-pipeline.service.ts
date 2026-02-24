import { GoogleAuth } from 'google-auth-library'
import { v4 as uuidv4 } from 'uuid'
import type { DataService } from './data-service'

export type ReportPipelineProvider = 'local' | 'pubsub'
export type ReportJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ReportGenerationJob {
  jobId: string
  inspectionId: string
  status: ReportJobStatus
  provider: ReportPipelineProvider
  createdAt: string
  updatedAt: string
  reportGeneratedAt?: string
  error?: string
}

interface ReportPubSubPayload {
  inspectionId: string
  jobId: string
  requestedAt: string
}

interface ReportPipelineLogger {
  info: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
}

const noopLogger: ReportPipelineLogger = {
  info: () => undefined,
  warn: () => undefined,
}

export class ReportPipelineService {
  private readonly jobs = new Map<string, ReportGenerationJob>()
  private readonly latestJobByInspectionId = new Map<string, string>()
  private readonly googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  private readonly configuredProvider: ReportPipelineProvider
  private readonly pubSubTopic: string | null
  private readonly logger: ReportPipelineLogger

  constructor(
    private readonly dataService: DataService,
    logger?: ReportPipelineLogger,
  ) {
    const providerValue = process.env.REPORT_PIPELINE_PROVIDER?.trim().toLowerCase()
    this.configuredProvider = providerValue === 'pubsub' ? 'pubsub' : 'local'
    const topic = process.env.REPORT_PUBSUB_TOPIC?.trim()
    this.pubSubTopic = topic && topic.length > 0 ? topic : null
    this.logger = logger || noopLogger
  }

  public async enqueueReportGeneration(inspectionId: string): Promise<ReportGenerationJob> {
    const now = new Date().toISOString()
    const provider = this.resolveProvider()
    const job: ReportGenerationJob = {
      jobId: uuidv4(),
      inspectionId,
      status: 'queued',
      provider,
      createdAt: now,
      updatedAt: now,
    }

    this.jobs.set(job.jobId, job)
    this.latestJobByInspectionId.set(inspectionId, job.jobId)

    if (provider === 'pubsub') {
      try {
        await this.publishToPubSub(job)
        this.logger.info('Report job queued on Pub/Sub pipeline', {
          inspectionId: job.inspectionId,
          jobId: job.jobId,
        })
      } catch (error) {
        this.logger.warn('Pub/Sub queue failed; falling back to local report processing', {
          inspectionId: job.inspectionId,
          jobId: job.jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        this.updateJob(job.jobId, {
          provider: 'local',
          updatedAt: new Date().toISOString(),
        })
        this.scheduleLocalProcessing(job.jobId)
      }
      const persistedJob = this.jobs.get(job.jobId)
      return persistedJob ? this.copyJob(persistedJob) : this.copyJob(job)
    }

    this.scheduleLocalProcessing(job.jobId)
    this.logger.info('Report job queued on local pipeline', {
      inspectionId: job.inspectionId,
      jobId: job.jobId,
    })
    return this.copyJob(job)
  }

  public getReportJob(jobId: string): ReportGenerationJob | null {
    const job = this.jobs.get(jobId)
    return job ? this.copyJob(job) : null
  }

  public getLatestReportJobForInspection(inspectionId: string): ReportGenerationJob | null {
    const jobId = this.latestJobByInspectionId.get(inspectionId)
    if (!jobId) {
      return null
    }
    return this.getReportJob(jobId)
  }

  private resolveProvider(): ReportPipelineProvider {
    if (this.configuredProvider === 'pubsub' && this.pubSubTopic) {
      return 'pubsub'
    }
    return 'local'
  }

  private scheduleLocalProcessing(jobId: string): void {
    setImmediate(() => {
      void this.runLocalProcessing(jobId)
    })
  }

  private async runLocalProcessing(jobId: string): Promise<void> {
    const current = this.jobs.get(jobId)
    if (!current) {
      return
    }

    this.updateJob(jobId, {
      status: 'processing',
      updatedAt: new Date().toISOString(),
      error: undefined,
    })

    try {
      const report = await this.dataService.generateInspectionReport(current.inspectionId)
      if (!report) {
        throw new Error('Inspection not found')
      }

      this.updateJob(jobId, {
        status: 'completed',
        updatedAt: new Date().toISOString(),
        reportGeneratedAt: new Date().toISOString(),
        error: undefined,
      })
    } catch (error) {
      this.updateJob(jobId, {
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Report generation failed',
      })
    }
  }

  private updateJob(jobId: string, patch: Partial<ReportGenerationJob>): void {
    const current = this.jobs.get(jobId)
    if (!current) {
      return
    }
    this.jobs.set(jobId, {
      ...current,
      ...patch,
    })
  }

  private async publishToPubSub(job: ReportGenerationJob): Promise<void> {
    const topic = this.pubSubTopic
    if (!topic) {
      throw new Error('REPORT_PUBSUB_TOPIC is not configured')
    }

    const token = await this.googleAuth.getAccessToken()
    if (!token) {
      throw new Error('Unable to acquire access token for Pub/Sub publish')
    }

    const normalizedTopic = this.normalizeTopicPath(topic)
    const payload: ReportPubSubPayload = {
      inspectionId: job.inspectionId,
      jobId: job.jobId,
      requestedAt: job.createdAt,
    }
    const base64Payload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')

    const response = await fetch(`https://pubsub.googleapis.com/v1/${normalizedTopic}:publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            data: base64Payload,
          },
        ],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const details = text || `status ${response.status}`
      throw new Error(`Pub/Sub publish failed: ${details}`)
    }
  }

  private normalizeTopicPath(rawTopic: string): string {
    const trimmed = rawTopic.trim()
    if (trimmed.startsWith('projects/')) {
      return trimmed
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim()
    if (!projectId) {
      throw new Error(
        'GOOGLE_CLOUD_PROJECT is required when REPORT_PUBSUB_TOPIC is not fully qualified',
      )
    }

    return `projects/${projectId}/topics/${trimmed}`
  }

  private copyJob(job: ReportGenerationJob): ReportGenerationJob {
    return {
      ...job,
    }
  }
}
