import { Firestore, Timestamp } from '@google-cloud/firestore'
import { v4 as uuidv4 } from 'uuid'
import type {
  DetectedFault,
  Inspection,
  OcrFinding,
  SafetyFlag,
  Site,
  SiteAsset,
  Technician,
  WorkflowEvent,
} from '../types'

interface CreateInspectionInput {
  technicianId: string
  siteId: string
}

interface ListInspectionFilters {
  technicianId?: string
  siteId?: string
  status?: 'in_progress' | 'completed'
}

interface UpdateInspectionStatusInput {
  status: 'in_progress' | 'completed'
  summary?: string
}

export interface InspectionReport {
  inspectionId: string
  generatedAt: Date
  technicianId: string
  siteId: string
  status: 'in_progress' | 'completed'
  findings: string[]
  safetySummary: string[]
  workflowSummary: string[]
  recommendedActions: string[]
  imageCount: number
  summaryText: string
}

export class FirestoreDataService {
  private readonly db: Firestore

  constructor(db?: Firestore) {
    this.db = db ?? new Firestore()
  }

  public async createTechnician(
    input: Omit<Technician, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Technician> {
    const id = uuidv4()
    const now = new Date()
    const technician: Technician = {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.collection('technicians').doc(id).set(this.serializeDates(technician))
    return technician
  }

  public async listTechnicians(): Promise<Technician[]> {
    const snapshot = await this.db.collection('technicians').orderBy('createdAt', 'desc').limit(100).get()
    return snapshot.docs.map((doc) => this.deserializeTechnician(doc.data() as Record<string, unknown>))
  }

  public async createSite(input: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<Site> {
    const id = uuidv4()
    const now = new Date()
    const site: Site = {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.collection('sites').doc(id).set(this.serializeDates(site))
    return site
  }

  public async listSites(): Promise<Site[]> {
    const snapshot = await this.db.collection('sites').orderBy('createdAt', 'desc').limit(100).get()
    return snapshot.docs.map((doc) => this.deserializeSite(doc.data() as Record<string, unknown>))
  }

  public async createInspection(input: CreateInspectionInput): Promise<Inspection> {
    const id = uuidv4()
    const inspection: Inspection = {
      id,
      technicianId: input.technicianId,
      siteId: input.siteId,
      timestamp: new Date(),
      status: 'in_progress',
      images: [],
      safetyFlags: [],
      detectedFaults: [],
      recommendedActions: [],
      ocrFindings: [],
      workflowEvents: [],
      transcript: '',
    }

    await this.db.collection('inspections').doc(id).set(this.serializeDates(inspection))
    return inspection
  }

  public async getInspectionById(id: string): Promise<Inspection | null> {
    const snapshot = await this.db.collection('inspections').doc(id).get()
    if (!snapshot.exists) {
      return null
    }
    return this.deserializeInspection(snapshot.data() as Record<string, unknown>)
  }

  public async listInspections(filters: ListInspectionFilters): Promise<Inspection[]> {
    let query: FirebaseFirestore.Query = this.db.collection('inspections')

    if (filters.technicianId) {
      query = query.where('technicianId', '==', filters.technicianId)
    }
    if (filters.siteId) {
      query = query.where('siteId', '==', filters.siteId)
    }
    if (filters.status) {
      query = query.where('status', '==', filters.status)
    }

    const snapshot = await query.orderBy('timestamp', 'desc').limit(50).get()
    return snapshot.docs.map((doc) => this.deserializeInspection(doc.data() as Record<string, unknown>))
  }

  public async updateInspectionStatus(
    inspectionId: string,
    input: UpdateInspectionStatusInput,
  ): Promise<Inspection | null> {
    const ref = this.db.collection('inspections').doc(inspectionId)
    const current = await ref.get()
    if (!current.exists) {
      return null
    }

    const patch: Record<string, unknown> = {
      status: input.status,
    }
    if (input.summary) {
      patch.summary = input.summary
    }

    await ref.set(patch, { merge: true })
    const updated = await ref.get()
    return this.deserializeInspection(updated.data() as Record<string, unknown>)
  }

  public async appendInspectionSafetyFlags(inspectionId: string, flags: SafetyFlag[]): Promise<void> {
    if (flags.length === 0) {
      return
    }

    const ref = this.db.collection('inspections').doc(inspectionId)
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Error('Inspection not found')
      }

      const data = snap.data() as Record<string, unknown>
      const safetyFlags = Array.isArray(data.safetyFlags)
        ? (data.safetyFlags as Record<string, unknown>[])
        : []
      const nextFlags = flags.map((flag) =>
        this.serializeDates({
          type: flag.type,
          severity: flag.severity,
          description: flag.description,
          timestamp: flag.timestamp,
        }) as unknown as Record<string, unknown>,
      )
      safetyFlags.push(...nextFlags)
      tx.set(ref, { safetyFlags }, { merge: true })
    })
  }

  public async appendInspectionDetectedFaults(
    inspectionId: string,
    faults: DetectedFault[],
  ): Promise<void> {
    if (faults.length === 0) {
      return
    }

    const ref = this.db.collection('inspections').doc(inspectionId)
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Error('Inspection not found')
      }

      const data = snap.data() as Record<string, unknown>
      const detectedFaults = Array.isArray(data.detectedFaults)
        ? (data.detectedFaults as Record<string, unknown>[])
        : []
      const nextFaults = faults.map((fault) => ({
        component: fault.component,
        faultType: fault.faultType,
        confidence: fault.confidence,
        description: fault.description,
        recommendedActions: Array.isArray(fault.recommendedActions)
          ? fault.recommendedActions
          : [],
      }))
      detectedFaults.push(...nextFaults)
      tx.set(ref, { detectedFaults }, { merge: true })
    })
  }

  public async appendInspectionTranscript(inspectionId: string, entry: string): Promise<void> {
    const trimmed = entry.trim()
    if (!trimmed) {
      return
    }

    const ref = this.db.collection('inspections').doc(inspectionId)
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Error('Inspection not found')
      }

      const data = snap.data() as Record<string, unknown>
      const currentTranscript = typeof data.transcript === 'string' ? data.transcript : ''
      const transcript = currentTranscript ? `${currentTranscript}\n${trimmed}` : trimmed
      tx.set(ref, { transcript }, { merge: true })
    })
  }

  public async appendInspectionImage(inspectionId: string, imageUrl: string): Promise<void> {
    const ref = this.db.collection('inspections').doc(inspectionId)
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Error('Inspection not found')
      }

      const data = snap.data() as Record<string, unknown>
      const images = Array.isArray(data.images) ? data.images.filter((v) => typeof v === 'string') : []
      images.push(imageUrl)
      tx.set(ref, { images }, { merge: true })
    })
  }

  public async appendInspectionOcrFinding(inspectionId: string, finding: Omit<OcrFinding, 'createdAt'>): Promise<void> {
    const ref = this.db.collection('inspections').doc(inspectionId)
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Error('Inspection not found')
      }

      const data = snap.data() as Record<string, unknown>
      const ocrFindings = Array.isArray(data.ocrFindings)
        ? (data.ocrFindings as Record<string, unknown>[])
        : []

      ocrFindings.push(this.serializeDates({ ...finding, createdAt: new Date() }) as Record<string, unknown>)
      tx.set(ref, { ocrFindings }, { merge: true })
    })
  }

  public async appendInspectionWorkflowEvent(
    inspectionId: string,
    event: Omit<WorkflowEvent, 'id' | 'createdAt'>,
  ): Promise<WorkflowEvent> {
    const ref = this.db.collection('inspections').doc(inspectionId)
    const nextEvent: WorkflowEvent = {
      id: uuidv4(),
      ...event,
      createdAt: new Date(),
    }

    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Error('Inspection not found')
      }

      const data = snap.data() as Record<string, unknown>
      const workflowEvents = Array.isArray(data.workflowEvents)
        ? (data.workflowEvents as Record<string, unknown>[])
        : []

      workflowEvents.push(this.serializeDates(nextEvent) as unknown as Record<string, unknown>)
      tx.set(ref, { workflowEvents }, { merge: true })
    })

    return nextEvent
  }

  public async generateInspectionReport(inspectionId: string): Promise<InspectionReport | null> {
    const inspection = await this.getInspectionById(inspectionId)
    if (!inspection) {
      return null
    }

    const findings = inspection.detectedFaults.map((fault) =>
      `${fault.component}: ${fault.faultType} (${Math.round(fault.confidence * 100)}% confidence)`,
    )

    const safetySummary = inspection.safetyFlags.map(
      (flag) => `${flag.severity.toUpperCase()} - ${flag.description}`,
    )

    const workflowSummary = inspection.workflowEvents.map((event) => {
      const status = event.status.toUpperCase()
      const reference = event.externalReferenceId ? ` (${event.externalReferenceId})` : ''
      return `${status} - ${event.action}: ${event.resultMessage}${reference}`
    })

    const report: InspectionReport = {
      inspectionId: inspection.id,
      generatedAt: new Date(),
      technicianId: inspection.technicianId,
      siteId: inspection.siteId,
      status: inspection.status,
      findings,
      safetySummary,
      workflowSummary,
      recommendedActions: inspection.recommendedActions,
      imageCount: inspection.images.length,
      summaryText:
        inspection.summary ||
        `Inspection ${inspection.id} has ${findings.length} findings, ${safetySummary.length} safety flags, and ${inspection.images.length} captured images.`,
    }

    await this.db
      .collection('inspectionReports')
      .doc(inspectionId)
      .set(this.serializeDates(report), { merge: true })

    return report
  }

  public async getInspectionReport(inspectionId: string): Promise<InspectionReport | null> {
    const snapshot = await this.db.collection('inspectionReports').doc(inspectionId).get()
    if (!snapshot.exists) {
      return null
    }

    const data = snapshot.data() as Record<string, unknown>
    return {
      inspectionId: String(data.inspectionId),
      generatedAt: this.deserializeDate(data.generatedAt),
      technicianId: String(data.technicianId),
      siteId: String(data.siteId),
      status: data.status === 'completed' ? 'completed' : 'in_progress',
      findings: Array.isArray(data.findings)
        ? data.findings.filter((v): v is string => typeof v === 'string')
        : [],
      safetySummary: Array.isArray(data.safetySummary)
        ? data.safetySummary.filter((v): v is string => typeof v === 'string')
        : [],
      workflowSummary: Array.isArray(data.workflowSummary)
        ? data.workflowSummary.filter((v): v is string => typeof v === 'string')
        : [],
      recommendedActions: Array.isArray(data.recommendedActions)
        ? data.recommendedActions.filter((v): v is string => typeof v === 'string')
        : [],
      imageCount: Number(data.imageCount ?? 0),
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : '',
    }
  }

  private serializeDates<T>(value: T): T {
    if (value instanceof Date) {
      return Timestamp.fromDate(value) as T
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.serializeDates(v)) as T
    }

    if (value && typeof value === 'object') {
      const output: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        output[key] = this.serializeDates(val)
      }
      return output as T
    }

    return value
  }

  private deserializeInspection(data: Record<string, unknown>): Inspection {
    return {
      id: String(data.id),
      technicianId: String(data.technicianId),
      siteId: String(data.siteId),
      timestamp: this.deserializeDate(data.timestamp),
      status: data.status === 'completed' ? 'completed' : 'in_progress',
      images: Array.isArray(data.images) ? data.images.filter((v): v is string => typeof v === 'string') : [],
      safetyFlags: Array.isArray(data.safetyFlags)
        ? data.safetyFlags.map((item) => {
            const entry = item as Record<string, unknown>
            return {
              type:
                entry.type === 'missing_ppe' ||
                entry.type === 'dangerous_proximity' ||
                entry.type === 'leak' ||
                entry.type === 'spark' ||
                entry.type === 'exposed_wire' ||
                entry.type === 'slippery_surface' ||
                entry.type === 'open_flame'
                  ? entry.type
                  : 'missing_ppe',
              severity:
                entry.severity === 'critical' ||
                entry.severity === 'high' ||
                entry.severity === 'medium' ||
                entry.severity === 'low'
                  ? entry.severity
                  : 'low',
              description: typeof entry.description === 'string' ? entry.description : '',
              timestamp: this.deserializeDate(entry.timestamp),
            }
          })
        : [],
      detectedFaults: Array.isArray(data.detectedFaults)
        ? data.detectedFaults.map((item) => {
            const entry = item as Record<string, unknown>
            return {
              component: typeof entry.component === 'string' ? entry.component : 'unknown',
              faultType: typeof entry.faultType === 'string' ? entry.faultType : 'unknown',
              confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
              description: typeof entry.description === 'string' ? entry.description : '',
              recommendedActions: Array.isArray(entry.recommendedActions)
                ? entry.recommendedActions.filter((v): v is string => typeof v === 'string')
                : [],
            }
          })
        : [],
      recommendedActions: Array.isArray(data.recommendedActions)
        ? data.recommendedActions.filter((v): v is string => typeof v === 'string')
        : [],
      ocrFindings: Array.isArray(data.ocrFindings)
        ? data.ocrFindings.map((item) => {
            const entry = item as Record<string, unknown>
            return {
              imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : '',
              extractedText: typeof entry.extractedText === 'string' ? entry.extractedText : '',
              serialNumbers: Array.isArray(entry.serialNumbers)
                ? entry.serialNumbers.filter((v): v is string => typeof v === 'string')
                : [],
              partCodes: Array.isArray(entry.partCodes)
                ? entry.partCodes.filter((v): v is string => typeof v === 'string')
                : [],
              meterReadings: Array.isArray(entry.meterReadings)
                ? entry.meterReadings.filter((v): v is string => typeof v === 'string')
                : [],
              warningLabels: Array.isArray(entry.warningLabels)
                ? entry.warningLabels.filter((v): v is string => typeof v === 'string')
                : [],
              confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
              createdAt: this.deserializeDate(entry.createdAt),
            }
          })
        : [],
      workflowEvents: Array.isArray(data.workflowEvents)
        ? data.workflowEvents.map((item) => {
            const entry = item as Record<string, unknown>
            return {
              id: typeof entry.id === 'string' ? entry.id : uuidv4(),
              action:
                entry.action === 'create_ticket' ||
                entry.action === 'notify_supervisor' ||
                entry.action === 'add_to_history' ||
                entry.action === 'log_issue'
                  ? entry.action
                  : 'log_issue',
              note: typeof entry.note === 'string' ? entry.note : undefined,
              metadata:
                entry.metadata && typeof entry.metadata === 'object'
                  ? (entry.metadata as Record<string, unknown>)
                  : undefined,
              status: entry.status === 'failed' ? 'failed' : 'completed',
              resultMessage: typeof entry.resultMessage === 'string' ? entry.resultMessage : '',
              externalReferenceId:
                typeof entry.externalReferenceId === 'string' ? entry.externalReferenceId : undefined,
              createdAt: this.deserializeDate(entry.createdAt),
            }
          })
        : [],
      transcript: typeof data.transcript === 'string' ? data.transcript : '',
      summary: typeof data.summary === 'string' ? data.summary : undefined,
    }
  }

  public async createSiteAsset(
    input: Omit<SiteAsset, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SiteAsset> {
    const id = uuidv4()
    const now = new Date()
    const ref = this.db.collection('site_assets').doc(id)
    await ref.set({
      id,
      ...input,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    })
    return { id, ...input, createdAt: now, updatedAt: now }
  }

  public async listSiteAssets(siteId: string): Promise<SiteAsset[]> {
    const snapshot = await this.db
      .collection('site_assets')
      .where('siteId', '==', siteId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        siteId: String(data.siteId ?? ''),
        name: String(data.name ?? ''),
        assetType: String(data.assetType ?? ''),
        serialNumber: data.serialNumber ? String(data.serialNumber) : undefined,
        location: data.location ? String(data.location) : undefined,
        notes: data.notes ? String(data.notes) : undefined,
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
      }
    })
  }

  public async deleteSiteAsset(assetId: string): Promise<void> {
    await this.db.collection('site_assets').doc(assetId).delete()
  }

  private deserializeTechnician(data: Record<string, unknown>): Technician {
    return {
      id: String(data.id),
      name: typeof data.name === 'string' ? data.name : '',
      email: typeof data.email === 'string' ? data.email : '',
      role:
        data.role === 'admin' || data.role === 'viewer' || data.role === 'technician'
          ? data.role
          : 'technician',
      createdAt: this.deserializeDate(data.createdAt),
      updatedAt: this.deserializeDate(data.updatedAt),
    }
  }

  private deserializeSite(data: Record<string, unknown>): Site {
    const location = (data.location as Record<string, unknown> | undefined) ?? {}
    return {
      id: String(data.id),
      name: typeof data.name === 'string' ? data.name : '',
      type:
        data.type === 'oil_gas' ||
        data.type === 'power' ||
        data.type === 'telecom' ||
        data.type === 'manufacturing' ||
        data.type === 'solar'
          ? data.type
          : 'power',
      location: {
        latitude: Number(location.latitude ?? 0),
        longitude: Number(location.longitude ?? 0),
        address: typeof location.address === 'string' ? location.address : undefined,
      },
      technicianIds: Array.isArray(data.technicianIds)
        ? data.technicianIds.filter((v): v is string => typeof v === 'string')
        : [],
      createdAt: this.deserializeDate(data.createdAt),
      updatedAt: this.deserializeDate(data.updatedAt),
    }
  }

  private deserializeDate(value: unknown): Date {
    if (value instanceof Timestamp) {
      return value.toDate()
    }
    if (value instanceof Date) {
      return value
    }
    return new Date()
  }
}
