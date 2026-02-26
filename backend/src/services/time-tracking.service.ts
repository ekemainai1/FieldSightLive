import type { DataService } from './data-service'

export interface TimeEntry {
  id: string
  inspectionId: string
  taskName: string
  startTime: string
  endTime?: string
  duration?: number
  notes?: string
  status: 'running' | 'paused' | 'completed'
}

export interface TimeTrackingSummary {
  inspectionId: string
  totalDuration: number
  tasks: TimeEntry[]
}

export class TimeTrackingService {
  private readonly dataService: DataService
  private activeSessions: Map<string, TimeEntry> = new Map()
  private completedEntries: Map<string, TimeEntry[]> = new Map()

  constructor(dataService: DataService) {
    this.dataService = dataService
  }

  public async startTask(inspectionId: string, taskName: string, notes?: string): Promise<TimeEntry> {
    if (this.activeSessions.has(inspectionId)) {
      throw new Error(`Task already running for inspection ${inspectionId}`)
    }

    const entry: TimeEntry = {
      id: `time_${Date.now()}`,
      inspectionId,
      taskName,
      startTime: new Date().toISOString(),
      notes,
      status: 'running',
    }

    this.activeSessions.set(inspectionId, entry)

    return entry
  }

  public async pauseTask(inspectionId: string): Promise<TimeEntry | null> {
    const entry = this.activeSessions.get(inspectionId)
    if (!entry) return null

    entry.status = 'paused'
    entry.endTime = new Date().toISOString()
    entry.duration = Math.floor(
      (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000
    )

    const entries = this.completedEntries.get(inspectionId) || []
    entries.push(entry)
    this.completedEntries.set(inspectionId, entries)
    
    this.activeSessions.delete(inspectionId)

    return entry
  }

  public async completeTask(inspectionId: string): Promise<TimeEntry | null> {
    let entry = this.activeSessions.get(inspectionId)

    if (!entry) {
      const entries = this.completedEntries.get(inspectionId) || []
      entry = entries.find((e) => e.status === 'running')
    }

    if (!entry) return null

    entry.status = 'completed'
    entry.endTime = new Date().toISOString()
    entry.duration = Math.floor(
      (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000
    )

    const entries = this.completedEntries.get(inspectionId) || []
    const existingIndex = entries.findIndex((e) => e.id === entry!.id)
    if (existingIndex >= 0) {
      entries[existingIndex] = entry
    } else {
      entries.push(entry)
    }
    this.completedEntries.set(inspectionId, entries)
    
    this.activeSessions.delete(inspectionId)

    return entry
  }

  public getActiveTask(inspectionId: string): TimeEntry | undefined {
    return this.activeSessions.get(inspectionId)
  }

  public async logTime(
    inspectionId: string,
    taskName: string,
    duration: number,
    notes?: string
  ): Promise<TimeEntry> {
    const entry: TimeEntry = {
      id: `time_${Date.now()}`,
      inspectionId,
      taskName,
      duration,
      startTime: new Date(Date.now() - duration * 60000).toISOString(),
      endTime: new Date().toISOString(),
      notes,
      status: 'completed',
    }

    const entries = this.completedEntries.get(inspectionId) || []
    entries.push(entry)
    this.completedEntries.set(inspectionId, entries)

    return entry
  }

  public async getSummary(inspectionId: string): Promise<TimeTrackingSummary> {
    const activeEntry = this.activeSessions.get(inspectionId)
    const completedEntries = this.completedEntries.get(inspectionId) || []
    
    const entries = activeEntry ? [activeEntry, ...completedEntries] : completedEntries

    const totalDuration = entries.reduce((sum, entry) => sum + (entry.duration || 0), 0)

    return {
      inspectionId,
      totalDuration,
      tasks: entries,
    }
  }

  public formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`
    }

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours < 24) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }

    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24

    return `${days}d ${remainingHours}h`
  }
}
