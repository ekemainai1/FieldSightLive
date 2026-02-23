import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirebaseClient } from '@/services/firebase-client'
import { setAuthTokenProvider } from '@/services/api-client'
import { setWebSocketAuthTokenProvider } from '@/services/websocket'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  available: boolean
  error: string | null
}

export function useFirebaseAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    available: true,
    error: null,
  })

  useEffect(() => {
    const client = getFirebaseClient()
    if (!client) {
      setState({
        user: null,
        token: null,
        loading: false,
        available: false,
        error: 'Firebase web config is missing. Auth is disabled in this environment.',
      })
      setAuthTokenProvider(async () => null)
      setWebSocketAuthTokenProvider(async () => null)
      return
    }

    const unsubscribe = onIdTokenChanged(client.auth, async (user) => {
      const token = user ? await user.getIdToken() : null

      setState((prev) => ({
        ...prev,
        user,
        token,
        loading: false,
        error: null,
      }))

      setAuthTokenProvider(async () => token)
      setWebSocketAuthTokenProvider(async () => token)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<void> => {
    const client = getFirebaseClient()
    if (!client) {
      throw new Error('Firebase auth unavailable')
    }
    await signInWithEmailAndPassword(client.auth, email, password)
  }

  const signUp = async (email: string, password: string): Promise<void> => {
    const client = getFirebaseClient()
    if (!client) {
      throw new Error('Firebase auth unavailable')
    }
    await createUserWithEmailAndPassword(client.auth, email, password)
  }

  const logout = async (): Promise<void> => {
    const client = getFirebaseClient()
    if (!client) {
      return
    }
    await signOut(client.auth)
  }

  return {
    ...state,
    signIn,
    signUp,
    logout,
  }
}
