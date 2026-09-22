'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { notifications as notificationsApi } from '@/lib/api'
import type { Notification } from '@/types'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface NotificationBellProps {
  /** Which way the dropdown opens relative to the bell. 'down' (default)
   * for a top-of-screen bell (Topbar, mobile); 'up' for a bottom-of-screen
   * one (Sidebar, desktop) so it doesn't run off the top of the viewport. */
  openDirection?: 'down' | 'up'
}

// Rendered in two places: the Sidebar (desktop, bottom row, opens
// upward) and the Topbar (mobile-only, top row, opens downward) — see
// each component for why. Loads on mount only (no polling); a fresh list
// is fetched every time the dropdown opens instead, which is cheap
// (capped at 30 rows server-side) and keeps this simple with no interval
// to clean up.
export function NotificationBell({ openDirection = 'down' }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    try {
      const res = await notificationsApi.list()
      setItems(res.notifications)
      setUnreadCount(res.unreadCount)
    } catch {
      // Best-effort — the bell just stays quiet if this fails.
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      await refresh()
      setLoading(false)
    }
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await notificationsApi.markRead(id)
    } catch {
      // Local state already optimistically updated — a failed mark-read
      // just means it may show as unread again next refresh, non-fatal.
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
    try {
      await notificationsApi.markAllRead()
    } catch {
      // Same best-effort reasoning as markRead above.
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggle}
        title="Notifications"
        aria-label="Notifications"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
      >
        <Icon.Bell size={14} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: -4, right: -5, minWidth: 14, height: 14, borderRadius: 999,
              background: 'var(--danger, var(--error))', color: '#fff', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            ...(openDirection === 'up' ? { bottom: '130%' } : { top: '130%' }),
            right: -8, zIndex: 30, width: 320, maxHeight: 380,
            overflowY: 'auto', padding: 0, boxShadow: 'var(--shadow-3)', background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-text)', fontSize: 11.5, cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-muted)' }}>No new notifications</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.readAt && markRead(n.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: n.readAt ? 'transparent' : 'var(--accent-subtle)',
                  border: 'none', borderBottom: '1px solid var(--line-2)', borderRadius: 0,
                  cursor: n.readAt ? 'default' : 'pointer', font: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  {!n.readAt && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.body}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
