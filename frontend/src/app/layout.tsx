import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jobmagnate',
  description: 'The career copilot that shows its work.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;450;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
