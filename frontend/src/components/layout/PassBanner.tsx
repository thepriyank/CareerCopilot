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

// Surfaces the one-month full-access pass — see docs/monetization_plan.md.
// A pre-existing user (passEligible) sees an offer to activate it; a user
// already on it sees how many days are left. Dismissing the offer doesn't
// hide it, only quiets it (it's a gift, not a nag) — it keeps showing as a
// small line until activated.
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
        // Reload rather than just updating local state — the sidebar reads
        // plan via its own independent auth.me() call, and this is the
        // simplest way to keep it in sync with no new shared user store.
        window.location.reload()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not activate your pass — try again')
      } finally {
        setLoading(false)
      }
    }

    const dismiss = () => {
      setDismissed(true)
      account.dismissPassBanner().catch(() => {
        // Best-effort — worst case the full banner reappears next visit.
      })
    }

    if (dismissed) {
      return (
        <div style={{ margin: '14px 24px 0', padding: '8px 14px', fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Your free month is still available.</span>
          <button
            onClick={activate}
            disabled={loading}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-text)', fontWeight: 500, fontSize: 12.5, cursor: 'pointer' }}
          >
            {loading ? 'Activating…' : 'Activate it'}
          </button>
          {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
        </div>
      )
    }

    return (
      <div
        className="card"
        style={{
          margin: '14px 24px 0',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          background: 'var(--accent-subtle)',
          borderColor: 'var(--accent-subtle-bd)',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--accent-text)' }}>
          <strong>Your free month is ready.</strong> Activate it whenever you&rsquo;re ready — 30 days of unlimited tailored résumés and cover letters.
          {error && <div style={{ color: 'var(--error)', marginTop: 4 }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-primary btn-sm" onClick={activate} disabled={loading}>
            {loading ? 'Activating…' : 'Activate'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={dismiss} disabled={loading}>
            Not now
          </button>
        </div>
      </div>
    )
  }

  if (user.plan === 'PREMIUM' && user.planExpiresAt) {
    const days = daysLeft(user.planExpiresAt)
    return (
      <div style={{ margin: '14px 24px 0', padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }} />
        Full access — {days} {days === 1 ? 'day' : 'days'} left
      </div>
    )
  }

  return null
}
