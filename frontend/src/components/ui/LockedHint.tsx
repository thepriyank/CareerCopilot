// Small "i" indicator next to a disabled AI-action button, explaining why
// via a native title tooltip — no extra JS/state needed. See jobs/[id]/
// page.tsx and jobs/page.tsx for the four locked actions (recompute
// match, skill gap, tailor résumé, cover letter).
export function LockedHint({ label = 'Feature not available in free-tier' }: { label?: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 15, height: 15, borderRadius: 999, border: '1px solid var(--line-strong)',
        color: 'var(--text-muted)', fontSize: 10, fontFamily: 'Georgia, serif', fontStyle: 'italic',
        cursor: 'help', flexShrink: 0,
      }}
    >
      i
    </span>
  )
}
