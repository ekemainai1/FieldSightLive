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

  const app = express()
  app.use(express.json())
  app.use('/api/v1', createDataRouter(dataService, storageService, reportPdfService))

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

    const reportCreateRes = await request(app).post(`/api/v1/inspections/${inspectionId}/report`)
    expect(reportCreateRes.status).toBe(201)
    expect(reportCreateRes.body.inspectionId).toBe(inspectionId)

    const reportGetRes = await request(app).get(`/api/v1/inspections/${inspectionId}/report`)
    expect(reportGetRes.status).toBe(200)
    expect(reportGetRes.body.inspectionId).toBe(inspectionId)

    const reportPdfRes = await request(app).get(`/api/v1/inspections/${inspectionId}/report.pdf`)
    expect(reportPdfRes.status).toBe(200)
    expect(reportPdfRes.headers['content-type']).toContain('application/pdf')
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
