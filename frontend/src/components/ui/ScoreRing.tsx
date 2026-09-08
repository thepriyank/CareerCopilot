interface ScoreRingProps {
  value?: number
  size?: number
  label?: string
}

export function ScoreRing({ value = 84, size = 56, label = 'match' }: ScoreRingProps) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const off = c - (value / 100) * c
  const tone =
    value >= 75 ? 'var(--accent)' :
    value >= 45 ? 'var(--warning)' :
    'var(--text-faint)'

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--paper-3)" strokeWidth="4" fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={tone} strokeWidth="4" fill="none"
          strokeDasharray={c} strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontWeight: 500,
        fontSize: size * 0.34, lineHeight: 1,
      }}>
        {value}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8, letterSpacing: 0.1,
          color: 'var(--text-muted)',
          marginTop: 2, textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
    </div>
  )
}
