'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { auth as authApi } from '@/lib/api'

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
  const [userName, setUserName] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('Free plan')

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => {
        setUserName(user.name || user.email)
        setPlan(user.plan === 'PREMIUM' ? 'Premium plan' : 'Free plan')
      })
      .catch(() => {
        // Not authenticated (or request failed) — leave the placeholder blank.
      })
  }, [])

  const isActive = (href: string) =>
    active
      ? active === href
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="sidebar">
      <div className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
        <img src="/icons/logo-mark.png" alt="" width={93} height={28} />
        <span>Jobmagnate</span>
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

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 8px',
        borderTop: '1px solid var(--line-2)',
      }}>
        <Avatar name={userName || '?'} tone="ink" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || '…'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{plan}</div>
        </div>
        <Link href="/settings">
          <Icon.Settings size={14} />
        </Link>
      </div>
    </aside>
  )
}
