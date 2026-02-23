import { inspectionService } from './inspection-service'

describe('inspectionService (API-level with fetch mocking)', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('should create inspection via API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'insp-1', status: 'in_progress' }),
    })

    const result = await inspectionService.createInspection({
      technicianId: 'tech-1',
      siteId: 'site-1',
    })

    expect(result.id).toBe('insp-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/inspections',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('should run snapshot upload flow: signed URL -> upload -> attach', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(12345)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          uploadUrl: 'https://signed.example/upload',
          objectPath: 'inspections/insp-1/images/snapshot.jpg',
          publicUrl: 'https://storage.example/snapshot.jpg',
          expiresAt: new Date().toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      })

    const imageUrl = await inspectionService.uploadSnapshot(
      'insp-1',
      'data:image/jpeg;base64,aGVsbG8=',
    )

    expect(imageUrl).toBe('https://storage.example/snapshot.jpg')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8080/api/v1/inspections/insp-1/snapshots/signed-url',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://signed.example/upload',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:8080/api/v1/inspections/insp-1/snapshots/attach',
      expect.objectContaining({ method: 'POST' }),
    )

    ;(Date.now as jest.Mock).mockRestore()
  })

  it('should download report PDF as blob', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => mockBlob,
    })

    const result = await inspectionService.downloadReportPdf('insp-77')
    expect(result).toBe(mockBlob)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/inspections/insp-77/report.pdf',
    )
  })

  it('should trigger workflow action via API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'wf-1',
        action: 'create_ticket',
        status: 'completed',
        resultMessage: 'Ticket created.',
        createdAt: new Date().toISOString(),
      }),
    })

    const result = await inspectionService.runWorkflowAction(
      'insp-42',
      'create_ticket',
      'High pressure alert',
    )

    expect(result.action).toBe('create_ticket')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/inspections/insp-42/workflow-actions',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
