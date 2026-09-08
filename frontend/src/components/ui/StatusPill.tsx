export type PillStatus = 'draft' | 'reviewed' | 'approved' | 'ai' | 'rejected'

const LABELS: Record<PillStatus, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  approved: 'Approved',
  ai: 'AI-generated',
  rejected: 'Rejected',
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
