'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

/**
 * Guest-only pages (landing, sign in, sign up) are never shown to a signed-in
 * user: they're sent to /dashboard with `replace`, so the back button can't
 * return them here either. Renders `children` only once we know the visitor
 * is signed out, so the login form never flashes for a signed-in user.
 *
 * `renderWhileChecking` lets server-rendered pages (the landing page) keep
 * their HTML visible for SEO and first paint — there, the pre-paint inline
 * script (SIGNED_IN_REDIRECT_SCRIPT) already handled full page loads, and
 * this covers client-side navigations.
 */
export function SignedInRedirect({
  children,
  renderWhileChecking = false,
}: {
  children: React.ReactNode
  renderWhileChecking?: boolean
}) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard')
    else setChecked(true)
  }, [router])

  if (!checked && !renderWhileChecking) return null
  return <>{children}</>
}
