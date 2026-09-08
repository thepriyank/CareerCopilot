interface ToggleProps {
  on?: boolean
  onChange?: (on: boolean) => void
}

export function Toggle({ on = false, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => onChange?.(!on)}
      style={{
        width: 34, height: 20, borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--paper-3)',
        display: 'flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        padding: 2,
        transition: 'background .15s',
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 999,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}
