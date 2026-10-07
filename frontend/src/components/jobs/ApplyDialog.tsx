import Link from 'next/link'

interface ApplyDialogProps {
  hasApprovedResume: boolean
  hasApprovedLetter: boolean
  /** Tailored documents that exist for this job but aren't approved yet. */
  unapproved: ('résumé' | 'cover letter')[]
  busy: boolean
  onWith: () => void
  onWithout: () => void
  onCancel: () => void
}

/**
 * "Apply with your tailored documents?" (NM-4). Shown from the job page's
 * Apply button only when this job has a tailored résumé or cover letter.
 * Only *approved* documents are offered — the human-approval step (F6) is
 * never skipped on the way to a real application. A draft is named, with a
 * link to Approvals, rather than silently left out.
 */
export function ApplyDialog({ hasApprovedResume, hasApprovedLetter, unapproved, busy, onWith, onWithout, onCancel }: ApplyDialogProps) {
  const approved = [hasApprovedResume && 'tailored résumé', hasApprovedLetter && 'cover letter'].filter(Boolean) as string[]
  const canDownload = approved.length > 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0.02 262 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={() => !busy && onCancel()}
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-dialog-title"
        style={{ padding: 22, maxWidth: 400, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow" style={{ marginBottom: 6 }}>Apply</div>
        <div id="apply-dialog-title" className="serif" style={{ fontSize: 18, marginBottom: 8 }}>
          {canDownload ? 'Apply with your tailored documents?' : 'Your tailored documents aren’t approved yet'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: unapproved.length ? 10 : 18 }}>
          {canDownload
            ? approved.length > 1
              ? <>We&rsquo;ll download your {approved.join(' and ')} as PDFs and open the application, so they&rsquo;re ready to attach.</>
              : <>We&rsquo;ll download your {approved[0]} as a PDF and open the application, so it&rsquo;s ready to attach.</>
            : <>Only approved documents can go on an application.</>}
        </div>
        {unapproved.length > 0 && (
          <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 18, padding: '8px 10px', borderRadius: 8, background: 'var(--paper-2)' }}>
            Your tailored {unapproved.join(' and ')} {unapproved.length > 1 ? 'aren’t' : 'isn’t'} approved yet, so{' '}
            {unapproved.length > 1 ? 'they’re' : 'it’s'} not included.{' '}
            <Link href="/approvals" style={{ textDecoration: 'underline' }}>Review in Approvals</Link>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={canDownload ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={onWithout} disabled={busy}>
            {canDownload ? 'Apply without them' : 'Open application'}
          </button>
          {canDownload && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onWith} disabled={busy}>
              {busy ? 'Downloading…' : 'Download & apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
