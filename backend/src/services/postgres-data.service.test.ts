import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { PostgresDataService } from './postgres-data.service'

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(),
}))

function queueSchemaQueries(): void {
  for (let i = 0; i < 5; i += 1) {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
  }
}

function createService(): PostgresDataService {
  queueSchemaQueries()
  return new PostgresDataService()
}

describe('PostgresDataService', () => {
  const mockedPool = Pool as unknown as jest.Mock
  const mockedUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>

  beforeEach(() => {
    mockQuery.mockReset()
    mockedPool.mockClear()
    mockedUuid.mockReset()
    mockedUuid.mockReturnValue('uuid-fixed')
    process.env.POSTGRES_URL = 'postgresql://localhost:5432/fieldsightlive_test'
  })

  afterEach(() => {
    delete process.env.POSTGRES_URL
  })

  it('should initialize schema using configured postgres connection', async () => {
    const service = createService()
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    await service.listTechnicians()

    expect(mockedPool).toHaveBeenCalledWith({
      connectionString: 'postgresql://localhost:5432/fieldsightlive_test',
    })
    expect(mockQuery.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS technicians')
    expect(mockQuery.mock.calls[1][0]).toContain('CREATE TABLE IF NOT EXISTS sites')
    expect(mockQuery.mock.calls[2][0]).toContain('CREATE TABLE IF NOT EXISTS inspections')
    expect(mockQuery.mock.calls[3][0]).toContain('CREATE TABLE IF NOT EXISTS inspection_reports')
    expect(mockQuery.mock.calls[4][0]).toContain('CREATE TABLE IF NOT EXISTS site_assets')
  })

  it('should create inspection and return normalized inspection payload', async () => {
    mockedUuid.mockReturnValue('insp-123')
    const service = createService()
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const inspection = await service.createInspection({
      technicianId: 'tech-1',
      siteId: 'site-1',
    })

    expect(inspection.id).toBe('insp-123')
    expect(inspection.status).toBe('in_progress')
    expect(inspection.images).toEqual([])
    expect(inspection.ocrFindings).toEqual([])

    const insertSql = String(mockQuery.mock.calls[5][0])
    const insertParams = mockQuery.mock.calls[5][1] as unknown[]
    expect(insertSql).toContain('INSERT INTO inspections')
    expect(insertParams[1]).toBe('tech-1')
    expect(insertParams[2]).toBe('site-1')
  })

  it('should list inspections with filters and map db fields to domain model', async () => {
    const service = createService()
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'insp-1',
          technician_id: 'tech-1',
          site_id: 'site-1',
          timestamp: '2026-02-21T10:00:00.000Z',
          status: 'completed',
          images: ['https://storage.example/a.jpg'],
          safety_flags: [
            {
              type: 'leak',
              severity: 'high',
              description: 'Pipe leak',
              timestamp: '2026-02-21T10:05:00.000Z',
            },
          ],
          detected_faults: [
            {
              component: 'valve-a',
              faultType: 'misalignment',
              confidence: 0.81,
              description: 'Valve is misaligned',
            },
          ],
          recommended_actions: ['Realign valve'],
          ocr_findings: [],
          workflow_events: [],
          transcript: 'agent: inspect valve',
          summary: 'Completed',
        },
      ],
    })

    const results = await service.listInspections({
      technicianId: 'tech-1',
      status: 'completed',
    })

    expect(results).toHaveLength(1)
    expect(results[0].technicianId).toBe('tech-1')
    expect(results[0].safetyFlags[0].timestamp).toBeInstanceOf(Date)
    expect(results[0].detectedFaults[0].recommendedActions).toEqual([])

    const listSql = String(mockQuery.mock.calls[5][0])
    const listParams = mockQuery.mock.calls[5][1] as unknown[]
    expect(listSql).toContain('WHERE technician_id = $1 AND status = $2')
    expect(listParams).toEqual(['tech-1', 'completed'])
  })

  it('should throw not-found error when appending faults to missing inspection', async () => {
    const service = createService()
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    await expect(
      service.appendInspectionDetectedFaults('missing-insp', [
        {
          component: 'gauge',
          faultType: 'no-reading',
          confidence: 0.9,
          description: 'No gauge reading',
          recommendedActions: ['Check power'],
        },
      ]),
    ).rejects.toThrow('Inspection not found')
  })

  it('should generate and persist report with findings, safety and workflow summary', async () => {
    const service = createService()
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'insp-22',
            technician_id: 'tech-22',
            site_id: 'site-22',
            timestamp: '2026-02-22T08:00:00.000Z',
            status: 'completed',
            images: ['img-1', 'img-2'],
            safety_flags: [
              {
                type: 'missing_ppe',
                severity: 'critical',
                description: 'No safety helmet',
                timestamp: '2026-02-22T08:10:00.000Z',
              },
            ],
            detected_faults: [
              {
                component: 'pump-3',
                faultType: 'overheating',
                confidence: 0.934,
                description: 'Pump overheating',
                recommendedActions: ['Shutdown pump'],
              },
            ],
            recommended_actions: ['Shutdown pump', 'Inspect coolant line'],
            ocr_findings: [],
            workflow_events: [
              {
                id: 'wf-1',
                action: 'create_ticket',
                status: 'completed',
                resultMessage: 'Ticket created',
                externalReferenceId: 'TCK-111',
                createdAt: '2026-02-22T08:11:00.000Z',
              },
            ],
            transcript: 'agent: overheating detected',
            summary: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const report = await service.generateInspectionReport('insp-22')

    expect(report).not.toBeNull()
    expect(report?.inspectionId).toBe('insp-22')
    expect(report?.findings).toContain('pump-3: overheating (93% confidence)')
    expect(report?.safetySummary).toContain('CRITICAL - No safety helmet')
    expect(report?.workflowSummary).toContain(
      'COMPLETED - create_ticket: Ticket created (TCK-111)',
    )
    expect(report?.imageCount).toBe(2)

    const upsertSql = String(mockQuery.mock.calls[6][0])
    expect(upsertSql).toContain('INSERT INTO inspection_reports')
  })
})
