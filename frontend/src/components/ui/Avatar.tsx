type AvatarTone = 'ink' | 'sage' | 'ochre' | 'paper'

const TONES: Record<AvatarTone, [string, string]> = {
  ink:   ['var(--ink-100)',   'var(--ink-900)'],
  sage:  ['var(--sage-100)',  'var(--sage-900)'],
  ochre: ['var(--ochre-100)', 'var(--ochre-900)'],
  paper: ['var(--paper-3)',   'var(--text-soft)'],
}

interface AvatarProps {
  name?: string
  size?: number
  tone?: AvatarTone
}

export function Avatar({ name = 'M K', size = 28, tone = 'ink' }: AvatarProps) {
  const [bg, fg] = TONES[tone]
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase()

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: bg,
      color: fg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 600,
      letterSpacing: 0.5,
      fontFamily: 'var(--font-sans)',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}
