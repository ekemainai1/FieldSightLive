import type { DataService } from './data-service'
import type { InspectionReport } from './firestore-data.service'
import { ReportPipelineService } from './report-pipeline.service'

function createReport(inspectionId: string): InspectionReport {
  return {
    inspectionId,
    generatedAt: new Date(),
    technicianId: 'tech-1',
    siteId: 'site-1',
    status: 'completed',
    findings: [],
    safetySummary: [],
    workflowSummary: [],
    recommendedActions: [],
    imageCount: 0,
    summaryText: 'ok',
  }
}

async function waitForStatus(
  service: ReportPipelineService,
  jobId: string,
  status: 'completed' | 'failed',
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const job = service.getReportJob(jobId)
    if (job?.status === status) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for job ${jobId} to reach ${status}`)
}

describe('ReportPipelineService', () => {
  const originalProvider = process.env.REPORT_PIPELINE_PROVIDER
  const originalTopic = process.env.REPORT_PUBSUB_TOPIC

  afterEach(() => {
    process.env.REPORT_PIPELINE_PROVIDER = originalProvider
    process.env.REPORT_PUBSUB_TOPIC = originalTopic
  })

  it('should enqueue and process report generation locally', async () => {
    process.env.REPORT_PIPELINE_PROVIDER = 'local'
    delete process.env.REPORT_PUBSUB_TOPIC

    const generateInspectionReport = jest.fn(async (inspectionId: string) => createReport(inspectionId))
    const service = new ReportPipelineService({
      generateInspectionReport,
    } as unknown as DataService)

    const job = await service.enqueueReportGeneration('insp-local-1')
    expect(job.status).toBe('queued')
    expect(job.provider).toBe('local')

    await waitForStatus(service, job.jobId, 'completed')

    const finalJob = service.getReportJob(job.jobId)
    expect(finalJob?.status).toBe('completed')
    expect(finalJob?.reportGeneratedAt).toBeDefined()
    expect(generateInspectionReport).toHaveBeenCalledWith('insp-local-1')
  })

  it('should mark job as failed when report cannot be generated', async () => {
    process.env.REPORT_PIPELINE_PROVIDER = 'local'
    delete process.env.REPORT_PUBSUB_TOPIC

    const generateInspectionReport = jest.fn(async () => null)
    const service = new ReportPipelineService({
      generateInspectionReport,
    } as unknown as DataService)

    const job = await service.enqueueReportGeneration('insp-missing')
    await waitForStatus(service, job.jobId, 'failed')

    const finalJob = service.getReportJob(job.jobId)
    expect(finalJob?.status).toBe('failed')
    expect(finalJob?.error).toContain('Inspection not found')
  })

  it('should fall back to local pipeline when pubsub provider is selected but topic is missing', async () => {
    process.env.REPORT_PIPELINE_PROVIDER = 'pubsub'
    delete process.env.REPORT_PUBSUB_TOPIC

    const generateInspectionReport = jest.fn(async (inspectionId: string) => createReport(inspectionId))
    const service = new ReportPipelineService({
      generateInspectionReport,
    } as unknown as DataService)

    const job = await service.enqueueReportGeneration('insp-fallback-1')
    expect(job.provider).toBe('local')

    await waitForStatus(service, job.jobId, 'completed')
    const latestJob = service.getLatestReportJobForInspection('insp-fallback-1')
    expect(latestJob?.jobId).toBe(job.jobId)
  })

  it('should fall back to local processing when pubsub publish fails', async () => {
    process.env.REPORT_PIPELINE_PROVIDER = 'pubsub'
    process.env.REPORT_PUBSUB_TOPIC = 'projects/test-project/topics/report-jobs'

    const generateInspectionReport = jest.fn(async (inspectionId: string) => createReport(inspectionId))
    const service = new ReportPipelineService({
      generateInspectionReport,
    } as unknown as DataService)

    jest
      .spyOn(
        service as unknown as {
          publishToPubSub: (job: unknown) => Promise<void>
        },
        'publishToPubSub',
      )
      .mockRejectedValue(new Error('pubsub unavailable'))

    const job = await service.enqueueReportGeneration('insp-fallback-2')
    expect(job.provider).toBe('local')

    await waitForStatus(service, job.jobId, 'completed')
    expect(generateInspectionReport).toHaveBeenCalledWith('insp-fallback-2')
  })
})
