import { Router } from 'express'
import { z } from 'zod'
import type { DataService } from '../services/data-service'
import type { InspectionReport } from '../services/firestore-data.service'
import type { OcrExtractionResult } from '../services/equipment-ocr.service'
import type { ReportGenerationJob } from '../services/report-pipeline.service'
import type { WorkflowActionResult } from '../services/workflow-automation.service'
import type { AgentExecutionResult } from '../services/adk-agent.service'
import { StorageService } from '../services/storage.service'
import type { WorkflowActionType } from '../types'

interface StorageServiceLike {
  createSignedUploadUrl: StorageService['createSignedUploadUrl']
  getSignedReadUrl?: (objectPath: string, expiresInSeconds?: number) => Promise<{ url: string; expiresAt: string }>
}

interface ReportPdfServiceLike {
  renderInspectionReportPdf: (report: InspectionReport) => Promise<Buffer>
}

interface ReportPipelineServiceLike {
  enqueueReportGeneration: (inspectionId: string) => Promise<ReportGenerationJob>
  getReportJob: (jobId: string) => ReportGenerationJob | null
  getLatestReportJobForInspection: (inspectionId: string) => ReportGenerationJob | null
}

interface EquipmentOcrServiceLike {
  extractFromImageUrl: (imageUrl: string) => Promise<OcrExtractionResult>
}

interface WorkflowAutomationServiceLike {
  runAction: (input: {
    inspectionId: string
    action: WorkflowActionType
    note?: string
    metadata?: Record<string, unknown>
    idempotencyKey?: string
  }) => Promise<WorkflowActionResult>
}

const createTechnicianSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'technician', 'viewer']),
})

const createSiteSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['oil_gas', 'power', 'telecom', 'manufacturing', 'solar']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
  }),
  technicianIds: z.array(z.string()).default([]),
})

const createInspectionSchema = z.object({
  technicianId: z.string().min(1),
  siteId: z.string().min(1),
})

const updateInspectionStatusSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
  summary: z.string().optional(),
})

const signedUploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

const attachImageSchema = z.object({
  imageUrl: z.string().url(),
})

const ocrRequestSchema = z.object({
  imageUrl: z.string().url().optional(),
})

const workflowActionSchema = z.object({
  action: z.enum(['log_issue', 'create_ticket', 'notify_supervisor', 'add_to_history']),
  note: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

export function createDataRouter(
  dataService: DataService,
  storageService: StorageServiceLike,
  reportPipelineService: ReportPipelineServiceLike,
  reportPdfService: ReportPdfServiceLike,
  ocrService: EquipmentOcrServiceLike,
  workflowAutomationService: WorkflowAutomationServiceLike,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adkAgentService?: any,
): Router {
  const router = Router()

  router.post('/technicians', async (req, res) => {
    const parsed = createTechnicianSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid technician payload', details: parsed.error.flatten() })
      return
    }

    const technician = await dataService.createTechnician(parsed.data)
    res.status(201).json(technician)
  })

  router.get('/technicians', async (_req, res) => {
    const technicians = await dataService.listTechnicians()
    res.json(technicians)
  })

  router.post('/sites', async (req, res) => {
    const parsed = createSiteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid site payload', details: parsed.error.flatten() })
      return
    }

    const site = await dataService.createSite(parsed.data)
    res.status(201).json(site)
  })

  router.get('/sites', async (_req, res) => {
    const sites = await dataService.listSites()
    res.json(sites)
  })

  router.post('/inspections', async (req, res) => {
    const parsed = createInspectionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid inspection payload', details: parsed.error.flatten() })
      return
    }

    const inspection = await dataService.createInspection(parsed.data)
    res.status(201).json(inspection)
  })

  router.get('/inspections', async (req, res) => {
    const inspections = await dataService.listInspections({
      technicianId: typeof req.query.technicianId === 'string' ? req.query.technicianId : undefined,
      siteId: typeof req.query.siteId === 'string' ? req.query.siteId : undefined,
      status:
        req.query.status === 'in_progress' || req.query.status === 'completed'
          ? req.query.status
          : undefined,
    })
    res.json(inspections)
  })

  router.get('/inspections/:inspectionId', async (req, res) => {
    const inspection = await dataService.getInspectionById(req.params.inspectionId)
    if (!inspection) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }
    res.json(inspection)
  })

  router.patch('/inspections/:inspectionId/status', async (req, res) => {
    const parsed = updateInspectionStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid status payload', details: parsed.error.flatten() })
      return
    }

    const updated = await dataService.updateInspectionStatus(req.params.inspectionId, parsed.data)
    if (!updated) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }

    if (parsed.data.status === 'completed') {
      try {
        await reportPipelineService.enqueueReportGeneration(req.params.inspectionId)
      } catch {
        // Async report generation failed, but status update succeeded
      }
    }

    res.json(updated)
  })

  router.post('/inspections/:inspectionId/snapshots/signed-url', async (req, res) => {
    const parsed = signedUploadSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid upload payload', details: parsed.error.flatten() })
      return
    }

    try {
      const signed = await storageService.createSignedUploadUrl(
        req.params.inspectionId,
        parsed.data.fileName,
        parsed.data.contentType,
      )
      res.json(signed)
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create signed upload URL',
      })
    }
  })

  router.post('/inspections/:inspectionId/snapshots/attach', async (req, res) => {
    const parsed = attachImageSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid attach payload', details: parsed.error.flatten() })
      return
    }

    try {
      let imageUrlToStore = parsed.data.imageUrl

      // Try to extract object path and generate signed read URL
      // This handles MinIO URLs that need signed access
      try {
        const url = new URL(parsed.data.imageUrl)
        const pathname = url.pathname
        
        // Check if this looks like a MinIO/GCS path
        if (pathname.includes('/inspections/')) {
          // Extract object path (remove leading slash and bucket name if present)
          let objectPath = pathname.startsWith('/') ? pathname.slice(1) : pathname
          
          // Remove bucket name from path if present (e.g., fieldsightlive-dev/inspections/... -> inspections/...)
          const bucketName = process.env.MINIO_BUCKET_NAME || process.env.GCS_BUCKET_NAME
          if (bucketName && objectPath.startsWith(bucketName)) {
            objectPath = objectPath.slice(bucketName.length + 1)
          }
          
          // Try to generate a signed read URL (works for both MinIO and GCS)
          if (storageService.getSignedReadUrl) {
            const signedRead = await storageService.getSignedReadUrl(objectPath)
            imageUrlToStore = signedRead.url
          }
        }
      } catch {
        // URL parsing failed or signed URL generation failed, use original URL
      }

      await dataService.appendInspectionImage(req.params.inspectionId, imageUrlToStore)
      res.status(204).send()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to attach image'
      const statusCode = message.includes('not found') ? 404 : 500
      res.status(statusCode).json({ error: message })
    }
  })

  router.post('/inspections/:inspectionId/report', async (req, res) => {
    const inspection = await dataService.getInspectionById(req.params.inspectionId)
    if (!inspection) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }

    const mode = req.query.mode === 'sync' ? 'sync' : 'async'
    if (mode === 'sync') {
      const report = await dataService.generateInspectionReport(req.params.inspectionId)
      if (!report) {
        res.status(404).json({ error: 'Inspection not found' })
        return
      }
      res.status(201).json(report)
      return
    }

    try {
      const job = await reportPipelineService.enqueueReportGeneration(req.params.inspectionId)
      res.status(202).json(job)
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to enqueue report generation',
      })
    }
  })

  router.get('/inspections/:inspectionId/report/jobs/latest', (req, res) => {
    const job = reportPipelineService.getLatestReportJobForInspection(req.params.inspectionId)
    if (!job) {
      res.status(404).json({ error: 'Report job not found' })
      return
    }

    res.json(job)
  })

  router.get('/inspections/:inspectionId/report/jobs/:jobId', (req, res) => {
    const job = reportPipelineService.getReportJob(req.params.jobId)
    if (!job || job.inspectionId !== req.params.inspectionId) {
      res.status(404).json({ error: 'Report job not found' })
      return
    }

    res.json(job)
  })

  router.get('/inspections/:inspectionId/report', async (req, res) => {
    let report = await dataService.getInspectionReport(req.params.inspectionId)
    
    if (!report) {
      try {
        await reportPipelineService.enqueueReportGeneration(req.params.inspectionId)
        report = await dataService.getInspectionReport(req.params.inspectionId)
      } catch {
        // Report not ready yet
      }
    }
    
    if (!report) {
      res.status(404).json({ error: 'Report not found. Try generating it first with POST /inspections/:inspectionId/report' })
      return
    }
    res.json(report)
  })

  router.get('/inspections/:inspectionId/report.pdf', async (req, res) => {
    const report = await dataService.getInspectionReport(req.params.inspectionId)
    if (!report) {
      res.status(404).json({ error: 'Report not found' })
      return
    }

    const pdfBuffer = await reportPdfService.renderInspectionReportPdf(report)
    const filename = `inspection-report-${report.inspectionId}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).send(pdfBuffer)
  })

  router.post('/inspections/:inspectionId/ocr', async (req, res) => {
    const parsed = ocrRequestSchema.safeParse(req.body || {})
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid OCR payload', details: parsed.error.flatten() })
      return
    }

    const inspection = await dataService.getInspectionById(req.params.inspectionId)
    if (!inspection) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }

    const imageUrl = parsed.data.imageUrl || inspection.images[inspection.images.length - 1]
    if (!imageUrl) {
      res.status(400).json({ error: 'No image found for OCR. Capture/upload an image first.' })
      return
    }

    try {
      const extracted = await ocrService.extractFromImageUrl(imageUrl)
      await dataService.appendInspectionOcrFinding(req.params.inspectionId, {
        imageUrl: extracted.imageUrl,
        extractedText: extracted.extractedText,
        serialNumbers: extracted.serialNumbers,
        partCodes: extracted.partCodes,
        meterReadings: extracted.meterReadings,
        warningLabels: extracted.warningLabels,
        confidence: extracted.confidence,
      })
      res.json(extracted)
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to run OCR extraction',
      })
    }
  })

  router.post('/inspections/:inspectionId/workflow-actions', async (req, res) => {
    const parsed = workflowActionSchema.safeParse(req.body || {})
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid workflow action payload', details: parsed.error.flatten() })
      return
    }

    const inspection = await dataService.getInspectionById(req.params.inspectionId)
    if (!inspection) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }

    const headerIdempotencyKey =
      typeof req.headers['x-idempotency-key'] === 'string'
        ? req.headers['x-idempotency-key'].trim()
        : undefined
    const idempotencyKey = parsed.data.idempotencyKey || headerIdempotencyKey || undefined

    const result = await workflowAutomationService.runAction({
      inspectionId: req.params.inspectionId,
      action: parsed.data.action,
      note: parsed.data.note,
      metadata: parsed.data.metadata,
      idempotencyKey,
    })

    const event = await dataService.appendInspectionWorkflowEvent(req.params.inspectionId, {
      action: parsed.data.action,
      note: parsed.data.note,
      metadata: parsed.data.metadata,
      status: result.status,
      resultMessage: result.resultMessage,
      externalReferenceId: result.externalReferenceId,
    })

    res.status(201).json(event)
  })

  const siteAssetSchema = z.object({
    siteId: z.string().min(1),
    name: z.string().min(1).max(200),
    assetType: z.string().min(1).max(100),
    serialNumber: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  })

  router.post('/sites/:siteId/assets', async (req, res) => {
    const parsed = siteAssetSchema.safeParse(req.body || {})
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid asset payload', details: parsed.error.flatten() })
      return
    }

    const asset = await dataService.createSiteAsset(parsed.data)
    res.status(201).json(asset)
  })

  router.get('/sites/:siteId/assets', async (req, res) => {
    const assets = await dataService.listSiteAssets(req.params.siteId)
    res.json(assets)
  })

  router.delete('/sites/:siteId/assets/:assetId', async (req, res) => {
    await dataService.deleteSiteAsset(req.params.assetId)
    res.status(204).send()
  })

  router.post('/agent/execute', async (req, res) => {
    if (!adkAgentService) {
      res.status(503).json({ error: 'ADK Agent service is not available' })
      return
    }

    const { message, history } = req.body || {}
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' })
      return
    }

    try {
      const result = await adkAgentService.executeWithTools(message, history || [])
      res.json(result)
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Agent execution failed',
      })
    }
  })

  router.get('/agent/tools', async (_req, res) => {
    if (!adkAgentService) {
      res.status(503).json({ error: 'ADK Agent service is not available' })
      return
    }

    res.json({
      functions: adkAgentService.getFunctionDeclarations(),
      configured: adkAgentService.isConfigured(),
    })
  })

  return router
}
