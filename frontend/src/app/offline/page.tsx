import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline · JobMagnate',
}

// Static fallback the service worker serves for navigations that fail
// while offline (see public/sw.js). Kept dependency-free and self-styled
// so it renders even if nothing else is cached.
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        textAlign: 'center',
        background: '#fbfbfc',
        color: '#3a3f4b',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
      <img src="/icons/logo-mark.png" alt="" width={87} height={26} />
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '8px 0 0' }}>You&rsquo;re offline</h1>
      <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
        JobMagnate needs a connection for most things — your jobs, matches, and resume all live on the server. Reconnect and try again.
      </p>
    </div>
  )
}
