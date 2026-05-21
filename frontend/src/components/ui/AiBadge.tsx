interface AiBadgeProps {
  label?: string
}

export function AiBadge({ label = 'AI suggestion' }: AiBadgeProps) {
  return <span className="ai-badge">{label}</span>
}
