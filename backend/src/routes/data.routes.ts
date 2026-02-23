import { Router } from 'express'
import { z } from 'zod'
import type { InspectionReport } from '../services/firestore-data.service'
import { FirestoreDataService } from '../services/firestore-data.service'
import type { OcrExtractionResult } from '../services/equipment-ocr.service'
import type { WorkflowActionResult } from '../services/workflow-automation.service'
import { StorageService } from '../services/storage.service'
import type { WorkflowActionType } from '../types'

interface StorageServiceLike {
  createSignedUploadUrl: StorageService['createSignedUploadUrl']
}

interface ReportPdfServiceLike {
  renderInspectionReportPdf: (report: InspectionReport) => Promise<Buffer>
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
})

export function createDataRouter(
  firestoreService: FirestoreDataService,
  storageService: StorageServiceLike,
  reportPdfService: ReportPdfServiceLike,
  ocrService: EquipmentOcrServiceLike,
  workflowAutomationService: WorkflowAutomationServiceLike,
): Router {
  const router = Router()

  router.post('/technicians', async (req, res) => {
    const parsed = createTechnicianSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid technician payload', details: parsed.error.flatten() })
      return
    }

    const technician = await firestoreService.createTechnician(parsed.data)
    res.status(201).json(technician)
  })

  router.get('/technicians', async (_req, res) => {
    const technicians = await firestoreService.listTechnicians()
    res.json(technicians)
  })

  router.post('/sites', async (req, res) => {
    const parsed = createSiteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid site payload', details: parsed.error.flatten() })
      return
    }

    const site = await firestoreService.createSite(parsed.data)
    res.status(201).json(site)
  })

  router.get('/sites', async (_req, res) => {
    const sites = await firestoreService.listSites()
    res.json(sites)
  })

  router.post('/inspections', async (req, res) => {
    const parsed = createInspectionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid inspection payload', details: parsed.error.flatten() })
      return
    }

    const inspection = await firestoreService.createInspection(parsed.data)
    res.status(201).json(inspection)
  })

  router.get('/inspections', async (req, res) => {
    const inspections = await firestoreService.listInspections({
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
    const inspection = await firestoreService.getInspectionById(req.params.inspectionId)
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

    const updated = await firestoreService.updateInspectionStatus(req.params.inspectionId, parsed.data)
    if (!updated) {
      res.status(404).json({ error: 'Inspection not found' })
      return
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
      await firestoreService.appendInspectionImage(req.params.inspectionId, parsed.data.imageUrl)
      res.status(204).send()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to attach image'
      const statusCode = message.includes('not found') ? 404 : 500
      res.status(statusCode).json({ error: message })
    }
  })

  router.post('/inspections/:inspectionId/report', async (req, res) => {
    const report = await firestoreService.generateInspectionReport(req.params.inspectionId)
    if (!report) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }
    res.status(201).json(report)
  })

  router.get('/inspections/:inspectionId/report', async (req, res) => {
    const report = await firestoreService.getInspectionReport(req.params.inspectionId)
    if (!report) {
      res.status(404).json({ error: 'Report not found' })
      return
    }
    res.json(report)
  })

  router.get('/inspections/:inspectionId/report.pdf', async (req, res) => {
    const report = await firestoreService.getInspectionReport(req.params.inspectionId)
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

    const inspection = await firestoreService.getInspectionById(req.params.inspectionId)
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
      await firestoreService.appendInspectionOcrFinding(req.params.inspectionId, {
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

    const inspection = await firestoreService.getInspectionById(req.params.inspectionId)
    if (!inspection) {
      res.status(404).json({ error: 'Inspection not found' })
      return
    }

    const result = await workflowAutomationService.runAction({
      inspectionId: req.params.inspectionId,
      action: parsed.data.action,
      note: parsed.data.note,
      metadata: parsed.data.metadata,
    })

    const event = await firestoreService.appendInspectionWorkflowEvent(req.params.inspectionId, {
      action: parsed.data.action,
      note: parsed.data.note,
      metadata: parsed.data.metadata,
      status: result.status,
      resultMessage: result.resultMessage,
      externalReferenceId: result.externalReferenceId,
    })

    res.status(201).json(event)
  })

  return router
}
