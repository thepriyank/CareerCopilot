'use client'

import { useState } from 'react'
import { account, ApiError } from '@/lib/api'
import type { User } from '@/types'

function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

interface PassBannerProps {
  user: User
}

// Surfaces the one-month full-access pass in the sidebar's empty space,
// just above the user block — see docs/monetization_plan.md. A pre-
// existing user (passEligible) sees an offer to activate it; a user
// already on it sees how many days are left. Dismissing the offer doesn't
// hide it, only quiets it (it's a gift, not a nag) — it keeps showing as
// a one-line link until activated. Lives in the sidebar rather than atop
// the page content so it doesn't push the fixed topbar down.
export function PassBanner({ user }: PassBannerProps) {
  const [dismissed, setDismissed] = useState(user.passBannerDismissed ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user.passEligible) {
    const activate = async () => {
      setLoading(true)
      setError('')
      try {
        await account.activatePass()
        // Reload rather than just updating local state — the sidebar's own
        // user block reads plan via its own auth.me() call, and this is the
        // simplest way to keep it in sync with no new shared user store.
        window.location.reload()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not activate — try again')
        setLoading(false)
      }
    }

    const dismiss = () => {
      setDismissed(true)
      account.dismissPassBanner().catch(() => {
        // Best-effort — worst case the full offer reappears next visit.
      })
    }

    if (dismissed) {
      return (
        <div style={{ padding: '0 8px 8px' }}>
          <button
            onClick={activate}
            disabled={loading}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-text)', fontWeight: 500, fontSize: 11.5, cursor: 'pointer', textAlign: 'left' }}
          >
            {loading ? 'Activating…' : 'Free trial available — Activate'}
          </button>
          {error && <div style={{ color: 'var(--error)', fontSize: 10.5, marginTop: 2 }}>{error}</div>}
        </div>
      )
    }

    return (
      <div style={{ margin: '0 0 10px', padding: 10, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle-bd)' }}>
        <div style={{ fontSize: 11.5, color: 'var(--accent-text)', lineHeight: 1.4, marginBottom: 8 }}>
          <strong>Your free trial is ready.</strong> 15 days of unlimited tailored résumés, cover letters, and Assisted Apply.
        </div>
        {error && <div style={{ fontSize: 10.5, color: 'var(--error)', marginBottom: 6 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={activate} disabled={loading}>
            {loading ? 'Activating…' : 'Activate'}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={dismiss} disabled={loading}>
            Not now
          </button>
        </div>
      </div>
    )
  }

  if (user.plan === 'PREMIUM' && user.planExpiresAt) {
    const days = daysLeft(user.planExpiresAt)
    return (
      <div style={{ padding: '0 8px 8px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }} />
        Full access — {days} {days === 1 ? 'day' : 'days'} left
      </div>
    )
  }

  return null
}
