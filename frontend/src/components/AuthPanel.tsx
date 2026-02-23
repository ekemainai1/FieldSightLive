'use client'

import { useState } from 'react'

interface AuthPanelProps {
  available: boolean
  loading: boolean
  userEmail: string | null
  error: string | null
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function AuthPanel({
  available,
  loading,
  userEmail,
  error,
  onSignIn,
  onSignUp,
  onLogout,
}: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSignIn() {
    if (!email || !password) {
      setLocalError('Email and password are required.')
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await onSignIn(email, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      setLocalError('Email and password are required.')
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await onSignUp(email, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    setLocalError(null)
    try {
      await onLogout()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Logout failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Authentication</h2>
        <span className="text-xs text-muted-foreground">
          {userEmail ? `Signed in: ${userEmail}` : available ? 'Not signed in' : 'Auth disabled'}
        </span>
      </div>

      {(error || localError) && (
        <p className="text-xs text-destructive">{localError || error}</p>
      )}

      {available && !userEmail && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="rounded border px-2 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy || loading}
          />
          <input
            className="rounded border px-2 py-2 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy || loading}
          />
          <div className="flex gap-2">
            <button
              className="px-2 py-2 rounded bg-primary text-primary-foreground text-xs"
              onClick={() => void handleSignIn()}
              disabled={busy || loading}
            >
              Sign In
            </button>
            <button
              className="px-2 py-2 rounded bg-secondary text-secondary-foreground text-xs"
              onClick={() => void handleSignUp()}
              disabled={busy || loading}
            >
              Sign Up
            </button>
          </div>
        </div>
      )}

      {available && userEmail && (
        <div>
          <button
            className="px-3 py-2 rounded bg-secondary text-secondary-foreground text-xs"
            onClick={() => void handleLogout()}
            disabled={busy || loading}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
