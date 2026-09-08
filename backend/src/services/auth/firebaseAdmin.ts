/**
 * Firebase Admin — verifies the ID token a client obtains from Firebase
 * Auth after a Google sign-in (see routes/auth.routes.ts's POST /google).
 * The app never trusts a client-asserted identity directly: every sign-in
 * still ends with our own JWT via `signToken()` (middleware/auth.ts),
 * exactly like password login — Firebase is only ever the thing that
 * proves "this really is that Google account," not a parallel session
 * mechanism `requireAuth` would need to understand.
 *
 * Absence-tolerant like every other optional integration in this codebase:
 * with no `FIREBASE_PROJECT_ID` set, `getFirebaseAuth()` returns `null` and
 * POST /google responds with a clear "not configured" error rather than
 * crashing the app or blocking anything else.
 */

import fs from 'fs'
import path from 'path'
import { initializeApp, cert, applicationDefault, App, Credential } from 'firebase-admin/app'
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth'
import { config } from '../../config'

let app: App | null | undefined // undefined = not yet attempted, null = unavailable/unconfigured

function buildCredential(): Credential {
  const { keyFile, credentialsJson } = config.firebase
  if (credentialsJson) {
    return cert(JSON.parse(credentialsJson))
  }
  if (keyFile) {
    const resolved = path.resolve(process.cwd(), keyFile)
    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'))
    return cert(serviceAccount)
  }
  return applicationDefault()
}

function getFirebaseApp(): App | null {
  if (app !== undefined) return app
  if (!config.firebase.projectId) {
    app = null
    return app
  }

  // Named app (not the default) so this never collides with some other
  // part of the process independently calling initializeApp().
  app = initializeApp({ credential: buildCredential(), projectId: config.firebase.projectId }, 'jobmagnate')
  return app
}

function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp()
  return firebaseApp ? getAuth(firebaseApp) : null
}

/** Test-only seam: forget the cached app so the next call re-reads config. */
export function resetFirebaseAppForTests(): void {
  app = undefined
}

/**
 * Verifies a Firebase ID token and returns its decoded claims (uid, email,
 * name, ...). Throws if Firebase isn't configured, or if the token is
 * invalid/expired — both are caller errors the route should surface as a
 * 4xx, not swallow.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const auth = getFirebaseAuth()
  if (!auth) {
    throw new Error('Google sign-in is not configured on this server (missing FIREBASE_PROJECT_ID)')
  }
  return auth.verifyIdToken(idToken)
}
