export type PillStatus = 'draft' | 'reviewed' | 'approved' | 'ai'

const LABELS: Record<PillStatus, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  approved: 'Approved',
  ai: 'AI-generated',
}

interface StatusPillProps {
  status?: PillStatus
}

export function StatusPill({ status = 'draft' }: StatusPillProps) {
  return (
    <span className={`pill pill-${status}`}>
      {LABELS[status] ?? status}
    </span>
  )
}
