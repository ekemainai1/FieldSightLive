import type { DataService } from '../services/data-service'
import { FirestoreDataService } from '../services/firestore-data.service'
import { PostgresDataService } from '../services/postgres-data.service'

interface PubSubEnvelope {
  data?: string
  message?: {
    data?: string
  }
}

interface ReportPubSubPayload {
  inspectionId: string
  jobId?: string
  requestedAt?: string
}

export async function generateInspectionReportFromPubSub(
  event: PubSubEnvelope,
  dataServiceOverride?: DataService,
): Promise<void> {
  const payload = decodePubSubPayload(event)
  const dataService = dataServiceOverride || createDataService()
  const report = await dataService.generateInspectionReport(payload.inspectionId)
  if (!report) {
    throw new Error(`Inspection not found for report generation: ${payload.inspectionId}`)
  }
}

function createDataService(): DataService {
  const provider = resolveDataProvider()
  if (provider === 'firestore') {
    return new FirestoreDataService()
  }
  return new PostgresDataService()
}

function resolveDataProvider(): 'firestore' | 'postgres' {
  const configured = process.env.DATA_PROVIDER?.trim().toLowerCase()
  if (configured === 'firestore' || configured === 'postgres') {
    return configured
  }
  return process.env.NODE_ENV === 'production' ? 'firestore' : 'postgres'
}

function decodePubSubPayload(event: PubSubEnvelope): ReportPubSubPayload {
  const encoded = event.message?.data || event.data
  if (!encoded) {
    throw new Error('Missing Pub/Sub message data')
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const parsed = JSON.parse(decoded) as ReportPubSubPayload

  if (!parsed.inspectionId || parsed.inspectionId.trim().length === 0) {
    throw new Error('Invalid Pub/Sub payload: inspectionId is required')
  }

  return {
    inspectionId: parsed.inspectionId.trim(),
    jobId: parsed.jobId,
    requestedAt: parsed.requestedAt,
  }
}
