// Generic yes/no confirmation overlay — same visual pattern as the
// "add missing skill" modal in jobs/[id]/page.tsx. Used for actions that
// are cheap to trigger by accident (e.g. Sidebar's logout button sits
// right next to the Settings icon) but annoying to undo.
interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0.02 262 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={onCancel}
    >
      <div className="card" style={{ padding: 22, maxWidth: 340, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="serif" style={{ fontSize: 18, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 18 }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
