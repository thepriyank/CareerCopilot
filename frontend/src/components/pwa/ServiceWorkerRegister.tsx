'use client'

import { useEffect } from 'react'

/**
 * Registers /sw.js once, on the client, in production only — a service
 * worker fighting Next's dev HMR causes stale-asset confusion, and
 * there's nothing to gain from caching a dev build. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration must never break the app — offline
        // support is an enhancement, not a dependency.
      })
    }

    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
