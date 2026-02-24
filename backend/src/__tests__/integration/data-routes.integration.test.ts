import express from 'express'
import request from 'supertest'
import { Firestore } from '@google-cloud/firestore'
import { createDataRouter } from '../../routes/data.routes'
import { FirestoreDataService } from '../../services/firestore-data.service'

const hasFirestoreEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

const describeIfEmulator = hasFirestoreEmulator ? describe : describe.skip

describeIfEmulator('Data routes integration (Firestore emulator)', () => {
  jest.setTimeout(30_000)

  const firestore = new Firestore({ projectId: 'fieldsightlive-test' })
  const dataService = new FirestoreDataService(firestore)
  const storageService = {
    async createSignedUploadUrl(inspectionId: string, fileName: string, contentType: string) {
      return {
        uploadUrl: `http://localhost/upload/${inspectionId}/${fileName}`,
        objectPath: `inspections/${inspectionId}/images/${fileName}`,
        publicUrl: `https://storage.googleapis.com/test-bucket/inspections/${inspectionId}/images/${fileName}`,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        contentType,
      }
    },
  }
  const reportPdfService = {
    async renderInspectionReportPdf() {
      return Buffer.from('pdf-bytes')
    },
  }
  const reportPipelineService = {
    async enqueueReportGeneration(inspectionId: string) {
      return {
        jobId: `job_${inspectionId}`,
        inspectionId,
        status: 'queued' as const,
        provider: 'local' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    getReportJob() {
      return null
    },
    getLatestReportJobForInspection() {
      return null
    },
  }
  const ocrService = {
    async extractFromImageUrl(imageUrl: string) {
      return {
        imageUrl,
        extractedText: 'SN-123 PART-77 220psi',
        serialNumbers: ['SN-123'],
        partCodes: ['PART-77'],
        meterReadings: ['220psi'],
        warningLabels: ['HIGH VOLTAGE'],
        confidence: 0.9,
      }
    },
  }
  const workflowAutomationService = {
    async runAction(input: {
      inspectionId: string
      action: string
      note?: string
      metadata?: Record<string, unknown>
      idempotencyKey?: string
    }) {
      return {
        status: 'completed' as const,
        resultMessage: input.note
          ? `${input.action} completed: ${input.note}`
          : `${input.action} completed`,
        externalReferenceId: 'wf_123',
      }
    },
  }

  const app = express()
  app.use(express.json())
  app.use(
    '/api/v1',
    createDataRouter(
      dataService,
      storageService,
      reportPipelineService,
      reportPdfService,
      ocrService,
      workflowAutomationService,
    ),
  )

  beforeAll(async () => {
    await clearCollection('technicians')
    await clearCollection('sites')
    await clearCollection('inspections')
  }, 20_000)

  afterAll(async () => {
    await firestore.terminate()
  })

  it('should run CRUD + snapshot attach flow', async () => {
    const techRes = await request(app).post('/api/v1/technicians').send({
      name: 'Test Tech',
      email: 'tech@example.com',
      role: 'technician',
    })
    expect(techRes.status).toBe(201)
    expect(techRes.body.id).toBeDefined()

    const siteRes = await request(app).post('/api/v1/sites').send({
      name: 'Test Site',
      type: 'power',
      location: {
        latitude: 6.45,
        longitude: 3.39,
      },
      technicianIds: [techRes.body.id],
    })
    expect(siteRes.status).toBe(201)
    expect(siteRes.body.id).toBeDefined()

    const inspectionRes = await request(app).post('/api/v1/inspections').send({
      technicianId: techRes.body.id,
      siteId: siteRes.body.id,
    })
    expect(inspectionRes.status).toBe(201)
    expect(inspectionRes.body.status).toBe('in_progress')

    const inspectionId = inspectionRes.body.id as string

    const listRes = await request(app).get('/api/v1/inspections')
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body)).toBe(true)
    expect(listRes.body.some((i: { id: string }) => i.id === inspectionId)).toBe(true)

    const statusRes = await request(app)
      .patch(`/api/v1/inspections/${inspectionId}/status`)
      .send({ status: 'completed', summary: 'Inspection completed successfully.' })
    expect(statusRes.status).toBe(200)
    expect(statusRes.body.status).toBe('completed')

    const signedRes = await request(app)
      .post(`/api/v1/inspections/${inspectionId}/snapshots/signed-url`)
      .send({ fileName: 'snap.jpg', contentType: 'image/jpeg' })
    expect(signedRes.status).toBe(200)
    expect(signedRes.body.publicUrl).toContain(`inspections/${inspectionId}/images`)

    const attachRes = await request(app)
      .post(`/api/v1/inspections/${inspectionId}/snapshots/attach`)
      .send({ imageUrl: signedRes.body.publicUrl })
    expect(attachRes.status).toBe(204)

    const getRes = await request(app).get(`/api/v1/inspections/${inspectionId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.images).toContain(signedRes.body.publicUrl)

    const reportJobRes = await request(app).post(`/api/v1/inspections/${inspectionId}/report`)
    expect(reportJobRes.status).toBe(202)
    expect(reportJobRes.body.inspectionId).toBe(inspectionId)
    expect(reportJobRes.body.status).toBe('queued')

    const reportCreateRes = await request(app).post(`/api/v1/inspections/${inspectionId}/report?mode=sync`)
    expect(reportCreateRes.status).toBe(201)
    expect(reportCreateRes.body.inspectionId).toBe(inspectionId)

    const reportGetRes = await request(app).get(`/api/v1/inspections/${inspectionId}/report`)
    expect(reportGetRes.status).toBe(200)
    expect(reportGetRes.body.inspectionId).toBe(inspectionId)

    const reportPdfRes = await request(app).get(`/api/v1/inspections/${inspectionId}/report.pdf`)
    expect(reportPdfRes.status).toBe(200)
    expect(reportPdfRes.headers['content-type']).toContain('application/pdf')

    const ocrRes = await request(app).post(`/api/v1/inspections/${inspectionId}/ocr`).send({
      imageUrl: signedRes.body.publicUrl,
    })
    expect(ocrRes.status).toBe(200)
    expect(ocrRes.body.serialNumbers).toContain('SN-123')

    const inspectionAfterOcrRes = await request(app).get(`/api/v1/inspections/${inspectionId}`)
    expect(inspectionAfterOcrRes.status).toBe(200)
    expect(Array.isArray(inspectionAfterOcrRes.body.ocrFindings)).toBe(true)
    expect(inspectionAfterOcrRes.body.ocrFindings.length).toBeGreaterThan(0)

    const workflowRes = await request(app)
      .post(`/api/v1/inspections/${inspectionId}/workflow-actions`)
      .send({
        action: 'create_ticket',
        note: 'Pressure anomaly detected near valve A3',
      })
    expect(workflowRes.status).toBe(201)
    expect(workflowRes.body.action).toBe('create_ticket')

    const inspectionAfterWorkflow = await request(app).get(`/api/v1/inspections/${inspectionId}`)
    expect(inspectionAfterWorkflow.status).toBe(200)
    expect(Array.isArray(inspectionAfterWorkflow.body.workflowEvents)).toBe(true)
    expect(inspectionAfterWorkflow.body.workflowEvents.length).toBeGreaterThan(0)

    const reportWithWorkflowRes = await request(app).post(`/api/v1/inspections/${inspectionId}/report?mode=sync`)
    expect(reportWithWorkflowRes.status).toBe(201)
    expect(Array.isArray(reportWithWorkflowRes.body.workflowSummary)).toBe(true)
    expect(reportWithWorkflowRes.body.workflowSummary.length).toBeGreaterThan(0)
  })

  async function clearCollection(collectionName: string): Promise<void> {
    const snapshot = await firestore.collection(collectionName).get()
    const batch = firestore.batch()
    snapshot.docs.forEach((doc) => batch.delete(doc.ref))
    if (!snapshot.empty) {
      await batch.commit()
    }
  }
})
