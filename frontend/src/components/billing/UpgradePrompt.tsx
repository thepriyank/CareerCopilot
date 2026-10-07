import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { settingsHref } from '@/lib/settingsTabs'

/**
 * Shown where a free user hits a locked AI feature (NM-5). This is the best
 * conversion moment the product has, so it always offers both ways out:
 * buy a pass, or bring their own API key (which unlocks AI features free).
 * `compact` is the one-line banner form for list pages.
 */
export function UpgradePrompt({ compact = false }: { compact?: boolean }) {
  const actions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
      <Link href={settingsHref('Plan')} className="btn btn-primary btn-sm">
        See plans
      </Link>
      <Link href={settingsHref('API keys')} className="btn btn-ghost btn-sm">
        Use my own API key
      </Link>
    </div>
  )

  if (compact) {
    return (
      <div
        className="card"
        role="region"
        aria-label="Unlock AI features"
        style={{ padding: '12px 16px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle-bd)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <Icon.Sparkle size={14} color="var(--accent-text)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200, fontSize: 12.5 }}>
          <strong>Your free pass has ended.</strong> Jobs still show up by skill match, but match scores, skill
          gaps, tailored résumés and cover letters are locked. Get a pass to unlock them, or add your own API key.
        </div>
        {actions}
      </div>
    )
  }

  return (
    <div
      className="card"
      role="region"
      aria-label="Unlock AI features"
      style={{ padding: 20, background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle-bd)', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon.Sparkle size={14} color="var(--accent-text)" />
        <div className="eyebrow" style={{ color: 'var(--accent-text)' }}>Unlock AI features</div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
        Your free pass has ended. Get a pass to score this job against your profile, find your skill gaps, and
        tailor your résumé and cover letter for it — or add your own API key to keep using them for free.
      </div>
      {actions}
    </div>
  )
}
