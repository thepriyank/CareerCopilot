import React from 'react'

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  color?: string
}

function ic(path: React.ReactNode, vb = '0 0 24 24') {
  return function IconComponent({ size = 16, color = 'currentColor', ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={vb}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {path}
      </svg>
    )
  }
}

export const Icon = {
  Home:       ic(<><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></>),
  Doc:        ic(<><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6M10 8h2"/></>),
  Chat:       ic(<><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></>),
  Briefcase:  ic(<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 12h18"/></>),
  Check:      ic(<path d="M4 12l5 5L20 6"/>),
  CheckCircle:ic(<><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></>),
  Star:       ic(<path d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.5 3 1.1-6.3L3 9.6l6.3-.9z"/>),
  Compass:    ic(<><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-6 2 2-6z"/></>),
  Lightning:  ic(<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>),
  LinkedIn:   ic(<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.5"/><path d="M12 17v-4a2 2 0 014 0v4"/><path d="M12 10v7"/></>),
  Upload:     ic(<><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></>),
  Sparkle:    ic(<><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 16l.7 1.8L21.5 18l-1.8.7L19 20.5l-.7-1.8L16.5 18l1.8-.5z"/></>),
  Pencil:     ic(<><path d="M4 20l4-1L20 7l-3-3L5 16z"/><path d="M14 6l3 3"/></>),
  Plus:       ic(<><path d="M12 5v14M5 12h14"/></>),
  Filter:     ic(<path d="M3 5h18l-7 9v6l-4-2v-4z"/>),
  Search:     ic(<><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></>),
  Send:       ic(<><path d="M4 12l16-8-6 18-3-7z"/><path d="M11 13l3-3"/></>),
  Settings:   ic(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  Chevron:    ic(<path d="M6 9l6 6 6-6"/>),
  ChevronR:   ic(<path d="M9 6l6 6-6 6"/>),
  Map:        ic(<><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></>),
  Bell:       ic(<><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 004 0"/></>),
  Mail:       ic(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>),
  X:          ic(<path d="M6 6l12 12M18 6L6 18"/>),
  Refresh:    ic(<><path d="M4 12a8 8 0 0114-5l2-2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 01-14 5l-2 2"/><path d="M4 20v-5h5"/></>),
  Eye:        ic(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
  Clock:      ic(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
}
