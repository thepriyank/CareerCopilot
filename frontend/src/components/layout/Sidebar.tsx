'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { auth as authApi } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { PassBanner } from '@/components/layout/PassBanner'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { User } from '@/types'

const MAIN_NAV = [
  { href: '/dashboard',  label: 'Dashboard',  Icon: Icon.Home },
  { href: '/resume',     label: 'Resume',      Icon: Icon.Doc },
  { href: '/jobs',       label: 'Jobs',        Icon: Icon.Briefcase },
  { href: '/approvals',  label: 'Approvals',   Icon: Icon.CheckCircle },
]

const GROWTH_NAV = [
  { href: '/roadmap',  label: 'Skill roadmap', Icon: Icon.Map },
  { href: '/linkedin', label: 'LinkedIn',       Icon: Icon.LinkedIn },
]

interface SidebarProps {
  active?: string
}

export function Sidebar({ active }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)

  function handleSignOut() {
    clearToken()
    router.push('/login')
  }

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => {
        // Not authenticated (or request failed) — leave the placeholder blank.
      })
  }, [])

  const userName = user?.name || user?.email || null
  const planLabel = user?.plan === 'PREMIUM' ? 'Premium plan' : 'Free plan'

  const isActive = (href: string) =>
    active
      ? active === href
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="sidebar">
      <div className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
        <img src="/icons/logo-mark.png" alt="" width={74} height={22} />
        <span className="wordmark">JobMagnate</span>
      </div>

      {MAIN_NAV.map(({ href, label, Icon: NavIcon }) => (
        <Link
          key={href}
          href={href}
          className={`nav-item${isActive(href) ? ' active' : ''}`}
        >
          <NavIcon />
          <span>{label}</span>
        </Link>
      ))}

      <div className="nav-section">Growth</div>

      {GROWTH_NAV.map(({ href, label, Icon: NavIcon }) => (
        <Link
          key={href}
          href={href}
          className={`nav-item${isActive(href) ? ' active' : ''}`}
        >
          <NavIcon />
          <span>{label}</span>
        </Link>
      ))}

      <div style={{ flex: 1 }} />

      {user && <PassBanner user={user} />}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 8px',
        borderTop: '1px solid var(--line-2)',
      }}>
        <Avatar name={userName || '?'} tone="ink" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || '…'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{planLabel}</div>
        </div>
        {user && <NotificationBell openDirection="up" />}
        <Link href="/settings" title="Settings" style={{ color: 'var(--text-muted)', display: 'flex' }}>
          <Icon.Settings size={14} />
        </Link>
        <button
          type="button"
          onClick={() => setConfirmingSignOut(true)}
          title="Sign out"
          aria-label="Sign out"
          style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
        >
          <Icon.LogOut size={14} />
        </button>
      </div>

      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out?"
          body="You'll need to sign back in to get to your dashboard, résumés, and matched jobs."
          confirmLabel="Sign out"
          onConfirm={handleSignOut}
          onCancel={() => setConfirmingSignOut(false)}
        />
      )}
    </aside>
  )
}
