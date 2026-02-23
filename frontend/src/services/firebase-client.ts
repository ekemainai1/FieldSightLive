import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
}

let firebaseClient: FirebaseClient | null = null

export function getFirebaseClient(): FirebaseClient | null {
  if (firebaseClient) {
    return firebaseClient
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null
  }

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        apiKey,
        authDomain,
        projectId,
        appId,
      })

  firebaseClient = {
    app,
    auth: getAuth(app),
  }

  return firebaseClient
}
