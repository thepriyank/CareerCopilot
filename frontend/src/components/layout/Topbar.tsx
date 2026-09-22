import React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { NotificationBell } from '@/components/layout/NotificationBell'

interface TopbarProps {
  title: string
  eyebrow?: string
  right?: React.ReactNode
  /** Renders a small "← backLabel" link immediately to the left of the
   * title, on the same line — for a detail page reached from a list (e.g.
   * a job detail page linking back to "Jobs"). Omit on list/top-level
   * pages. Deliberately inline, not its own row: `.topbar` is a fixed
   * 56px bar sized for exactly eyebrow + title (two lines); a third
   * stacked line overflows that fixed height (its vertical centering then
   * pushes content above the bar, off the top of the viewport — see
   * 2026-09-12 fix). */
  backHref?: string
  backLabel?: string
  /** Extra icon-button rendered on mobile only, to the right of the
   * notification bell in the same corner (e.g. Settings' hamburger menu
   * trigger — see `.topbar-mobile-icons` in globals.css). On desktop the
   * bell already lives in the Sidebar, so this whole row is hidden there;
   * nothing needs to pass this prop on desktop-only flows. */
  mobileExtra?: React.ReactNode
}

export function Topbar({ title, eyebrow, right, backHref, backLabel = 'Back', mobileExtra }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-main" style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {backHref && (
            <Link
              href={backHref}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', flexShrink: 0 }}
            >
              <Icon.ChevronR size={12} style={{ transform: 'rotate(180deg)' }} />
              {backLabel}
            </Link>
          )}
          <div className="topbar-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.018em', minWidth: 0, flex: 1 }}>
            {title}
          </div>
          {/* Mobile-only — desktop already has the bell in the Sidebar.
              Bell always first; mobileExtra (e.g. Settings' hamburger)
              sits to its right when a page passes one. */}
          <div className="topbar-mobile-icons">
            <NotificationBell />
            {mobileExtra}
          </div>
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
