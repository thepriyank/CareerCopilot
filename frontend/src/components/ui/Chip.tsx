import React from 'react'

export type ChipTone = 'default' | 'match' | 'missing' | 'ink'

interface ChipProps {
  children: React.ReactNode
  tone?: ChipTone
  icon?: React.ReactNode
}

const CLASSES: Record<ChipTone, string> = {
  default: 'chip',
  match:   'chip chip-match',
  missing: 'chip chip-missing',
  ink:     'chip chip-ink',
}

export function Chip({ children, tone = 'default', icon }: ChipProps) {
  return (
    <span className={CLASSES[tone]}>
      {icon}
      {children}
    </span>
  )
}
