import React from 'react'

export type ChipTone = 'default' | 'match' | 'missing' | 'ink'

interface ChipProps {
  children: React.ReactNode
  tone?: ChipTone
  icon?: React.ReactNode
  onClick?: () => void
  title?: string
}

const CLASSES: Record<ChipTone, string> = {
  default: 'chip',
  match:   'chip chip-match',
  missing: 'chip chip-missing',
  ink:     'chip chip-ink',
}

export function Chip({ children, tone = 'default', icon, onClick, title }: ChipProps) {
  if (onClick) {
    return (
      <button
        type="button"
        className={CLASSES[tone]}
        onClick={onClick}
        title={title}
        style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}
      >
        {icon}
        {children}
      </button>
    )
  }
  return (
    <span className={CLASSES[tone]} title={title}>
      {icon}
      {children}
    </span>
  )
}
