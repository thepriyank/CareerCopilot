'use client'

import { useEffect, useState } from 'react'
import {
  canPromptInstall,
  isIosSafari,
  isStandalone,
  onInstallAvailabilityChange,
  promptInstall,
} from '@/lib/pwaInstall'

const DISMISS_KEY = 'jm-install-dismissed-at'
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_FOR_MS
  } catch {
    return false
  }
}

/**
 * "Install JobMagnate" banner for phones. Uses the native install dialog
 * where the browser offers one (Android Chrome & co. — see lib/pwaInstall),
 * and a one-line how-to on iOS Safari, which has no install API. Hidden once
 * installed, on desktop widths (CSS), and for 30 days after "Not now".
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<'native' | 'ios' | null>(null)

  useEffect(() => {
    const update = () => {
      if (isStandalone() || recentlyDismissed()) return setMode(null)
      if (canPromptInstall()) return setMode('native')
      setMode(isIosSafari() ? 'ios' : null)
    }
    update()
    return onInstallAvailabilityChange(update)
  }, [])

  if (!mode) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // storage blocked (private mode) — just hide for this visit
    }
    setMode(null)
  }

  return (
    <div className="pwa-install" role="region" aria-label="Install the JobMagnate app">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset */}
      <img src="/icons/icon-512.png" alt="" width={36} height={36} style={{ borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Install JobMagnate</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {mode === 'native'
            ? 'Add it to your home screen for one-tap access.'
            : <>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</>}
        </div>
      </div>
      {mode === 'native' && (
        <button className="btn btn-primary btn-sm" onClick={() => promptInstall().then((ok) => ok && setMode(null))}>
          Install
        </button>
      )}
      <button className="btn btn-ghost btn-sm" onClick={dismiss} aria-label="Dismiss install prompt">
        {mode === 'native' ? 'Not now' : 'Got it'}
      </button>
    </div>
  )
}
