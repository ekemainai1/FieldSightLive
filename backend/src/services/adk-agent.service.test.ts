import { AdkAgentService } from '../services/adk-agent.service'
import type { DataService } from '../services/data-service'
import type { WorkflowAutomationService } from '../services/workflow-automation.service'
import type { EquipmentOcrService } from '../services/equipment-ocr.service'

describe('AdkAgentService', () => {
  let mockDataService: jest.Mocked<DataService>
  let mockWorkflowService: jest.Mocked<WorkflowAutomationService>
  let mockOcrService: jest.Mocked<EquipmentOcrService>

  beforeEach(() => {
    mockDataService = {
      appendInspectionWorkflowEvent: jest.fn(),
      appendInspectionOcrFinding: jest.fn(),
      getInspectionById: jest.fn(),
    } as unknown as jest.Mocked<DataService>

    mockWorkflowService = {
      runAction: jest.fn(),
    } as unknown as jest.Mocked<WorkflowAutomationService>

    mockOcrService = {
      extractFromImageUrl: jest.fn(),
    } as unknown as jest.Mocked<EquipmentOcrService>
  })

  describe('when GEMINI_API_KEY is not set', () => {
    const originalEnv = process.env.GEMINI_API_KEY

    beforeEach(() => {
      delete process.env.GEMINI_API_KEY
    })

    afterEach(() => {
      process.env.GEMINI_API_KEY = originalEnv
    })

    it('should report as not configured', () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      expect(service.isConfigured()).toBe(false)
    })

    it('should return error when executing without API key', async () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      const result = await service.executeWithTools('Hello')

      expect(result.success).toBe(false)
      expect(result.message).toContain('GEMINI_API_KEY')
    })
  })

  describe('tool definitions', () => {
    it('should return all function declarations', () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      const functions = service.getFunctionDeclarations()

      expect(functions).toHaveLength(14)
      expect(functions.map(f => f.name)).toContain('log_issue')
      expect(functions.map(f => f.name)).toContain('create_ticket')
      expect(functions.map(f => f.name)).toContain('notify_supervisor')
      expect(functions.map(f => f.name)).toContain('add_to_history')
      expect(functions.map(f => f.name)).toContain('run_ocr')
      expect(functions.map(f => f.name)).toContain('get_equipment_manual')
      expect(functions.map(f => f.name)).toContain('get_calibration_guide')
      expect(functions.map(f => f.name)).toContain('track_time')
      expect(functions.map(f => f.name)).toContain('order_part')
      expect(functions.map(f => f.name)).toContain('start_share_session')
      expect(functions.map(f => f.name)).toContain('enable_low_bandwidth')
      expect(functions.map(f => f.name)).toContain('sync_offline_data')
      expect(functions.map(f => f.name)).toContain('send_push_notification')
      expect(functions.map(f => f.name)).toContain('capture_location')
    })
  })

  describe('executeTool', () => {
    it('should return error for unknown tool', async () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      const result = await service.executeTool('unknown_tool', {})

      expect(result.success).toBe(false)
      expect(result.message).toContain('Unknown tool')
    })

    it('should return error when inspectionId is missing for log_issue', async () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      const result = await service.executeTool('log_issue', {})

      expect(result.success).toBe(false)
      expect(result.message).toContain('inspectionId is required')
    })

    it('should log issue when inspectionId is provided', async () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      mockDataService.appendInspectionWorkflowEvent.mockResolvedValue({
        id: 'event-1',
        action: 'log_issue',
        note: 'Test issue',
        status: 'completed',
        resultMessage: 'Issue logged',
        createdAt: new Date(),
      })

      const result = await service.executeTool('log_issue', {
        inspectionId: 'inspection-123',
        note: 'Test issue',
      })

      expect(result.success).toBe(true)
      expect(result.toolName).toBe('log_issue')
      expect(mockDataService.appendInspectionWorkflowEvent).toHaveBeenCalledWith(
        'inspection-123',
        expect.objectContaining({
          action: 'log_issue',
          note: 'Test issue',
          status: 'completed',
        }),
      )
    })

    it('should run OCR when inspectionId and imageUrl provided', async () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      mockDataService.getInspectionById.mockResolvedValue({
        id: 'inspection-123',
        status: 'in_progress',
        images: ['https://example.com/image.jpg'],
        technicianId: 'tech-1',
        siteId: 'site-1',
        timestamp: new Date(),
        safetyFlags: [],
        detectedFaults: [],
        recommendedActions: [],
        ocrFindings: [],
        workflowEvents: [],
        transcript: '',
        summary: '',
      })

      mockOcrService.extractFromImageUrl.mockResolvedValue({
        imageUrl: 'https://example.com/image.jpg',
        extractedText: 'Serial: ABC123',
        serialNumbers: ['ABC123'],
        partCodes: [],
        meterReadings: [],
        warningLabels: [],
        confidence: 0.95,
      })

      const result = await service.executeTool('run_ocr', {
        inspectionId: 'inspection-123',
        imageUrl: 'https://example.com/image.jpg',
      })

      expect(result.success).toBe(true)
      expect(result.toolName).toBe('run_ocr')
      expect(mockOcrService.extractFromImageUrl).toHaveBeenCalledWith('https://example.com/image.jpg')
      expect(mockDataService.appendInspectionOcrFinding).toHaveBeenCalledWith(
        'inspection-123',
        expect.objectContaining({
          imageUrl: 'https://example.com/image.jpg',
          serialNumbers: ['ABC123'],
        }),
      )
    })

    it('should return error when OCR has no image', async () => {
      const service = new AdkAgentService(
        mockDataService,
        mockWorkflowService,
        mockOcrService,
      )

      mockDataService.getInspectionById.mockResolvedValue({
        id: 'inspection-123',
        status: 'in_progress',
        images: [],
        technicianId: 'tech-1',
        siteId: 'site-1',
        timestamp: new Date(),
        safetyFlags: [],
        detectedFaults: [],
        recommendedActions: [],
        ocrFindings: [],
        workflowEvents: [],
        transcript: '',
        summary: '',
      })

      const result = await service.executeTool('run_ocr', {
        inspectionId: 'inspection-123',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('No image found')
    })
  })
})
