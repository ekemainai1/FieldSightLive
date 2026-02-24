import { inspectionService, type InspectionReport } from './inspection-service'

const OFFLINE_QUEUE_STORAGE_KEY = 'fieldsightlive.offline.queue.v1'
const OFFLINE_INSPECTION_MAP_KEY = 'fieldsightlive.offline.inspection-map.v1'
const MAX_OPERATION_ATTEMPTS = 5

interface BaseOfflineOperation {
  id: string
  createdAt: number
  attempts: number
  lastError?: string
}

interface CreateInspectionOperation extends BaseOfflineOperation {
  type: 'create_inspection'
  localInspectionId: string
  technicianId: string
  siteId: string
}

interface UploadSnapshotOperation extends BaseOfflineOperation {
  type: 'upload_snapshot'
  inspectionId: string
  frameDataUrl: string
}

interface CompleteInspectionOperation extends BaseOfflineOperation {
  type: 'complete_inspection'
  inspectionId: string
  summary?: string
}

type OfflineOperation =
  | CreateInspectionOperation
  | UploadSnapshotOperation
  | CompleteInspectionOperation

interface InspectionIdMap {
  [localInspectionId: string]: string
}

interface SyncCallbacks {
  onInspectionIdMapped?: (localInspectionId: string, remoteInspectionId: string) => void
  onReportGenerated?: (report: InspectionReport) => void
}

export interface SyncResult {
  processed: number
  remaining: number
  failed: number
}

export class OfflineSyncQueueService {
  private isFlushing = false

  public createOfflineInspectionId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  public getPendingCount(): number {
    return this.readQueue().length
  }

  public enqueueCreateInspection(
    localInspectionId: string,
    input: { technicianId: string; siteId: string },
  ): string {
    const operation: CreateInspectionOperation = {
      id: this.createOperationId('create_inspection'),
      type: 'create_inspection',
      localInspectionId,
      technicianId: input.technicianId,
      siteId: input.siteId,
      createdAt: Date.now(),
      attempts: 0,
    }
    this.enqueue(operation)
    return operation.id
  }

  public enqueueSnapshotUpload(inspectionId: string, frameDataUrl: string): string {
    const operation: UploadSnapshotOperation = {
      id: this.createOperationId('upload_snapshot'),
      type: 'upload_snapshot',
      inspectionId,
      frameDataUrl,
      createdAt: Date.now(),
      attempts: 0,
    }
    this.enqueue(operation)
    return operation.id
  }

  public enqueueCompleteInspection(inspectionId: string, summary?: string): string {
    const operation: CompleteInspectionOperation = {
      id: this.createOperationId('complete_inspection'),
      type: 'complete_inspection',
      inspectionId,
      summary,
      createdAt: Date.now(),
      attempts: 0,
    }
    this.enqueue(operation)
    return operation.id
  }

  public async flush(callbacks: SyncCallbacks = {}): Promise<SyncResult> {
    if (this.isFlushing) {
      return {
        processed: 0,
        remaining: this.getPendingCount(),
        failed: 0,
      }
    }

    if (this.isOffline()) {
      return {
        processed: 0,
        remaining: this.getPendingCount(),
        failed: 0,
      }
    }

    this.isFlushing = true
    let processed = 0
    let failed = 0

    try {
      const queue = this.readQueue()
      const inspectionIdMap = this.readInspectionIdMap()

      while (queue.length > 0) {
        const current = queue[0]
        try {
          await this.executeOperation(current, inspectionIdMap, callbacks)
          queue.shift()
          this.writeQueue(queue)
          this.writeInspectionIdMap(inspectionIdMap)
          processed += 1
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Offline sync failed'
          const updated = {
            ...current,
            attempts: current.attempts + 1,
            lastError: message,
          } as OfflineOperation

          queue[0] = updated
          this.writeQueue(queue)

          if (!this.isRetriableError(error) && updated.attempts >= MAX_OPERATION_ATTEMPTS) {
            queue.shift()
            this.writeQueue(queue)
            failed += 1
            continue
          }

          break
        }
      }

      return {
        processed,
        remaining: queue.length,
        failed,
      }
    } finally {
      this.isFlushing = false
    }
  }

  private async executeOperation(
    operation: OfflineOperation,
    inspectionIdMap: InspectionIdMap,
    callbacks: SyncCallbacks,
  ): Promise<void> {
    switch (operation.type) {
      case 'create_inspection': {
        if (inspectionIdMap[operation.localInspectionId]) {
          return
        }
        const inspection = await inspectionService.createInspection({
          technicianId: operation.technicianId,
          siteId: operation.siteId,
        })
        inspectionIdMap[operation.localInspectionId] = inspection.id
        callbacks.onInspectionIdMapped?.(operation.localInspectionId, inspection.id)
        return
      }

      case 'upload_snapshot': {
        const inspectionId = this.resolveInspectionId(operation.inspectionId, inspectionIdMap)
        await inspectionService.uploadSnapshot(inspectionId, operation.frameDataUrl)
        return
      }

      case 'complete_inspection': {
        const inspectionId = this.resolveInspectionId(operation.inspectionId, inspectionIdMap)
        await inspectionService.completeInspection(inspectionId, { summary: operation.summary })
        const report = await inspectionService.generateReport(inspectionId)
        callbacks.onReportGenerated?.(report)
        return
      }
    }
  }

  private resolveInspectionId(inspectionId: string, inspectionIdMap: InspectionIdMap): string {
    if (!inspectionId.startsWith('offline_')) {
      return inspectionId
    }

    const mapped = inspectionIdMap[inspectionId]
    if (!mapped) {
      throw new Error(`Inspection is not synced yet: ${inspectionId}`)
    }
    return mapped
  }

  private enqueue(operation: OfflineOperation): void {
    const queue = this.readQueue()
    queue.push(operation)
    this.writeQueue(queue)
  }

  private createOperationId(type: OfflineOperation['type']): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  private readQueue(): OfflineOperation[] {
    if (!this.hasStorage()) {
      return []
    }

    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY)
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter((value) => this.isOfflineOperation(value)) as OfflineOperation[]
    } catch {
      return []
    }
  }

  private writeQueue(queue: OfflineOperation[]): void {
    if (!this.hasStorage()) {
      return
    }

    try {
      window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue))
    } catch {
      throw new Error('Offline queue storage is full or unavailable')
    }
  }

  private readInspectionIdMap(): InspectionIdMap {
    if (!this.hasStorage()) {
      return {}
    }

    const raw = window.localStorage.getItem(OFFLINE_INSPECTION_MAP_KEY)
    if (!raw) {
      return {}
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
      }
      return parsed as InspectionIdMap
    } catch {
      return {}
    }
  }

  private writeInspectionIdMap(map: InspectionIdMap): void {
    if (!this.hasStorage()) {
      return
    }
    window.localStorage.setItem(OFFLINE_INSPECTION_MAP_KEY, JSON.stringify(map))
  }

  private hasStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  }

  private isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false
  }

  private isRetriableError(error: unknown): boolean {
    if (this.isOffline()) {
      return true
    }

    if (!(error instanceof Error)) {
      return false
    }

    const message = error.message.toLowerCase()
    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('inspection is not synced yet')
    )
  }

  private isOfflineOperation(value: unknown): value is OfflineOperation {
    if (!value || typeof value !== 'object') {
      return false
    }

    const operation = value as Partial<OfflineOperation>
    if (
      typeof operation.id !== 'string' ||
      typeof operation.type !== 'string' ||
      typeof operation.createdAt !== 'number' ||
      typeof operation.attempts !== 'number'
    ) {
      return false
    }

    if (operation.type === 'create_inspection') {
      const op = value as Partial<CreateInspectionOperation>
      return (
        typeof op.localInspectionId === 'string' &&
        typeof op.technicianId === 'string' &&
        typeof op.siteId === 'string'
      )
    }

    if (operation.type === 'upload_snapshot') {
      const op = value as Partial<UploadSnapshotOperation>
      return typeof op.inspectionId === 'string' && typeof op.frameDataUrl === 'string'
    }

    if (operation.type === 'complete_inspection') {
      const op = value as Partial<CompleteInspectionOperation>
      return (
        typeof op.inspectionId === 'string' &&
        (typeof op.summary === 'undefined' || typeof op.summary === 'string')
      )
    }

    return false
  }
}

export const offlineSyncQueueService = new OfflineSyncQueueService()
