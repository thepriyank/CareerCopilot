'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithGoogle } from '@/lib/firebase'
import { setToken } from '@/lib/auth'
import { auth as authApi, ApiError } from '@/lib/api'

/**
 * Renders nothing when Google sign-in isn't configured (see
 * lib/firebase.ts's isGoogleSignInAvailable) — the caller decides whether
 * that also means hiding a divider/"or" line around it, so this component
 * itself doesn't take an availability prop, it just returns null and lets
 * the page's own `isGoogleSignInAvailable()` check drive that decision.
 *
 * Sign-in and sign-up are the same click — Google OAuth doesn't have a
 * separate "register" step, so a brand-new account routes to `/resume/
 * upload` (matching email/password registration) and an existing one to
 * `/dashboard` (matching email/password login), based on the backend's
 * own `isNewUser` verdict rather than which page the button was on.
 */
export function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    onError('')
    setLoading(true)
    try {
      const idToken = await signInWithGoogle()
      const { token, isNewUser } = await authApi.google(idToken)
      setToken(token)
      router.push(isNewUser ? '/resume/upload' : '/dashboard')
    } catch (err: unknown) {
      // A closed popup/cancelled sign-in isn't a real error worth showing.
      if (err instanceof Error && err.message.includes('popup-closed-by-user')) return
      onError(err instanceof ApiError ? err.message : 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="btn btn-secondary"
      style={{ width: '100%', justifyContent: 'center', height: 40, gap: 10 }}
    >
      <GoogleIcon />
      {loading ? 'Connecting…' : 'Continue with Google'}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.16 7.09-10.3 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
