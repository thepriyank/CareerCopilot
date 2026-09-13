import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

export const metadata: Metadata = {
  applicationName: 'JobMagnate',
  title: 'JobMagnate',
  description: 'The career copilot that shows its work.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JobMagnate',
  },
  formatDetection: { telephone: false },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;450;500;600;700&family=Geist+Mono:wght@400;500&family=Syne:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
