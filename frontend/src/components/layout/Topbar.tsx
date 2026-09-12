import React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

interface TopbarProps {
  title: string
  eyebrow?: string
  right?: React.ReactNode
  /** Renders a small "← backLabel" link above the eyebrow — for a detail
   * page reached from a list (e.g. a job detail page linking back to
   * "Jobs"). Omit on list/top-level pages. */
  backHref?: string
  backLabel?: string
}

export function Topbar({ title, eyebrow, right, backHref, backLabel = 'Back' }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-main" style={{ flex: 1, minWidth: 0 }}>
        {backHref && (
          <Link
            href={backHref}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 6 }}
          >
            <Icon.ChevronR size={11} style={{ transform: 'rotate(180deg)' }} />
            {backLabel}
          </Link>
        )}
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>
        )}
        <div className="topbar-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.018em' }}>
          {title}
        </div>
      </div>
      {right && (
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {right}
        </div>
      )}
    </div>
  )
}
