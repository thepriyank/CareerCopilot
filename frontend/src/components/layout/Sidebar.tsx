'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'

const MAIN_NAV = [
  { href: '/dashboard',  label: 'Dashboard',  Icon: Icon.Home },
  { href: '/resume',     label: 'Resume',      Icon: Icon.Doc },
  { href: '/jobs',       label: 'Jobs',        Icon: Icon.Briefcase },
  { href: '/tailoring',  label: 'Tailoring',   Icon: Icon.Sparkle },
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

  const isActive = (href: string) =>
    active
      ? active === href
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="sidebar">
      <div className="logo">
        <i>C</i>
        <span>Copilot</span>
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
        <Avatar name="Maya K" tone="ink" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Maya Kapoor</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Free plan</div>
        </div>
        <Link href="/settings">
          <Icon.Settings size={14} />
        </Link>
      </div>
    </aside>
  )
}
