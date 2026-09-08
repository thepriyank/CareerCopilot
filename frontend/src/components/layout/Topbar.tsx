import React from 'react'

interface TopbarProps {
  title: string
  eyebrow?: string
  right?: React.ReactNode
}

export function Topbar({ title, eyebrow, right }: TopbarProps) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.018em' }}>
          {title}
        </div>
      </div>
      {right && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {right}
        </div>
      )}
    </div>
  )
}
