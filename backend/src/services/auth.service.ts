import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'

export interface AuthUser {
  uid: string
  email?: string
  roles: string[]
}

export class AuthService {
  private readonly authRequired: boolean

  constructor() {
    this.authRequired = String(process.env.AUTH_REQUIRED || 'false').toLowerCase() === 'true'

    if (this.authRequired && getApps().length === 0) {
      initializeApp({
        credential: applicationDefault(),
      })
    }
  }

  public isAuthRequired(): boolean {
    return this.authRequired
  }

  public async authenticateBearerHeader(headerValue?: string): Promise<AuthUser | null> {
    if (!this.authRequired) {
      return null
    }

    const token = this.extractBearerToken(headerValue)
    if (!token) {
      throw new Error('Missing bearer token')
    }

    const decoded = await getAuth().verifyIdToken(token, true)
    return this.mapToken(decoded)
  }

  public async authenticateToken(token?: string): Promise<AuthUser | null> {
    if (!this.authRequired) {
      return null
    }

    if (!token) {
      throw new Error('Missing auth token')
    }

    const decoded = await getAuth().verifyIdToken(token, true)
    return this.mapToken(decoded)
  }

  private extractBearerToken(headerValue?: string): string | null {
    if (!headerValue) {
      return null
    }

    const [scheme, token] = headerValue.split(' ')
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
      return null
    }
    return token
  }

  private mapToken(decoded: DecodedIdToken): AuthUser {
    const roles = Array.isArray(decoded.roles)
      ? decoded.roles.filter((role): role is string => typeof role === 'string')
      : []

    return {
      uid: decoded.uid,
      email: decoded.email,
      roles,
    }
  }
}
