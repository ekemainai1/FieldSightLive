import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import type { DataService } from './data-service'
import type { InspectionReport } from './firestore-data.service'
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

interface PgInspectionRow {
  id: string
  technician_id: string
  site_id: string
  timestamp: Date
  status: 'in_progress' | 'completed'
  images: string[]
  safety_flags: Array<Omit<SafetyFlag, 'timestamp'> & { timestamp: string | Date }>
  detected_faults: DetectedFault[]
  recommended_actions: string[]
  ocr_findings: Array<Omit<OcrFinding, 'createdAt'> & { createdAt: string | Date }>
  workflow_events: Array<Omit<WorkflowEvent, 'createdAt'> & { createdAt: string | Date }>
  transcript: string
  summary: string | null
}

export class PostgresDataService implements DataService {
  private readonly pool: Pool
  private readonly initPromise: Promise<void>

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.POSTGRES_URL?.trim() || undefined,
    })
    this.initPromise = this.initializeSchema()
  }

  public async createTechnician(
    input: Omit<Technician, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Technician> {
    await this.initPromise
    const id = uuidv4()
    const now = new Date()

    await this.pool.query(
      `INSERT INTO technicians (id, name, email, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.name, input.email, input.role, now, now],
    )

    return {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    }
  }

  public async listTechnicians(): Promise<Technician[]> {
    await this.initPromise
    const result = await this.pool.query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM technicians
       ORDER BY created_at DESC
       LIMIT 100`,
    )

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }

  public async createSite(input: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<Site> {
    await this.initPromise
    const id = uuidv4()
    const now = new Date()

    await this.pool.query(
      `INSERT INTO sites (id, name, type, location, technician_ids, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [
        id,
        input.name,
        input.type,
        JSON.stringify(input.location),
        input.technicianIds,
        now,
        now,
      ],
    )

    return {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    }
  }

  public async listSites(): Promise<Site[]> {
    await this.initPromise
    const result = await this.pool.query(
      `SELECT id, name, type, location, technician_ids, created_at, updated_at
       FROM sites
       ORDER BY created_at DESC
       LIMIT 100`,
    )

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      location: row.location,
      technicianIds: row.technician_ids || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }

  public async createInspection(input: { technicianId: string; siteId: string }): Promise<Inspection> {
    await this.initPromise
    const id = uuidv4()
    const now = new Date()

    await this.pool.query(
      `INSERT INTO inspections (
         id, technician_id, site_id, timestamp, status, images, safety_flags, detected_faults,
         recommended_actions, ocr_findings, workflow_events, transcript, summary
       ) VALUES (
         $1, $2, $3, $4, 'in_progress', $5, $6::jsonb, $7::jsonb,
         $8, $9::jsonb, $10::jsonb, $11, NULL
       )`,
      [
        id,
        input.technicianId,
        input.siteId,
        now,
        [],
        JSON.stringify([]),
        JSON.stringify([]),
        [],
        JSON.stringify([]),
        JSON.stringify([]),
        '',
      ],
    )

    return {
      id,
      technicianId: input.technicianId,
      siteId: input.siteId,
      timestamp: now,
      status: 'in_progress',
      images: [],
      safetyFlags: [],
      detectedFaults: [],
      recommendedActions: [],
      ocrFindings: [],
      workflowEvents: [],
      transcript: '',
    }
  }

  public async getInspectionById(id: string): Promise<Inspection | null> {
    await this.initPromise
    const result = await this.pool.query(
      `SELECT * FROM inspections WHERE id = $1 LIMIT 1`,
      [id],
    )

    if (result.rowCount === 0) {
      return null
    }

    return this.mapInspectionRow(result.rows[0] as PgInspectionRow)
  }

  public async listInspections(filters: {
    technicianId?: string
    siteId?: string
    status?: 'in_progress' | 'completed'
  }): Promise<Inspection[]> {
    await this.initPromise
    const conditions: string[] = []
    const values: Array<string> = []

    if (filters.technicianId) {
      values.push(filters.technicianId)
      conditions.push(`technician_id = $${values.length}`)
    }
    if (filters.siteId) {
      values.push(filters.siteId)
      conditions.push(`site_id = $${values.length}`)
    }
    if (filters.status) {
      values.push(filters.status)
      conditions.push(`status = $${values.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await this.pool.query(
      `SELECT * FROM inspections ${whereClause} ORDER BY timestamp DESC LIMIT 50`,
      values,
    )

    return result.rows.map((row) => this.mapInspectionRow(row as PgInspectionRow))
  }

  public async updateInspectionStatus(
    inspectionId: string,
    input: { status: 'in_progress' | 'completed'; summary?: string },
  ): Promise<Inspection | null> {
    await this.initPromise
    const result = await this.pool.query(
      `UPDATE inspections
       SET status = $2,
           summary = COALESCE($3, summary)
       WHERE id = $1
       RETURNING *`,
      [inspectionId, input.status, input.summary || null],
    )

    if (result.rowCount === 0) {
      return null
    }

    return this.mapInspectionRow(result.rows[0] as PgInspectionRow)
  }

  public async appendInspectionSafetyFlags(inspectionId: string, flags: SafetyFlag[]): Promise<void> {
    if (flags.length === 0) {
      return
    }

    await this.initPromise
    const payload = flags.map((flag) => ({
      type: flag.type,
      severity: flag.severity,
      description: flag.description,
      timestamp: new Date(flag.timestamp).toISOString(),
    }))

    const result = await this.pool.query(
      `UPDATE inspections
       SET safety_flags = COALESCE(safety_flags, '[]'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [inspectionId, JSON.stringify(payload)],
    )

    if (result.rowCount === 0) {
      throw new Error('Inspection not found')
    }
  }

  public async appendInspectionDetectedFaults(
    inspectionId: string,
    faults: DetectedFault[],
  ): Promise<void> {
    if (faults.length === 0) {
      return
    }

    await this.initPromise
    const payload = faults.map((fault) => ({
      component: fault.component,
      faultType: fault.faultType,
      confidence: fault.confidence,
      description: fault.description,
      recommendedActions: Array.isArray(fault.recommendedActions) ? fault.recommendedActions : [],
    }))

    const result = await this.pool.query(
      `UPDATE inspections
       SET detected_faults = COALESCE(detected_faults, '[]'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [inspectionId, JSON.stringify(payload)],
    )

    if (result.rowCount === 0) {
      throw new Error('Inspection not found')
    }
  }

  public async appendInspectionTranscript(inspectionId: string, entry: string): Promise<void> {
    const trimmed = entry.trim()
    if (!trimmed) {
      return
    }

    await this.initPromise
    const result = await this.pool.query(
      `UPDATE inspections
       SET transcript = CASE
         WHEN COALESCE(transcript, '') = '' THEN $2
         ELSE transcript || E'\\n' || $2
       END
       WHERE id = $1`,
      [inspectionId, trimmed],
    )

    if (result.rowCount === 0) {
      throw new Error('Inspection not found')
    }
  }

  public async appendInspectionImage(inspectionId: string, imageUrl: string): Promise<void> {
    await this.initPromise
    const result = await this.pool.query(
      `UPDATE inspections
       SET images = array_append(COALESCE(images, ARRAY[]::text[]), $2)
       WHERE id = $1`,
      [inspectionId, imageUrl],
    )

    if (result.rowCount === 0) {
      throw new Error('Inspection not found')
    }
  }

  public async appendInspectionOcrFinding(
    inspectionId: string,
    finding: Omit<OcrFinding, 'createdAt'>,
  ): Promise<void> {
    await this.initPromise
    const withDate = {
      ...finding,
      createdAt: new Date().toISOString(),
    }

    const result = await this.pool.query(
      `UPDATE inspections
       SET ocr_findings = COALESCE(ocr_findings, '[]'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [inspectionId, JSON.stringify([withDate])],
    )

    if (result.rowCount === 0) {
      throw new Error('Inspection not found')
    }
  }

  public async appendInspectionWorkflowEvent(
    inspectionId: string,
    event: Omit<WorkflowEvent, 'id' | 'createdAt'>,
  ): Promise<WorkflowEvent> {
    await this.initPromise
    const nextEvent: WorkflowEvent = {
      id: uuidv4(),
      ...event,
      createdAt: new Date(),
    }

    const result = await this.pool.query(
      `UPDATE inspections
       SET workflow_events = COALESCE(workflow_events, '[]'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [inspectionId, JSON.stringify([{ ...nextEvent, createdAt: nextEvent.createdAt.toISOString() }])],
    )

    if (result.rowCount === 0) {
      throw new Error('Inspection not found')
    }

    return nextEvent
  }

  public async generateInspectionReport(inspectionId: string): Promise<InspectionReport | null> {
    await this.initPromise
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

    await this.pool.query(
      `INSERT INTO inspection_reports (
         inspection_id, generated_at, technician_id, site_id, status, findings,
         safety_summary, workflow_summary, recommended_actions, image_count, summary_text
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
       )
       ON CONFLICT (inspection_id)
       DO UPDATE SET
         generated_at = EXCLUDED.generated_at,
         technician_id = EXCLUDED.technician_id,
         site_id = EXCLUDED.site_id,
         status = EXCLUDED.status,
         findings = EXCLUDED.findings,
         safety_summary = EXCLUDED.safety_summary,
         workflow_summary = EXCLUDED.workflow_summary,
         recommended_actions = EXCLUDED.recommended_actions,
         image_count = EXCLUDED.image_count,
         summary_text = EXCLUDED.summary_text`,
      [
        report.inspectionId,
        report.generatedAt,
        report.technicianId,
        report.siteId,
        report.status,
        report.findings,
        report.safetySummary,
        report.workflowSummary,
        report.recommendedActions,
        report.imageCount,
        report.summaryText,
      ],
    )

    return report
  }

  public async getInspectionReport(inspectionId: string): Promise<InspectionReport | null> {
    await this.initPromise
    const result = await this.pool.query(
      `SELECT * FROM inspection_reports WHERE inspection_id = $1 LIMIT 1`,
      [inspectionId],
    )

    if (result.rowCount === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      inspectionId: row.inspection_id,
      generatedAt: new Date(row.generated_at),
      technicianId: row.technician_id,
      siteId: row.site_id,
      status: row.status,
      findings: row.findings || [],
      safetySummary: row.safety_summary || [],
      workflowSummary: row.workflow_summary || [],
      recommendedActions: row.recommended_actions || [],
      imageCount: Number(row.image_count || 0),
      summaryText: row.summary_text || '',
    }
  }

  public async createSiteAsset(
    input: Omit<SiteAsset, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SiteAsset> {
    await this.initPromise
    const id = uuidv4()
    const now = new Date()

    await this.pool.query(
      `INSERT INTO site_assets (id, site_id, name, asset_type, serial_number, location, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, input.siteId, input.name, input.assetType, input.serialNumber || null, input.location || null, input.notes || null, now, now],
    )

    return {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    }
  }

  public async listSiteAssets(siteId: string): Promise<SiteAsset[]> {
    await this.initPromise
    const result = await this.pool.query(
      `SELECT id, site_id, name, asset_type, serial_number, location, notes, created_at, updated_at
       FROM site_assets
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [siteId],
    )

    return result.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      assetType: row.asset_type,
      serialNumber: row.serial_number || undefined,
      location: row.location || undefined,
      notes: row.notes || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }

  public async deleteSiteAsset(assetId: string): Promise<void> {
    await this.initPromise
    await this.pool.query(`DELETE FROM site_assets WHERE id = $1`, [assetId])
  }

  private mapInspectionRow(row: PgInspectionRow): Inspection {
    return {
      id: row.id,
      technicianId: row.technician_id,
      siteId: row.site_id,
      timestamp: new Date(row.timestamp),
      status: row.status,
      images: row.images || [],
      safetyFlags: (row.safety_flags || []).map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      })),
      detectedFaults: (row.detected_faults || []).map((item) => ({
        ...item,
        recommendedActions: Array.isArray(item.recommendedActions)
          ? item.recommendedActions
          : [],
      })),
      recommendedActions: row.recommended_actions || [],
      ocrFindings: (row.ocr_findings || []).map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      })),
      workflowEvents: (row.workflow_events || []).map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      })),
      transcript: row.transcript || '',
      summary: row.summary || undefined,
    }
  }

  private async initializeSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS technicians (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        location JSONB NOT NULL,
        technician_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id TEXT PRIMARY KEY,
        technician_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        detected_faults JSONB NOT NULL DEFAULT '[]'::jsonb,
        recommended_actions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        ocr_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
        workflow_events JSONB NOT NULL DEFAULT '[]'::jsonb,
        transcript TEXT NOT NULL DEFAULT '',
        summary TEXT
      );
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_reports (
        inspection_id TEXT PRIMARY KEY,
        generated_at TIMESTAMPTZ NOT NULL,
        technician_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        status TEXT NOT NULL,
        findings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        safety_summary TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        workflow_summary TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        recommended_actions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        image_count INTEGER NOT NULL DEFAULT 0,
        summary_text TEXT NOT NULL DEFAULT ''
      );
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS site_assets (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        name TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        serial_number TEXT,
        location TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_site_assets_site_id ON site_assets(site_id);
    `)
  }
}
