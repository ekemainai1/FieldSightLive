export interface ShareSession {
  id: string
  inspectionId: string
  hostTechnicianId: string
  expertEmail: string
  status: 'pending' | 'active' | 'completed' | 'expired'
  createdAt: string
  expiresAt: string
  sessionUrl?: string
  reason?: string
}

export class TeamCollaborationService {
  private readonly webhookUrl: string | undefined
  private activeSessions: Map<string, ShareSession> = new Map()

  constructor() {
    this.webhookUrl = process.env.COLLAB_SESSION_WEBHOOK?.trim()
  }

  public async createSession(
    inspectionId: string,
    hostTechnicianId: string,
    expertEmail: string,
    durationMinutes: number = 30,
    reason?: string
  ): Promise<ShareSession> {
    const sessionId = `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000)

    const session: ShareSession = {
      id: sessionId,
      inspectionId,
      hostTechnicianId,
      expertEmail,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sessionUrl: `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/share/${sessionId}`,
      reason,
    }

    this.activeSessions.set(sessionId, session)

    await this.notifyExpert(session)

    return session
  }

  public async activateSession(sessionId: string): Promise<ShareSession | null> {
    const session = this.activeSessions.get(sessionId)
    if (!session) return null

    session.status = 'active'
    this.activeSessions.set(sessionId, session)

    return session
  }

  public async endSession(sessionId: string): Promise<ShareSession | null> {
    const session = this.activeSessions.get(sessionId)
    if (!session) return null

    session.status = 'completed'
    this.activeSessions.set(sessionId, session)

    return session
  }

  public getSession(sessionId: string): ShareSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  public getActiveSessions(technicianId?: string): ShareSession[] {
    const sessions = Array.from(this.activeSessions.values())
    
    if (technicianId) {
      return sessions.filter(
        (s) => s.hostTechnicianId === technicianId && s.status === 'active'
      )
    }

    return sessions.filter((s) => s.status === 'active')
  }

  public isSessionExpired(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId)
    if (!session) return true

    return new Date(session.expiresAt) < new Date()
  }

  private async notifyExpert(session: ShareSession): Promise<void> {
    if (!this.webhookUrl) return

    const payload = {
      event: 'session_invite',
      sessionId: session.id,
      inspectionId: session.inspectionId,
      expertEmail: session.expertEmail,
      hostTechnicianId: session.hostTechnicianId,
      sessionUrl: session.sessionUrl,
      reason: session.reason,
      expiresAt: session.expiresAt,
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeout)
    } catch {
      // Silently fail
    }
  }
}
