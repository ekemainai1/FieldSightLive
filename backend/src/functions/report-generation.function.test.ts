import type { DataService } from '../services/data-service'
import type { InspectionReport } from '../services/firestore-data.service'
import { generateInspectionReportFromPubSub } from './report-generation.function'

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
    summaryText: 'Generated',
  }
}

describe('generateInspectionReportFromPubSub', () => {
  it('should decode pubsub payload and generate report', async () => {
    const payload = Buffer.from(JSON.stringify({ inspectionId: 'insp-1' }), 'utf8').toString('base64')
    const generateInspectionReport = jest.fn(async (inspectionId: string) => createReport(inspectionId))
    const dataService = { generateInspectionReport } as unknown as DataService

    await generateInspectionReportFromPubSub(
      {
        message: { data: payload },
      },
      dataService,
    )

    expect(generateInspectionReport).toHaveBeenCalledWith('insp-1')
  })

  it('should throw for payload without inspectionId', async () => {
    const payload = Buffer.from(JSON.stringify({ jobId: 'job-1' }), 'utf8').toString('base64')
    const dataService = {
      generateInspectionReport: jest.fn(async () => createReport('unused')),
    } as unknown as DataService

    await expect(
      generateInspectionReportFromPubSub(
        {
          message: { data: payload },
        },
        dataService,
      ),
    ).rejects.toThrow('inspectionId is required')
  })

  it('should throw when inspection is missing', async () => {
    const payload = Buffer.from(JSON.stringify({ inspectionId: 'insp-missing' }), 'utf8').toString('base64')
    const dataService = {
      generateInspectionReport: jest.fn(async () => null),
    } as unknown as DataService

    await expect(
      generateInspectionReportFromPubSub(
        {
          message: { data: payload },
        },
        dataService,
      ),
    ).rejects.toThrow('Inspection not found for report generation: insp-missing')
  })
})
