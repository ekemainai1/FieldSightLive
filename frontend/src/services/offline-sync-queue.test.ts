import { OfflineSyncQueueService } from './offline-sync-queue'
import { inspectionService } from './inspection-service'

jest.mock('./inspection-service', () => ({
  inspectionService: {
    createInspection: jest.fn(),
    uploadSnapshot: jest.fn(),
    completeInspection: jest.fn(),
    generateReport: jest.fn(),
  },
}))

function setOnlineStatus(isOnline: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: isOnline,
  })
}

describe('OfflineSyncQueueService', () => {
  const service = new OfflineSyncQueueService()
  const mockedInspectionService = inspectionService as jest.Mocked<typeof inspectionService>

  beforeEach(() => {
    window.localStorage.clear()
    jest.clearAllMocks()
    setOnlineStatus(true)
  })

  it('should queue and sync create/snapshot/complete operations in order', async () => {
    mockedInspectionService.createInspection.mockResolvedValueOnce({
      id: 'insp-remote-1',
      status: 'in_progress',
    })
    mockedInspectionService.uploadSnapshot.mockResolvedValueOnce(
      'https://storage.example/snapshot-1.jpg',
    )
    mockedInspectionService.completeInspection.mockResolvedValueOnce({
      id: 'insp-remote-1',
      status: 'completed',
    })
    mockedInspectionService.generateReport.mockResolvedValueOnce({
      inspectionId: 'insp-remote-1',
      generatedAt: new Date().toISOString(),
      status: 'completed',
      findings: [],
      safetySummary: [],
      workflowSummary: [],
      recommendedActions: [],
      imageCount: 1,
      summaryText: 'done',
    })

    const localInspectionId = service.createOfflineInspectionId()
    service.enqueueCreateInspection(localInspectionId, {
      technicianId: 'tech-1',
      siteId: 'site-1',
    })
    service.enqueueSnapshotUpload(localInspectionId, 'data:image/jpeg;base64,aGVsbG8=')
    service.enqueueCompleteInspection(localInspectionId, 'Inspection complete.')

    const onInspectionIdMapped = jest.fn()
    const onReportGenerated = jest.fn()

    const result = await service.flush({
      onInspectionIdMapped,
      onReportGenerated,
    })

    expect(result).toEqual({
      processed: 3,
      remaining: 0,
      failed: 0,
    })
    expect(mockedInspectionService.createInspection).toHaveBeenCalledWith({
      technicianId: 'tech-1',
      siteId: 'site-1',
    })
    expect(mockedInspectionService.uploadSnapshot).toHaveBeenCalledWith(
      'insp-remote-1',
      'data:image/jpeg;base64,aGVsbG8=',
    )
    expect(mockedInspectionService.completeInspection).toHaveBeenCalledWith('insp-remote-1', {
      summary: 'Inspection complete.',
    })
    expect(mockedInspectionService.generateReport).toHaveBeenCalledWith('insp-remote-1')
    expect(onInspectionIdMapped).toHaveBeenCalledWith(localInspectionId, 'insp-remote-1')
    expect(onReportGenerated).toHaveBeenCalledTimes(1)
    expect(service.getPendingCount()).toBe(0)
  })

  it('should keep queued items when browser is offline', async () => {
    setOnlineStatus(false)

    const localInspectionId = service.createOfflineInspectionId()
    service.enqueueCreateInspection(localInspectionId, {
      technicianId: 'tech-2',
      siteId: 'site-2',
    })

    const result = await service.flush()

    expect(result).toEqual({
      processed: 0,
      remaining: 1,
      failed: 0,
    })
    expect(mockedInspectionService.createInspection).not.toHaveBeenCalled()
    expect(service.getPendingCount()).toBe(1)
  })

  it('should retry queued operation after transient network failure', async () => {
    const localInspectionId = service.createOfflineInspectionId()
    service.enqueueCreateInspection(localInspectionId, {
      technicianId: 'tech-3',
      siteId: 'site-3',
    })

    mockedInspectionService.createInspection
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        id: 'insp-remote-3',
        status: 'in_progress',
      })

    const firstAttempt = await service.flush()
    expect(firstAttempt.processed).toBe(0)
    expect(firstAttempt.remaining).toBe(1)

    const secondAttempt = await service.flush()
    expect(secondAttempt.processed).toBe(1)
    expect(secondAttempt.remaining).toBe(0)
    expect(mockedInspectionService.createInspection).toHaveBeenCalledTimes(2)
  })
})
