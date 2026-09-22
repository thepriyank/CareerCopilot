'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { jobs as jobsApi, ApiError } from '@/lib/api'
import { NotInterestedReason } from '@/types'

// Structured reasons, not just a free-text box — so this can feed the
// matching algorithm as a real preference signal later (captured now, not
// yet consumed by scoring — see Jira NM-27). Deliberately lines up with the
// axes matchScore.ts already reasons about (seniority/salary/location/
// skills) rather than a separate taxonomy.
export const NOT_INTERESTED_REASON_LABELS: Record<NotInterestedReason, string> = {
  ROLE_TOO_JUNIOR: 'Role is below my level',
  ROLE_TOO_SENIOR: 'Role is above my level',
  SALARY_TOO_LOW: 'Salary is too low',
  LOCATION_MISMATCH: "Location doesn't work for me",
  SKILLS_MISMATCH: "Skills don't match what I do",
  WRONG_ROLE_TYPE: "Not the kind of role I'm looking for",
  COMPANY: 'Not interested in this company',
  OTHER: 'Other reason',
}

export interface NotInterestedUpdate {
  notInterestedAt: string | null
  notInterestedReason: NotInterestedReason | null
  notInterestedNote: string | null
}

interface Props {
  jobId: string
  notInterestedAt: string | null
  notInterestedReason?: NotInterestedReason | null
  onChange: (update: NotInterestedUpdate) => void
  // Detail page shows the full "already dismissed, here's why + undo"
  // state; the job card just needs the dismiss action (the job disappears
  // from the list once marked, so there's nothing to show inline there).
  showDismissedState?: boolean
}

export function NotInterestedControl({ jobId, notInterestedAt, notInterestedReason, onChange, showDismissedState }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<NotInterestedReason>('OTHER')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      const res = await jobsApi.markNotInterested(jobId, reason, note.trim() || undefined)
      onChange({
        notInterestedAt: res.job.notInterestedAt,
        notInterestedReason: res.job.notInterestedReason,
        notInterestedNote: res.job.notInterestedNote,
      })
      setOpen(false)
      setNote('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this')
    } finally {
      setSaving(false)
    }
  }

  async function handleUndo() {
    setSaving(true)
    setError('')
    try {
      const res = await jobsApi.clearNotInterested(jobId)
      onChange({
        notInterestedAt: res.job.notInterestedAt,
        notInterestedReason: res.job.notInterestedReason,
        notInterestedNote: res.job.notInterestedNote,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not undo this')
    } finally {
      setSaving(false)
    }
  }

  if (notInterestedAt && showDismissedState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Marked not interested{notInterestedReason ? ` — ${NOT_INTERESTED_REASON_LABELS[notInterestedReason]}` : ''}
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div>}
        <button className="btn btn-secondary btn-sm" onClick={handleUndo} disabled={saving} style={{ alignSelf: 'flex-start' }}>
          <Icon.Refresh size={12} /> {saving ? 'Undoing…' : 'Mark as interested again'}
        </button>
      </div>
    )
  }

  if (notInterestedAt) return null // card context: already dismissed, nothing to show — it's out of the list

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} style={{ justifyContent: 'center' }}>
        <Icon.EyeOff size={12} /> Not interested
      </button>
      {open && (
        <div
          className="card"
          style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 260, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <div className="eyebrow">Why isn&rsquo;t this a fit?</div>
          {error && <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div>}
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as NotInterestedReason)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13, fontFamily: 'inherit' }}
          >
            {Object.entries(NOT_INTERESTED_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <textarea
            placeholder="Anything else? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13, minHeight: 60, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Saving…' : 'Dismiss job'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
