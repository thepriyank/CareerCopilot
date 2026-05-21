'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'

const TABS = [
  { href: '/dashboard', label: 'Resume',  Icon: Icon.Doc },
  { href: '/jobs',      label: 'Jobs',    Icon: Icon.Briefcase },
  { href: '/tailoring', label: 'Tailor',  Icon: Icon.Sparkle },
  { href: '/roadmap',   label: 'Roadmap', Icon: Icon.Map },
  { href: '/settings',  label: 'You',     Icon: Icon.Settings },
]

export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <div className="m-tabbar">
      {TABS.map(({ href, label, Icon: TabIcon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className={`m-tab${active ? ' active' : ''}`}>
            <TabIcon size={22} color={active ? 'var(--ink-900)' : 'var(--text-muted)'} />
            <span>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
