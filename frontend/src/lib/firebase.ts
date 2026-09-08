/**
 * Firebase client — Google sign-in only, via `signInWithPopup`. The
 * resulting ID token is sent to `POST /api/auth/google`, which is where
 * the actual account (create-or-link) and session (our own JWT) happen —
 * see backend/src/routes/auth.routes.ts. Firebase itself never becomes a
 * parallel session mechanism the rest of the app has to know about.
 *
 * Absence-tolerant like the backend's optional integrations: with no
 * `NEXT_PUBLIC_FIREBASE_API_KEY` set, `isGoogleSignInAvailable()` is false
 * and callers (the login/register pages) simply don't render the Google
 * button, rather than showing something that would fail on click.
 */

import { initializeApp, getApps, FirebaseOptions } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth'

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function isGoogleSignInAvailable(): boolean {
  return !!firebaseConfig.apiKey
}

function getFirebaseApp() {
  return getApps()[0] ?? initializeApp(firebaseConfig)
}

/** Opens the Google account picker and returns the Firebase ID token to send to POST /api/auth/google. */
export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getFirebaseApp())
  const provider = new GoogleAuthProvider()
  const credential: UserCredential = await signInWithPopup(auth, provider)
  return credential.user.getIdToken()
}
